import { describe, expect, it } from 'vitest';
import { STATE_RADIUS } from './geometry';
import { GAP_OFFSET, snapPosition } from './snap';

const R = STATE_RADIUS;
const p = (x: number, y: number) => ({ x, y });

describe('snapPosition: alignment', () => {
  it('snaps each axis to the nearest other state within 8 screen px, with a guide per line', () => {
    const { pos, guides, gaps } = snapPosition(p(205, 6), [p(0, 0)], 1);
    expect(pos).toEqual(p(205, 0));
    expect(guides).toEqual([{ x1: -R, y1: 0, x2: 205 + R, y2: 0 }]);
    expect(gaps).toEqual([]);
    expect(snapPosition(p(5, -4), [p(0, 0)], 1).guides).toHaveLength(2);
  });

  it('measures the tolerance in screen px', () => {
    expect(snapPosition(p(200, 6), [p(0, 0)], 2).pos).toEqual(p(200, 6));
    expect(snapPosition(p(200, 3), [p(0, 0)], 2).pos).toEqual(p(200, 0));
  });

  it('leaves a position far from every line alone', () => {
    expect(snapPosition(p(150, 50), [p(0, 0), p(100, 0)], 1)).toEqual({
      pos: p(150, 50),
      guides: [],
      gaps: [],
    });
  });
});

describe('snapPosition: equal spacing along a row', () => {
  const row = [p(0, 0), p(100, 0)];

  it('extends a row past its last state by the same gap, marking both gaps', () => {
    const { pos, gaps } = snapPosition(p(205, 3), row, 1);
    expect(pos).toEqual(p(200, 0));
    const y = R + GAP_OFFSET;
    expect(gaps).toEqual([
      { x1: R, y1: y, x2: 100 - R, y2: y },
      { x1: 100 + R, y1: y, x2: 200 - R, y2: y },
    ]);
  });

  it('extends a row before its first state', () => {
    expect(snapPosition(p(-96, -2), row, 1).pos).toEqual(p(-100, 0));
  });

  it('snaps to the midpoint between two states', () => {
    const { pos, gaps } = snapPosition(p(150, 0), [p(0, 0), p(300, 0)], 1);
    expect(pos).toEqual(p(150, 0));
    expect(gaps).toHaveLength(2);
  });

  it('does not offer a midpoint the state would not fit in', () => {
    // Halves of 40 are closer than two radii: the states would overlap.
    expect(snapPosition(p(43, 0), [p(0, 0), p(80, 0)], 1).pos).toEqual(p(43, 0));
  });

  it('only counts states on the same row', () => {
    expect(snapPosition(p(205, 3), [p(0, 0), p(100, 1)], 1).gaps).toEqual([]);
  });

  it('needs the state to be on the row (y snapped) first', () => {
    expect(snapPosition(p(203, 30), row, 1)).toMatchObject({ pos: p(203, 30), gaps: [] });
  });

  it('marks every gap in the row that equals the new one', () => {
    const { pos, gaps } = snapPosition(p(498, 0), [p(0, 0), p(100, 0), p(300, 0), p(400, 0)], 1);
    expect(pos).toEqual(p(500, 0));
    // 0–100, 300–400 and 400–500 are 100 apart; 100–300 is not.
    expect(gaps.map((g) => g.x1)).toEqual([R, 300 + R, 400 + R]);
  });

  it('prefers the closer of a column alignment and an equal gap', () => {
    // x = 196 lines up with the state at (196, 200), but 200 (equal gap) is further.
    const others = [...row, p(196, 200)];
    expect(snapPosition(p(197, 2), others, 1).pos).toEqual(p(196, 0));
    expect(snapPosition(p(199, 2), others, 1).pos).toEqual(p(200, 0));
  });
});

describe('snapPosition: equal spacing along a column', () => {
  it('extends a column by the same gap, with markers beside it', () => {
    const { pos, gaps } = snapPosition(p(4, 156), [p(0, 0), p(0, 80)], 1);
    expect(pos).toEqual(p(0, 160));
    const x = R + GAP_OFFSET;
    expect(gaps).toEqual([
      { x1: x, y1: R, x2: x, y2: 80 - R },
      { x1: x, y1: 80 + R, x2: x, y2: 160 - R },
    ]);
  });
});
