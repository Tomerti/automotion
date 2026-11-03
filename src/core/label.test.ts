import { describe, expect, it } from 'vitest';
import { labelBaselineOffset, labelDisplayText, parseLabel } from './label';

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

describe('labelBaselineOffset', () => {
  it('puts the baseline half the ink height below the centre', () => {
    // Capitals and digits: ink from the baseline up to the cap height.
    expect(labelBaselineOffset('H')).toBeCloseTo(0.719 / 2, 3);
    // x-height letters sit lower than capitals, so their baseline goes higher.
    expect(labelBaselineOffset('even')).toBeCloseTo((0.547 - 0.016) / 2, 3);
  });

  it('leaves descenders hanging: `any` centres like `ann`', () => {
    expect(labelBaselineOffset('any')).toBeCloseTo(labelBaselineOffset('ann'), 3);
    expect(labelBaselineOffset('any')).toBeCloseTo((0.547 - 0.016) / 2, 3);
    expect(labelBaselineOffset('q')).toBeCloseTo(labelBaselineOffset('a'), 3);
  });

  it('leaves subscripts hanging too: `q₀` centres its `q` like `a`', () => {
    expect(labelBaselineOffset('q_0')).toBeCloseTo(labelBaselineOffset('a'), 3);
    expect(labelBaselineOffset('q_{12}')).toBe(labelBaselineOffset('q'));
    expect(labelBaselineOffset('q_1x')).toBe(labelBaselineOffset('qx'));
  });

  it('centres a label that is all subscript on the subscript', () => {
    // A 1 is 0.719 tall, set at 0.7 on a baseline lowered by 0.25 em.
    expect(labelBaselineOffset('_1')).toBeCloseTo((0.7 * 0.719 - 0.25 - 0.25) / 2, 3);
  });

  it('counts unknown characters as capitals and an empty label as nothing', () => {
    expect(labelBaselineOffset('Ж')).toBe(labelBaselineOffset('H'));
    expect(labelBaselineOffset('')).toBe(0);
    expect(labelBaselineOffset(' ')).toBe(0);
  });
});
