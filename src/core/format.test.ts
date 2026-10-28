import { describe, expect, it } from 'vitest';
import { formatSet, withSuffix } from './format';
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

describe('formatSet', () => {
  it('formats in state order with labels', () =>
    expect(formatSet(dfa(), ['q1', 'q0'])).toBe('{q0, q1}'));
  it('formats the empty set as ∅', () => expect(formatSet(dfa(), [])).toBe('∅'));
});

describe('withSuffix', () => {
  it('appends the suffix once', () => {
    expect(withSuffix('D', ' (min)')).toBe('D (min)');
    expect(withSuffix('D (min)', ' (min)')).toBe('D (min)');
    expect(withSuffix('N → DFA', ' → DFA')).toBe('N → DFA');
  });
});
