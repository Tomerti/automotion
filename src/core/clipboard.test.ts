import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { clipCenter, copyStates, internalTransitions, pasteClip, uniqueLabel } from './clipboard';
import type { Automaton } from './model';
import { arbDfa, arbNfa } from './testing/arbitraries';
import { fixture } from './testing/fixtures';
import { ignoringIncomplete, validate } from './validate';

/** q0 -a-> q1 -a-> q2 (accepting), every state -b-> q0, q2 loops on a; q0 is the start. */
const chain = (): Automaton => {
  const a = fixture({
    kind: 'DFA',
    alphabet: 'ab',
    states: ['q0', 'q1', 'q2'],
    start: 'q0',
    accepting: ['q2'],
    edges: [
      ['q0', 'a', 'q1'],
      ['q1', 'a', 'q2'],
      ['q2', 'a', 'q2'],
      ['q0', 'b', 'q0'],
      ['q1', 'b', 'q0'],
      ['q2', 'b', 'q0'],
    ],
  });
  return {
    ...a,
    transitions: a.transitions.map((t) =>
      t.id === 'q1->q2' ? { ...t, bend: 30 } : t.id === 'q2->q2' ? { ...t, loopAngle: 1 } : t,
    ),
  };
};

const labelled = (a: Automaton, label: string) => a.states.find((s) => s.label === label);
const edgeBetween = (a: Automaton, from: string, to: string) => {
  const f = labelled(a, from)?.id;
  const t = labelled(a, to)?.id;
  return a.transitions.find((x) => x.from === f && x.to === t);
};

describe('copyStates', () => {
  it('takes the states, the arrows between them and the arrows out of them', () => {
    const clip = copyStates(chain(), ['q1', 'q2']);
    expect(clip?.states.map((s) => s.id)).toEqual(['q1', 'q2']);
    expect(clip?.accepting).toEqual(['q2']);
    expect(clip?.transitions.map((t) => t.id).sort()).toEqual(
      ['q1->q0', 'q1->q2', 'q2->q0', 'q2->q2'].sort(),
    );
  });

  it('leaves out arrows into the copied states from outside', () => {
    const clip = copyStates(chain(), ['q1', 'q2']);
    expect(clip?.transitions.some((t) => t.id === 'q0->q1')).toBe(false);
  });

  it('ignores ids that are not states and returns null when none is', () => {
    expect(copyStates(chain(), ['q1', 'gone'])?.states.map((s) => s.id)).toEqual(['q1']);
    expect(copyStates(chain(), ['gone'])).toBeNull();
    expect(copyStates(chain(), [])).toBeNull();
  });

  it('keeps the automaton order of the states, not the selection order', () => {
    expect(copyStates(chain(), ['q2', 'q0'])?.states.map((s) => s.id)).toEqual(['q0', 'q2']);
  });
});

describe('uniqueLabel', () => {
  it('keeps a free label and adds primes until it is unique', () => {
    expect(uniqueLabel('q_1', new Set(['q_0']))).toBe('q_1');
    expect(uniqueLabel('q_1', new Set(['q_1']))).toBe("q_1'");
    expect(uniqueLabel('q_1', new Set(['q_1', "q_1'"]))).toBe("q_1''");
  });
});

