import { describe, expect, it } from 'vitest';
import { hasErrors, ignoringIncomplete, validate } from './validate';
import { fixture } from './testing/fixtures';

const dfa = () =>
  fixture({
    kind: 'DFA',
    alphabet: 'ab',
    states: ['q0', 'q1'],
    start: 'q0',
    accepting: ['q1'],
    edges: [
      ['q0', 'a', 'q1'],
      ['q0', 'b', 'q0'],
      ['q1', 'ab', 'q1'],
    ],
  });

describe('validate', () => {
  it('a complete, reachable DFA has no issues', () => expect(validate(dfa())).toEqual([]));

  it('flags DFA nondeterminism on the state', () => {
    const a = fixture({
      kind: 'DFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      start: 'q0',
      accepting: ['q1'],
      edges: [
        ['q0', 'a', 'q0'],
        ['q0', 'a', 'q1'],
        ['q1', 'a', 'q1'],
      ],
    });
    expect(validate(a)).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        stateId: 'q0',
        message: "q0 has more than one transition on 'a'",
      }),
    );
  });

  it('flags ε in a DFA but not in an NFA', () => {
    const base = {
      alphabet: 'a',
      states: ['q0', 'q1'],
      start: 'q0',
      accepting: ['q1'],
      edges: [['q0', 'ε', 'q1']] as [string, string, string][],
    };
    const issues = validate(fixture({ kind: 'DFA', ...base }));
    expect(issues).toContainEqual({
      severity: 'error',
      message: "A DFA can't have ε-transitions",
      transitionId: 'q0->q1',
    });
    expect(issues.some((i) => i.message.includes('not in the alphabet'))).toBe(false);
    expect(hasErrors(validate(fixture({ kind: 'NFA', ...base })))).toBe(false);
  });

  it('flags a symbol missing from the alphabet', () => {
    const a = fixture({
      kind: 'NFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      start: 'q0',
      accepting: ['q1'],
      edges: [['q0', 'c', 'q1']],
    });
    expect(validate(a)).toContainEqual({
      severity: 'error',
      message: "'c' is not in the alphabet",
      transitionId: 'q0->q1',
    });
  });

  it('flags a transition to a missing state', () => {
    const a = dfa();
    a.transitions.push({ id: 'x', from: 'q0', to: 'gone', symbols: [] });
    expect(validate(a)).toContainEqual({
      severity: 'error',
      message: 'Transition points to a missing state',
      transitionId: 'x',
    });
  });

  it('flags duplicate labels', () => {
    const a = dfa();
    a.states.push({ id: 'dup', label: 'q0', x: 0, y: 0 });
    expect(validate(a)).toContainEqual(
      expect.objectContaining({ severity: 'error', message: 'Two states are named q0' }),
    );
  });

  it('warns: no start, no accepting, unreachable q2', () => {
    const noStart = validate(
      fixture({ kind: 'NFA', alphabet: 'a', states: ['q0'], accepting: ['q0'] }),
    );
    expect(noStart).toEqual([{ severity: 'warning', message: 'No start state' }]);

    const a = fixture({
      kind: 'DFA',
      alphabet: 'ab',
      states: ['q0', 'q1', 'q2'],
      start: 'q0',
      edges: [['q0', 'a', 'q1']],
    });
    const issues = validate(a);
    const messages = issues.map((i) => i.message);
    expect(messages).toContain('No accepting states');
    expect(messages).toContain('q2 is unreachable');
    expect(issues.filter((i) => i.severity === 'warning').map((i) => i.message)).toEqual([
      'q2 is unreachable',
      'No accepting states',
    ]);
  });

  it('an incomplete DFA is one error naming the first missing transition', () => {
    const a = fixture({
      kind: 'DFA',
      alphabet: 'ab',
      states: ['q0', 'q1', 'q2'],
      start: 'q0',
      edges: [['q0', 'a', 'q1']],
    });
    expect(validate(a).filter((i) => i.code === 'incomplete-dfa')).toEqual([
      {
        severity: 'error',
        code: 'incomplete-dfa',
        message: "DFA is incomplete: no 'b' transition from q0 (and 4 more)",
      },
    ]);
    const oneMissing = fixture({
      kind: 'DFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      start: 'q0',
      edges: [['q0', 'a', 'q1']],
    });
    expect(validate(oneMissing).map((i) => i.message)).toContain(
      "DFA is incomplete: no 'a' transition from q1",
    );
    expect(hasErrors(ignoringIncomplete(validate(oneMissing)))).toBe(false);
    const noTransitions = fixture({ kind: 'DFA', alphabet: '', states: ['q0', 'q1'], start: 'q0' });
    expect(validate(noTransitions)).toContainEqual({
      severity: 'error',
      code: 'incomplete-dfa',
      message: 'DFA is incomplete: it has no transitions yet',
    });
    const blank = fixture({ kind: 'DFA', alphabet: '', states: [] });
    expect(validate(blank).some((i) => i.code === 'incomplete-dfa')).toBe(false);
    const lone = fixture({ kind: 'DFA', alphabet: '', states: ['q0'], start: 'q0' });
    expect(validate(lone).some((i) => i.code === 'incomplete-dfa')).toBe(false);
    expect(validate({ ...oneMissing, kind: 'NFA' }).some((i) => i.severity === 'error')).toBe(
      false,
    );
  });

  it('hasErrors ignores warnings', () => {
    expect(hasErrors([{ severity: 'warning', message: 'w' }])).toBe(false);
    expect(hasErrors([{ severity: 'error', message: 'e' }])).toBe(true);
  });
});

describe('start states', () => {
  it('a DFA with two start states is an error', () => {
    const d = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0', 'q1'], starts: ['q0', 'q1'] });
    expect(validate(d)).toContainEqual(
      expect.objectContaining({ severity: 'error', message: 'A DFA has exactly one start state' }),
    );
  });

  it('states reachable from any start state are not unreachable', () => {
    const n = fixture({ kind: 'NFA', alphabet: 'a', states: ['q0', 'q1'], starts: ['q0', 'q1'] });
    expect(validate(n).some((i) => /unreachable/i.test(i.message))).toBe(false);
  });
});
