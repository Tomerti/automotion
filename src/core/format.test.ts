import { describe, expect, it } from 'vitest';
import { formatSet, mergedNote, withSuffix } from './format';
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

describe('mergedNote', () => {
  it('says what a minimized state stands for, subscripts in Unicode', () => {
    const s = { id: 'x', label: 'A', x: 0, y: 0, mergedFrom: ['q_0', 'q_1', 'q_2'] };
    expect(mergedNote(s)).toBe('A = {q₀, q₁, q₂}');
    expect(mergedNote({ ...s, mergedFrom: ['{q_0,q_2}', '{q_1}'] })).toBe('A = {{q₀,q₂}, {q₁}}');
  });
  it('is null for a state without one', () => {
    expect(mergedNote({ id: 'x', label: 'q0', x: 0, y: 0 })).toBeNull();
    expect(mergedNote({ id: 'x', label: 'q0', x: 0, y: 0, mergedFrom: [] })).toBeNull();
  });
});