describe('pasteClip', () => {
  it('adds copies with fresh ids, moved by the offset, named with a prime', () => {
    const a = chain();
    const clip = copyStates(a, ['q1', 'q2'])!;
    const { automaton: b, stateIds } = pasteClip(a, clip, { x: 10, y: 20 });
    expect(b.states).toHaveLength(5);
    expect(stateIds).toHaveLength(2);
    expect(stateIds.some((id) => a.states.some((s) => s.id === id))).toBe(false);
    expect(labelled(b, "q1'")).toMatchObject({ x: 110, y: 20 });
    expect(labelled(b, "q2'")).toMatchObject({ x: 210, y: 20 });
    // The originals are untouched.
    expect(b.states.slice(0, 3)).toEqual(a.states);
    expect(b.transitions.slice(0, a.transitions.length)).toEqual(a.transitions);
  });

  it('copies accepting but not start', () => {
    const a = chain();
    const { automaton: b } = pasteClip(a, copyStates(a, ['q0', 'q2'])!, { x: 0, y: 50 });
    expect(b.accepting).toEqual(['q2', labelled(b, "q2'")?.id]);
    expect(b.starts).toEqual(['q0']);
  });

  it('copies arrows inside the chain with their symbols, bends and loop angles', () => {
    const a = chain();
    const { automaton: b, transitionIds } = pasteClip(a, copyStates(a, ['q1', 'q2'])!, {
      x: 0,
      y: 50,
    });
    expect(edgeBetween(b, "q1'", "q2'")).toMatchObject({ symbols: ['a'], bend: 30 });
    expect(edgeBetween(b, "q2'", "q2'")).toMatchObject({ symbols: ['a'], loopAngle: 1 });
    expect(transitionIds).toHaveLength(4);
    expect(new Set(b.transitions.map((t) => t.id)).size).toBe(b.transitions.length);
  });

  it('keeps arrows to outside states that exist, and adds none into the copies', () => {
    const a = chain();
    const { automaton: b } = pasteClip(a, copyStates(a, ['q1', 'q2'])!, { x: 0, y: 50 });
    expect(edgeBetween(b, "q1'", 'q0')?.symbols).toEqual(['b']);
    expect(edgeBetween(b, "q2'", 'q0')?.symbols).toEqual(['b']);
    expect(edgeBetween(b, 'q0', "q1'")).toBeUndefined();
  });

  it('drops arrows to outside states the target does not have', () => {
    const clip = copyStates(chain(), ['q1', 'q2'])!;
    const other = fixture({ kind: 'DFA', alphabet: '', states: ['p'], name: 'other' });
    const { automaton: b } = pasteClip(other, clip, { x: 0, y: 0 });
    expect(b.states.map((s) => s.label)).toEqual(['p', 'q1', 'q2']);
    expect(b.transitions).toHaveLength(2);
    expect(edgeBetween(b, 'q1', 'q2')).toBeDefined();
    expect(edgeBetween(b, 'q2', 'q2')).toBeDefined();
  });

  it('turns a DFA into an NFA when an ε-arrow is pasted into it', () => {
    const nfa = fixture({
      kind: 'NFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      edges: [['q0', 'ε', 'q1']],
    });
    const dfa = fixture({ kind: 'DFA', alphabet: '', states: [], name: 'd' });
    const result = pasteClip(dfa, copyStates(nfa, ['q0', 'q1'])!, { x: 0, y: 0 });
    expect(result.promoted).toBe(true);
    expect(result.automaton.kind).toBe('NFA');
    expect(pasteClip(nfa, copyStates(nfa, ['q0', 'q1'])!, { x: 0, y: 0 }).promoted).toBe(false);
  });

  it('never repeats a label, an id or a (from, to) pair', () => {
    fc.assert(
      fc.property(
        fc.oneof(arbDfa(), arbNfa()),
        fc.array(fc.nat({ max: 5 }), { minLength: 1, maxLength: 6 }),
        fc.integer({ min: 1, max: 3 }),
        (a, picks, times) => {
          const ids = picks.map((i) => `q${i}`);
          const clip = copyStates(a, ids);
          if (!clip) return;
          let b = a;
          for (let i = 0; i < times; i++) b = pasteClip(b, clip, { x: 40, y: 40 }).automaton;
          const labels = b.states.map((s) => s.label);
          expect(new Set(labels).size).toBe(labels.length);
          const stateIds = b.states.map((s) => s.id);
          expect(new Set(stateIds).size).toBe(stateIds.length);
          const pairs = b.transitions.map((t) => `${t.from}>${t.to}`);
          expect(new Set(pairs).size).toBe(pairs.length);
          for (const t of b.transitions) {
            expect(stateIds).toContain(t.from);
            expect(stateIds).toContain(t.to);
          }
          expect(b.states).toHaveLength(a.states.length + times * clip.states.length);
          // Copies add no errors (beyond missing transitions): a valid DFA stays deterministic.
          const errors = (x: Automaton) =>
            ignoringIncomplete(validate(x)).filter((i) => i.severity === 'error');
          if (errors(a).length === 0) expect(errors(b)).toEqual([]);
        },
      ),
    );
  });
});

describe('internalTransitions', () => {
  it('lists the arrows whose both ends are among the states', () => {
    expect(internalTransitions(chain(), ['q1', 'q2']).sort()).toEqual(['q1->q2', 'q2->q2']);
    expect(internalTransitions(chain(), ['q0'])).toEqual(['q0->q0']);
  });
});

describe('clipCenter', () => {
  it('is the centre of the copied states’ bounding box', () => {
    expect(clipCenter(copyStates(chain(), ['q0', 'q2'])!)).toEqual({ x: 100, y: 0 });
  });
});

describe('pasting a minimized state', () => {
  it('keeps what it stands for (mergedFrom)', () => {
    const a = chain();
    const merged: Automaton = {
      ...a,
      states: a.states.map((s) => (s.id === 'q0' ? { ...s, mergedFrom: ['p', 'r'] } : s)),
    };
    const { automaton: b, stateIds } = pasteClip(merged, copyStates(merged, ['q0'])!, {
      x: 0,
      y: 50,
    });
    expect(b.states.find((s) => s.id === stateIds[0])?.mergedFrom).toEqual(['p', 'r']);
  });
});
