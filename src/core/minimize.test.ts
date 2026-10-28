import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { accepts, completeWithDeadState, removeUnreachable } from './analysis';
import { canMinimize, minimize } from './minimize';
import type { MinimizeStep } from './trace';
import { fixture } from './testing/fixtures';
import { arbDfa, arbWord } from './testing/arbitraries';

/** Every word over `alphabet` of length 0..maxLen. */
function wordsUpTo(alphabet: string[], maxLen: number): string[] {
  const out = [''];
  let layer = [''];
  for (let n = 1; n <= maxLen; n++) {
    layer = layer.flatMap((w) => alphabet.map((s) => w + s));
    out.push(...layer);
  }
  return out;
}

const redundant = fixture({
  kind: 'DFA',
  alphabet: 'a',
  states: ['q0', 'q1', 'q2'],
  start: 'q0',
  accepting: ['q1', 'q2'],
  edges: [
    ['q0', 'a', 'q1'],
    ['q1', 'a', 'q2'],
    ['q2', 'a', 'q1'],
  ],
  name: 'red',
});

const partialWithUnreachable = fixture({
  kind: 'DFA',
  alphabet: 'ab',
  states: ['q0', 'q1', 'q2', 'q3'],
  start: 'q0',
  accepting: ['q1'],
  edges: [
    ['q0', 'a', 'q1'],
    ['q1', 'b', 'q0'],
    ['q3', 'a', 'q0'],
  ],
  name: 'pu',
});

const splitter = fixture({
  kind: 'DFA',
  alphabet: 'ab',
  states: ['q0', 'q1', 'q2', 'q3'],
  start: 'q0',
  accepting: ['q3'],
  edges: [
    ['q0', 'a', 'q1'],
    ['q0', 'b', 'q2'],
    ['q1', 'a', 'q1'],
    ['q1', 'b', 'q3'],
    ['q2', 'a', 'q2'],
    ['q2', 'b', 'q2'],
    ['q3', 'a', 'q3'],
    ['q3', 'b', 'q3'],
  ],
});

describe('canMinimize', () => {
  it('checks DFA, start, errors in order', () => {
    expect(canMinimize({ ...redundant, kind: 'NFA' })).toBe('Minimization needs a DFA');
    expect(canMinimize({ ...redundant, start: null })).toBe('Set a start state first');
    expect(canMinimize({ ...redundant, start: 'zzz' })).toBe('Set a start state first');
    expect(
      canMinimize({
        ...redundant,
        transitions: [...redundant.transitions, { id: 'x', from: 'q0', to: 'q2', symbols: ['a'] }],
      }),
    ).toBe('Fix the errors in the automaton first');
    expect(canMinimize(redundant)).toBeNull();
  });
  it('minimize throws the reason', () => {
    expect(() => minimize({ ...redundant, start: null })).toThrow('Set a start state first');
  });
});

