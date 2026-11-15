import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { accepts, isComplete } from './analysis';
import {
  canConvert,
  MAX_DFA_STATES,
  START_GAP,
  subsetConstruction,
  withSingleStart,
} from './subset';
import { arbNfa, arbWord } from './testing/arbitraries';
import { fixture, nthFromEnd } from './testing/fixtures';
import { hasErrors, validate } from './validate';

const endsInAb = fixture({
  kind: 'NFA',
  alphabet: 'ab',
  states: ['q0', 'q1', 'q2'],
  start: 'q0',
  accepting: ['q2'],
  edges: [
    ['q0', 'a,b', 'q0'],
    ['q0', 'a', 'q1'],
    ['q1', 'b', 'q2'],
  ],
});

const evenZeros = fixture({
  kind: 'DFA',
  alphabet: '01',
  states: ['even', 'odd'],
  start: 'even',
  accepting: ['even'],
  edges: [
    ['even', '0', 'odd'],
    ['odd', '0', 'even'],
  ],
});

describe('subsetConstruction', () => {
  it('converts the textbook "ends in ab" NFA', () => {
    const { result, steps } = subsetConstruction(endsInAb);
    expect(result.kind).toBe('DFA');
    expect(result.name).toBe('fixture → DFA');
    expect(result.states.map((s) => s.label).sort()).toEqual(['{q0,q1}', '{q0,q2}', '{q0}']);
    expect(steps[0]?.phase).toBe('init');
    expect(steps[0]?.explanation).toBe('Start state: {q0}');
    expect(steps.at(-1)?.phase).toBe('done');
    expect(steps.at(-1)?.explanation).toBe('Done: 3 DFA states');
    expect(steps.filter((s) => s.phase === 'expand')).toHaveLength(3 * 2);
    expect(steps[1]?.explanation).toBe("{q0} on 'a': move = {q0, q1} → new state {q0,q1}");
    expect(result.states.every((s) => s.x === 0 && s.y === 0)).toBe(true);
  });

  it('stops when the DFA would have more than 64 states', () => {
    expect(MAX_DFA_STATES).toBe(64);
    expect(() => subsetConstruction(nthFromEnd(7))).toThrow(
      'Conversion stopped: the DFA would have more than 64 states',
    );
  });

  it('converts an NFA whose DFA has exactly 64 states', () => {
    expect(subsetConstruction(nthFromEnd(6)).result.states).toHaveLength(64);
  });

  it('adds an explicit ∅ dead state when needed', () => {
    const nfa = fixture({
      kind: 'NFA',
      alphabet: 'ab',
      states: ['q0', 'q1'],
      start: 'q0',
      accepting: ['q1'],
      edges: [['q0', 'a', 'q1']],
    });
    const { result, steps } = subsetConstruction(nfa);
    const dead = result.states.find((s) => s.label === '∅');
    expect(dead).toBeDefined();
    const loop = result.transitions.find((t) => t.from === dead?.id && t.to === dead?.id);
    expect(loop?.symbols.sort()).toEqual(['a', 'b']);
    expect(steps.some((s) => s.explanation.includes('→ existing state ∅'))).toBe(true);
    expect(steps.some((s) => s.explanation.includes('move = ∅ → new state ∅'))).toBe(true);
  });

  it('revealedStates grows monotonically and ends with all result states', () => {
    const { result, steps } = subsetConstruction(endsInAb);
    let prev = 0;
    for (const s of steps) {
      expect(s.revealedStates.length).toBeGreaterThanOrEqual(prev);
      prev = s.revealedStates.length;
    }
    const last = steps.at(-1);
    expect([...(last?.revealedStates ?? [])].sort()).toEqual(result.states.map((s) => s.id).sort());
    expect([...(last?.revealedTransitions ?? [])].sort()).toEqual(
      result.transitions.map((t) => t.id).sort(),
    );
    expect(steps[0]?.revealedStates).toEqual(result.starts);
    expect(steps[0]?.dfaFocus).toEqual({ states: result.starts });
    expect(last?.dfaFocus).toEqual({});
  });

  it('marks reuse vs new correctly', () => {
    const { steps } = subsetConstruction(endsInAb);
    const expands = steps.filter((s) => s.phase === 'expand');
    expect(expands.filter((s) => s.isNew)).toHaveLength(2);
    expect(expands.filter((s) => s.isNew === false)).toHaveLength(4);
    expect(expands[0]?.focus.transitions).toEqual(['q0->q0', 'q0->q1']);
  });

  it('handles ε-cycles', () => {
    const nfa = fixture({
      kind: 'NFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      start: 'q0',
      accepting: ['q1'],
      edges: [
        ['q0', 'ε', 'q1'],
        ['q1', 'ε', 'q0'],
        ['q1', 'a', 'q1'],
      ],
    });
    const { result, steps } = subsetConstruction(nfa);
    expect(result.states.map((s) => s.label)).toEqual(['{q0,q1}']);
    expect(steps[0]?.explanation).toBe('Start state: ε-closure({q0}) = {q0, q1}');
    // With ε-arrows, each step names the closure too.
    expect(steps[1]?.explanation).toBe(
      "{q0, q1} on 'a': move = {q1}, ε-closure = {q0, q1} → existing state {q0,q1}",
    );
    expect(accepts(result, 'aa')).toBe(true);
  });

  it('canConvert rejects DFAs, missing start and errors', () => {
    expect(canConvert(evenZeros)).toBe('Already a DFA: Convert to DFA turns an NFA into one');
    expect(canConvert({ ...endsInAb, starts: [] })).toBe('Set a start state first');
    expect(canConvert({ ...endsInAb, alphabet: ['a'] })).toBe(
      'Fix the errors in the automaton first',
    );
    expect(canConvert(endsInAb)).toBeNull();
    expect(() => subsetConstruction(evenZeros)).toThrow(
      'Already a DFA: Convert to DFA turns an NFA into one',
    );
  });

  it('property: result is a valid complete DFA accepting the same language', () =>
    fc.assert(
      fc.property(arbNfa(), arbWord(), (n, w) => {
        const { result } = subsetConstruction(n);
        return (
          !hasErrors(validate(result)) && isComplete(result) && accepts(result, w) === accepts(n, w)
        );
      }),
    ));
});

