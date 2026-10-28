import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  accepts,
  completeWithDeadState,
  epsilonClosure,
  isComplete,
  move,
  reachableStates,
  removeUnreachable,
  transitionsTaken,
} from './analysis';
import type { Automaton } from './model';
import { arbDfa, arbNfa, arbWord } from './testing/arbitraries';
import { fixture } from './testing/fixtures';
import { hasErrors, validate } from './validate';

const chain = fixture({
  kind: 'NFA',
  alphabet: 'a',
  states: ['q0', 'q1', 'q2'],
  start: 'q0',
  edges: [
    ['q0', 'ε', 'q1'],
    ['q1', 'ε', 'q2'],
  ],
});
const epsCycle = fixture({
  kind: 'NFA',
  alphabet: 'a',
  states: ['q0', 'q1'],
  start: 'q0',
  accepting: ['q1'],
  edges: [
    ['q0', 'ε', 'q1'],
    ['q1', 'ε', 'q0'],
  ],
});
const evenZeros = fixture({
  kind: 'DFA',
  alphabet: '01',
  states: ['e', 'o'],
  start: 'e',
  accepting: ['e'],
  edges: [
    ['e', '0', 'o'],
    ['o', '0', 'e'],
    ['e', '1', 'e'],
    ['o', '1', 'o'],
  ],
});
const partialDfa = fixture({
  kind: 'DFA',
  alphabet: 'ab',
  states: ['q0', 'q1'],
  start: 'q0',
  accepting: ['q1'],
  edges: [['q0', 'a', 'q1']],
});

describe('closure and move', () => {
  it('ε-closure follows chains', () => {
    expect(epsilonClosure(chain, ['q0'])).toEqual(['q0', 'q1', 'q2']);
  });
  it('ε-closure terminates on an ε-cycle', () => {
    expect(epsilonClosure(epsCycle, ['q0'])).toEqual(['q0', 'q1']);
  });
  it('move and transitionsTaken follow a symbol without closure', () => {
    expect(move(evenZeros, ['e'], '0')).toEqual(['o']);
    expect(move(chain, ['q0'], 'a')).toEqual([]);
    expect(transitionsTaken(evenZeros, ['e', 'o'], '1')).toEqual(['e->e', 'o->o']);
  });
});

describe('reachability', () => {
  const a = fixture({
    kind: 'DFA',
    alphabet: 'a',
    states: ['q0', 'q1', 'q2'],
    start: 'q0',
    accepting: ['q1', 'q2'],
    edges: [
      ['q0', 'a', 'q1'],
      ['q2', 'a', 'q1'],
    ],
  });
  it('removeUnreachable reports removed states', () => {
    expect(reachableStates(a)).toEqual(['q0', 'q1']);
    const { automaton, removed } = removeUnreachable(a);
    expect(removed).toEqual(['q2']);
    expect(automaton.states.map((s) => s.id)).toEqual(['q0', 'q1']);
    expect(automaton.accepting).toEqual(['q1']);
    expect(automaton.transitions.map((t) => t.id)).toEqual(['q0->q1']);
  });
  it('with no start there is nothing reachable and nothing removed', () => {
    const noStart = { ...a, start: null };
    expect(reachableStates(noStart)).toEqual([]);
    expect(removeUnreachable(noStart)).toEqual({ automaton: noStart, removed: [] });
  });
});