describe('minimize', () => {
  it('merges equivalent states', () => {
    const { result } = minimize(redundant);
    expect(result.states).toHaveLength(2);
    expect(result.states.map((s) => s.label).sort()).toEqual(['q0', '{q1,q2}']);
    expect(result.name).toBe('red (min)');
    expect(result.kind).toBe('DFA');
    expect(result.alphabet).toEqual(['a']);
    const merged = result.states.find((s) => s.label === '{q1,q2}');
    expect(result.accepting).toEqual([merged?.id]);
    expect(result.transitions).toHaveLength(2);
  });

  it('emits trim then complete for an unreachable, partial DFA', () => {
    const t = minimize(partialWithUnreachable);
    expect(t.steps.map((s) => s.phase).slice(0, 3)).toEqual(['trim', 'complete', 'partition']);
    const [trim, complete] = t.steps as [MinimizeStep, MinimizeStep];
    expect(trim.explanation).toBe('Remove unreachable states: {q2, q3}');
    expect(trim.removed).toEqual(['q2', 'q3']);
    expect(trim.automaton).toBe(partialWithUnreachable);
    expect(trim.blocks).toEqual([]);
    expect(trim.focus).toEqual({ states: ['q2', 'q3'] });
    expect(complete.explanation).toBe('Add dead state ∅ for missing transitions');
    expect(complete.deadState).toBeDefined();
    expect(complete.focus).toEqual({ states: [complete.deadState] });
    expect(complete.blocks).toEqual([]);
    expect(t.steps.at(-1)?.explanation).toMatch(/^Done: 4 → \d states$/);
  });

  it('skips trim and complete when not needed', () => {
    expect(minimize(redundant).steps[0]?.phase).toBe('partition');
  });

  it('partition explanation lists accepting and non-accepting', () => {
    const p = minimize(redundant).steps[0] as MinimizeStep;
    expect(p.explanation).toBe('Start with accepting {q1, q2} and non-accepting {q0}');
    expect(p.blocks).toEqual([['q1', 'q2'], ['q0']]);
    expect(p.focus).toEqual({});
  });

  it('drops the empty block when all states accept', () => {
    const d = { ...redundant, accepting: ['q0', 'q1', 'q2'] };
    const p = minimize(d).steps[0] as MinimizeStep;
    expect(p.blocks).toEqual([['q0', 'q1', 'q2']]);
    expect(p.explanation).toBe('Start with one block {q0, q1, q2}');
    expect(minimize(d).result.states).toHaveLength(1);
  });

  it('split explanation names a witness', () => {
    const t = minimize(splitter);
    const splits = t.steps.filter((s) => s.phase === 'split');
    expect(splits.length).toBeGreaterThan(0);
    const first = splits[0] as MinimizeStep;
    expect(first.explanation).toBe(
      "q0 and q1 differ on 'b': q0 → block B, q1 → block A; block B splits into {q0, q2} and {q1}",
    );
    expect(first.split).toEqual({
      block: 1,
      parts: [['q0', 'q2'], ['q1']],
      witness: { p: 'q0', q: 'q1', symbol: 'b' },
    });
    expect(first.focus).toEqual({ states: ['q0', 'q1', 'q2'], transitions: [] });
    expect(first.blocks).toEqual([['q3'], ['q0', 'q2'], ['q1']]);
    for (const s of splits) expect(s.explanation).toMatch(/^q\d+ and q\d+ differ on '.'/);
    expect(t.steps.at(-1)?.phase).toBe('done');
    expect(t.steps.at(-1)?.focus).toEqual({});
  });

  it('joins three parts with commas and "and"', () => {
    const d = fixture({
      kind: 'DFA',
      alphabet: 'ab',
      states: ['q0', 'q1', 'q2', 'q3', 'f'],
      start: 'q0',
      accepting: ['f'],
      edges: [
        ['q0', 'a', 'q1'],
        ['q0', 'b', 'q2'],
        ['q1', 'a', 'f'],
        ['q1', 'b', 'q3'],
        ['q2', 'a', 'q3'],
        ['q2', 'b', 'f'],
        ['q3', 'a', 'q3'],
        ['q3', 'b', 'q3'],
        ['f', 'a', 'f'],
        ['f', 'b', 'f'],
      ],
    });
    const first = minimize(d).steps.find((s) => s.phase === 'split') as MinimizeStep;
    expect(first.split?.parts).toHaveLength(3);
    expect(first.explanation).toMatch(/splits into \{[^}]*\}, \{[^}]*\} and \{[^}]*\}$/);
  });

  it('places merged states at the centroid', () => {
    const { result } = minimize(redundant);
    const merged = result.states.find((s) => s.label === '{q1,q2}');
    expect(merged?.x).toBe(150);
    expect(merged?.y).toBe(0);
    expect(result.start).toBe(result.states.find((s) => s.label === 'q0')?.id);
  });

  it('property: same language and no more states than the trimmed, completed input', () =>
    fc.assert(
      fc.property(arbDfa(), arbWord(), (d, w) => {
        const trimmed = completeWithDeadState(removeUnreachable(d).automaton).automaton;
        const { result } = minimize(d);
        return (
          accepts(result, w) === accepts(d, w) && result.states.length <= trimmed.states.length
        );
      }),
    ));

  it('property: accepts exactly the same words up to length 6', () =>
    fc.assert(
      fc.property(arbDfa(), (d) => {
        const { result } = minimize(d);
        return wordsUpTo(['a', 'b'], 6).every((w) => accepts(result, w) === accepts(d, w));
      }),
    ));

  it('property: minimal (no two result states are equivalent)', () =>
    fc.assert(
      fc.property(arbDfa(), (d) => {
        const { result } = minimize(d);
        // Distinct states of an n-state DFA, if distinguishable, differ on a word shorter than n.
        const words = wordsUpTo(result.alphabet, result.states.length);
        const from = (p: string, w: string): boolean => accepts({ ...result, start: p }, w);
        return result.states.every((p, i) =>
          result.states
            .slice(i + 1)
            .every((q) => words.some((w) => from(p.id, w) !== from(q.id, w))),
        );
      }),
    ));

  it('property: idempotent (state count)', () =>
    fc.assert(
      fc.property(arbDfa(), (d) => {
        const once = minimize(d).result;
        return minimize(once).result.states.length === once.states.length;
      }),
    ));
});