describe('several start states', () => {
  const twoStarts = fixture({
    kind: 'NFA',
    alphabet: 'ab',
    states: ['q0', 'q1', 'q2'],
    starts: ['q0', 'q2'],
    accepting: ['q1'],
    edges: [
      ['q0', 'a', 'q1'],
      ['q2', 'b', 'q1'],
    ],
  });

  it('withSingleStart adds q_s with ε-edges to the old starts, left of them', () => {
    const { nfa, added } = withSingleStart(twoStarts);
    const s = nfa.states.find((x) => x.id === added);
    expect(s?.label).toBe('q_s');
    expect(nfa.starts).toEqual([added]);
    // The leftmost old start, q0, is at x 0; both old starts are at y 0.
    expect(s?.x).toBe(0 - START_GAP);
    expect(s?.y).toBe(0);
    expect(nfa.transitions.filter((t) => t.from === added).map((t) => [t.to, t.symbols])).toEqual([
      ['q0', ['ε']],
      ['q2', ['ε']],
    ]);
    const single = fixture({ kind: 'NFA', alphabet: 'a', states: ['q0'], start: 'q0' });
    expect(withSingleStart(single).added).toBeNull();
  });

  it("picks q_s' when q_s is taken", () => {
    const taken = {
      ...twoStarts,
      states: twoStarts.states.map((s, i) => (i === 1 ? { ...s, label: 'q_s' } : s)),
    };
    expect(withSingleStart(taken).nfa.states.at(-1)?.label).toBe("q_s'");
  });

  it('a multi-start conversion opens with the starts step on the extended NFA', () => {
    const t = subsetConstruction(twoStarts);
    expect(t.steps[0]).toMatchObject({
      phase: 'starts',
      revealedStates: [],
      explanation: 'Several start states: add a new start state q_s with ε-transitions to {q0, q2}',
    });
    expect(t.source.states).toHaveLength(4);
    expect(t.steps[1]?.phase).toBe('init');
    // The saved NFA is untouched.
    expect(twoStarts.states).toHaveLength(3);
  });
});
