import { describe, expect, it } from 'vitest';
import { labelDisplayText, parseLabel } from './label';

describe('parseLabel', () => {
  it('keeps plain labels as one segment', () => {
    expect(parseLabel('even')).toEqual([{ text: 'even', sub: false }]);
  });

  it('reads a one-character subscript', () => {
    expect(parseLabel('q_1')).toEqual([
      { text: 'q', sub: false },
      { text: '1', sub: true },
    ]);
  });

  it('reads a braced subscript and text after it', () => {
    expect(parseLabel('q_{12}a')).toEqual([
      { text: 'q', sub: false },
      { text: '12', sub: true },
      { text: 'a', sub: false },
    ]);
  });

  it('leaves a trailing or empty-braced underscore literal', () => {
    expect(parseLabel('q_')).toEqual([{ text: 'q_', sub: false }]);
    expect(parseLabel('q_{}')).toEqual([{ text: 'q_{}', sub: false }]);
  });

  it('gives the rendered text', () => {
    expect(labelDisplayText('q_{10}')).toBe('q10');
  });
});
