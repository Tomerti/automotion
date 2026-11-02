import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { accepts } from './analysis';
import { removeState } from './edit';
import { canRun, readWord, runWord } from './run';
import { arbNfa, arbWord } from './testing/arbitraries';
import { fixture } from './testing/fixtures';

const evenZeros = fixture({
  kind: 'DFA',
  alphabet: '01',
  states: ['even', 'odd'],
  start: 'even',
  accepting: ['even'],
  edges: [
    ['even', '0', 'odd'],
    ['odd', '0', 'even'],
    ['even', '1', 'even'],
    ['odd', '1', 'odd'],
  ],
});

const abDfa = fixture({
  kind: 'DFA',
  alphabet: 'ab',
  states: ['q0', 'q1'],
  start: 'q0',
  accepting: ['q1'],
  edges: [['q0', 'a', 'q1']],
});

/** `abDfa` as an NFA: a DFA must be complete to run, so only an NFA run can get stuck. */
const abNfa = { ...abDfa, kind: 'NFA' as const };

const epsNfa = fixture({
  kind: 'NFA',
  alphabet: 'a',
  states: ['q0', 'q1', 'q2'],
  start: 'q0',
  accepting: ['q2'],
  edges: [
    ['q0', 'ε', 'q1'],
    ['q1', 'a', 'q2'],
  ],
});

describe('runWord', () => {
  it('DFA run on "00" for even-zeros', () => {
    const t = runWord(evenZeros, '00');
    expect(t.kind).toBe('run');
    expect(t.steps.map((s) => s.phase)).toEqual(['start', 'read', 'read', 'verdict']);
    expect(t.accepted).toBe(true);
    expect(t.steps[0]?.explanation).toBe('Start: {even}');
    expect(t.steps[1]?.explanation).toBe("Read '0': {even} → {odd}");
    expect(t.steps[3]?.explanation).toBe('Accept: {even} contains an accepting state');
  });

  it('empty word: start then verdict', () => {
    const t = runWord(evenZeros, '');
    expect(t.steps.map((s) => s.phase)).toEqual(['start', 'verdict']);
    expect(t.steps[0]).toMatchObject({ position: 0, before: [], active: ['even'] });
    expect(t.accepted).toBe(true);
    const r = runWord(abNfa, '');
    expect(r.accepted).toBe(false);
    expect(r.steps[1]?.explanation).toBe('Reject: no accepting state in {q0}');
  });

  it('NFA run shows ε-closure as its own step', () => {
    const t = runWord(epsNfa, 'a');
    expect(t.steps.map((s) => s.phase)).toEqual(['start', 'closure', 'read', 'verdict']);
    expect(t.steps[0]?.explanation).toBe('Start: {q0}');
    expect(t.steps[1]).toMatchObject({
      explanation: 'ε-closure: {q0} → {q0, q1}',
      before: ['q0'],
      active: ['q0', 'q1'],
      taken: ['q0->q1'],
      position: 0,
    });
    expect(t.steps[2]).toMatchObject({ symbol: 'a', position: 1, taken: ['q1->q2'] });
    expect(t.accepted).toBe(true);
  });

  it('stuck run ends with a stuck reject step', () => {
    const t = runWord(abNfa, 'ab');
    expect(t.steps.at(-1)).toMatchObject({
      phase: 'stuck',
      verdict: 'reject',
      active: [],
      before: ['q1'],
      symbol: 'b',
      position: 1,
      taken: [],
      explanation: "Stuck on 'b': no transition from {q1} → reject",
    });
    expect(t.accepted).toBe(false);
  });

  it('records the transitions taken and focus', () => {
    const t = runWord(evenZeros, '01');
    expect(t.steps[1]?.taken).toEqual(['even->odd']);
    expect(t.steps[1]?.focus).toEqual({ states: ['odd'], transitions: ['even->odd'] });
    expect(t.steps[2]?.taken).toEqual(['odd->odd']);
  });

  it('ε-cycle run terminates', () => {
    const cyc = fixture({
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
    const t = runWord(cyc, 'aa');
    expect(t.accepted).toBe(true);
    expect(t.steps.at(-1)?.phase).toBe('verdict');
  });

  it('throws the canRun reason', () => {
    expect(() => runWord(abNfa, 'c')).toThrow("'c' is not in the alphabet {a, b}");
  });

  it('property: verdict equals accepts()', () => {
    fc.assert(fc.property(arbNfa(), arbWord(), (a, w) => runWord(a, w).accepted === accepts(a, w)));
  });
});

describe('readWord', () => {
  it('reads ε and \\eps as the empty word', () => {
    expect(readWord('ε')).toBe('');
    expect(readWord('\\eps')).toBe('');
    expect(readWord('aεb')).toBe('ab');
    expect(readWord('a\\epsb')).toBe('ab');
    expect(readWord('0010')).toBe('0010');
  });
});

describe('canRun', () => {
  it('needs a start state (e.g. after deleting it)', () => {
    expect(canRun(removeState(evenZeros, 'even'), '0')).toBe('Set a start state first');
  });
  it('names the first bad character', () => {
    expect(canRun(abNfa, 'ab c')).toBe("' ' is not in the alphabet {a, b}");
    expect(canRun(abNfa, 'ab')).toBeNull();
  });
  it('refuses an incomplete DFA', () => {
    expect(canRun(abDfa, 'a')).toBe(
      'Complete the DFA first: every state needs a transition on every symbol',
    );
    expect(() => runWord(abDfa, 'a')).toThrow('Complete the DFA first');
  });
  it('prints an empty alphabet as {}', () => {
    const a = fixture({ kind: 'NFA', alphabet: '', states: ['q0'], start: 'q0' });
    expect(canRun(a, 'x')).toBe("'x' is not in the alphabet {}");
  });
  it('rejects automata with errors', () => {
    const bad = fixture({
      kind: 'DFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      start: 'q0',
      edges: [
        ['q0', 'a', 'q0'],
        ['q0', 'a', 'q1'],
      ],
    });
    expect(canRun(bad, 'a')).toBe('Fix the errors in the automaton first');
  });
});

describe('several start states', () => {
  it('a multi-start NFA starts in every start state and accepts via any of them', () => {
    const n = fixture({
      kind: 'NFA',
      alphabet: 'ab',
      states: ['q0', 'q1', 'q2'],
      starts: ['q0', 'q1'],
      accepting: ['q2'],
      edges: [['q1', 'b', 'q2']],
    });
    const t = runWord(n, 'b');
    expect(t.steps[0]?.active).toEqual(['q0', 'q1']);
    expect(t.accepted).toBe(true);
    expect(accepts(n, 'b')).toBe(true);
  });

  it('overlapping start closures list each state once (Review Focus 4)', () => {
    const n = fixture({
      kind: 'NFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      starts: ['q0', 'q1'],
      edges: [['q0', 'ε', 'q1']],
    });
    const active = runWord(n, '').steps.at(-1)?.active ?? [];
    expect(new Set(active).size).toBe(active.length);
  });
});