describe('completeWithDeadState', () => {
  it('fills gaps and loops the dead state', () => {
    const { automaton, deadState } = completeWithDeadState(partialDfa);
    expect(isComplete(partialDfa)).toBe(false);
    expect(isComplete(automaton)).toBe(true);
    const dead = automaton.states.find((s) => s.id === deadState);
    expect(dead?.label).toBe('∅');
    expect(dead?.x).toBe(220);
    expect(hasErrors(validate(automaton))).toBe(false);
  });
  it('returns null for a complete DFA', () => {
    expect(completeWithDeadState(evenZeros)).toEqual({ automaton: evenZeros, deadState: null });
  });
  it('returns null for no states or an empty alphabet', () => {
    const empty = { ...partialDfa, states: [], start: null, accepting: [], transitions: [] };
    expect(completeWithDeadState(empty).deadState).toBeNull();
    expect(completeWithDeadState({ ...partialDfa, alphabet: [] }).deadState).toBeNull();
  });
  it('picks another label when ∅ is taken', () => {
    const taken = {
      ...partialDfa,
      states: partialDfa.states.map((s, i) => (i === 0 ? { ...s, label: '∅' } : s)),
    };
    const { automaton, deadState } = completeWithDeadState(taken);
    expect(automaton.states.find((s) => s.id === deadState)?.label).toBe('q0');
  });
});

describe('accepts', () => {
  it('DFA even-zeros', () => {
    expect(accepts(evenZeros, '00')).toBe(true);
    expect(accepts(evenZeros, '0')).toBe(false);
    expect(accepts(evenZeros, '')).toBe(true);
  });
  it('partial DFA rejects on a missing transition', () => {
    expect(accepts(partialDfa, 'a')).toBe(true);
    expect(accepts(partialDfa, 'b')).toBe(false);
    expect(accepts(partialDfa, 'aa')).toBe(false);
  });
  it('terminates on an ε-cycle', () => {
    expect(accepts(epsCycle, '')).toBe(true);
  });
  it('rejects with no start', () => {
    expect(accepts({ ...evenZeros, start: null }, '')).toBe(false);
  });
});

describe('arbitraries', () => {
  it('produce valid automata', () => {
    fc.assert(fc.property(arbNfa(), (a) => !hasErrors(validate(a))));
    fc.assert(fc.property(arbDfa(), (a) => !hasErrors(validate(a))));
  });
  it('respect their options', () => {
    fc.assert(
      fc.property(arbDfa({ alphabet: 'xyz', maxStates: 3 }), arbWord('xyz', 4), (a, w) => {
        expect(a.kind).toBe('DFA');
        expect(a.states.length).toBeLessThanOrEqual(3);
        expect(a.transitions.every((t) => !t.symbols.includes('ε'))).toBe(true);
        expect(w.length).toBeLessThanOrEqual(4);
        expect(/^[xyz]*$/.test(w)).toBe(true);
      }),
    );
  });
  const targetCounts = (a: Automaton): number[] => {
    const counts = new Map<string, number>();
    for (const t of a.transitions) {
      for (const s of t.symbols)
        counts.set(`${t.from}|${s}`, (counts.get(`${t.from}|${s}`) ?? 0) + 1);
    }
    return [...counts.values()];
  };
  const hasEps = (a: Automaton): boolean => a.transitions.some((t) => t.symbols.includes('ε'));
  it('arbDfa is deterministic and ε-free', () => {
    fc.assert(
      fc.property(arbDfa(), (a) => {
        expect(targetCounts(a).every((n) => n === 1)).toBe(true);
        expect(hasEps(a)).toBe(false);
      }),
    );
  });
  it('arbNfa generates ε and nondeterminism, and no ε when disabled', () => {
    const samples = fc.sample(arbNfa(), { numRuns: 200, seed: 42 });
    expect(samples.some(hasEps)).toBe(true);
    expect(samples.some((a) => targetCounts(a).some((n) => n > 1))).toBe(true);
    fc.assert(fc.property(arbNfa({ epsilon: false }), (a) => !hasEps(a)));
  });
  it('completing any DFA keeps its language on sampled words', () => {
    fc.assert(
      fc.property(arbDfa(), arbWord(), (a, w) => {
        const { automaton } = completeWithDeadState(a);
        expect(isComplete(automaton)).toBe(true);
        expect(accepts(automaton, w)).toBe(accepts(a, w));
      }),
    );
  });
});
