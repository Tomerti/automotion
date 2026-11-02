import { describe, expect, it } from 'vitest';
import {
  CURVE_OFFSET,
  HIT_MARGIN,
  STATE_RADIUS,
  bestLoopAngle,
  edgeGeometry,
  hitState,
  labelFontSize,
  labelSideAt,
  labelSideOf,
  selfLoopGeometry,
  snapAngle,
  startArrowGeometry,
  transitionGeometry,
} from './geometry';
import type { State } from '../../core/model';
import { fixture } from '../../core/testing/fixtures';

const O = { x: 0, y: 0 };
const A = { x: 0, y: 0 };
const B = { x: 200, y: 0 };

describe('edgeGeometry', () => {
  it('straight edges start and end on the circle boundaries', () => {
    const g = edgeGeometry(A, B, 0);
    expect(g.end.x).toBeCloseTo(200 - STATE_RADIUS);
    expect(g.end.y).toBeCloseTo(0);
    expect(g.endAngle).toBeCloseTo(0);
    expect(g.d.startsWith(`M ${STATE_RADIUS}`)).toBe(true);
    expect(g.label.x).toBeCloseTo(100);
    expect(Math.abs(g.label.y)).toBeCloseTo(14);
  });
  it('opposite curved edges put labels on opposite sides', () => {
    const ab = edgeGeometry(A, B, CURVE_OFFSET);
    const ba = edgeGeometry(B, A, CURVE_OFFSET);
    expect(ab.label.y).not.toBe(0);
    expect(Math.sign(ab.label.y)).toBe(-Math.sign(ba.label.y));
  });
  it('curved edges end on the target circle boundary', () => {
    const g = edgeGeometry(A, B, CURVE_OFFSET);
    expect(Math.hypot(g.end.x - B.x, g.end.y - B.y)).toBeCloseTo(STATE_RADIUS);
    expect(Math.abs(g.label.y)).toBeGreaterThan(CURVE_OFFSET / 2);
  });
});

describe('edge label side', () => {
  // A → B runs left to right on screen, so its left is above (y < 0).
  it("puts a straight edge's label above by default and below on the right", () => {
    expect(edgeGeometry(A, B, 0).label.y).toBeCloseTo(-14);
    expect(edgeGeometry(A, B, 0, 'left').label.y).toBeCloseTo(-14);
    expect(edgeGeometry(A, B, 0, 'right').label.y).toBeCloseTo(14);
    expect(edgeGeometry(A, B, 0, 'right').label.x).toBeCloseTo(100);
  });
  it("moves a curved edge's label inside the curve, between the chord and the apex", () => {
    const outside = edgeGeometry(A, B, 40);
    const inside = edgeGeometry(A, B, 40, 'right');
    // Either side of the apex, LABEL_GAP (14) away: inside is still above the chord.
    expect(inside.label.y - outside.label.y).toBeCloseTo(28);
    expect(inside.label.y).toBeLessThan(0);
    expect(inside.label.x).toBeCloseTo(outside.label.x);
    expect(inside.d).toBe(outside.d);
  });
  it('keeps the side the user chose whichever way the edge bends', () => {
    const down = edgeGeometry(A, B, -40);
    expect(down.label.y - edgeGeometry(A, B, -40, 'left').label.y).toBeCloseTo(28);
    expect(edgeGeometry(A, B, -40, 'right')).toEqual(down);
  });
  it('labelSideOf: the chosen side, else outside the curve (left when straight)', () => {
    expect(labelSideOf(0, undefined)).toBe('left');
    expect(labelSideOf(30, undefined)).toBe('left');
    expect(labelSideOf(-30, undefined)).toBe('right');
    expect(labelSideOf(-30, 'left')).toBe('left');
  });
  it('labelSideAt: the side of the drawn curve a point is on', () => {
    expect(labelSideAt(A, B, 0, { x: 100, y: -5 })).toBe('left');
    expect(labelSideAt(A, B, 0, { x: 100, y: 5 })).toBe('right');
    // Bent up by 40: a point between the chord and the apex is below (right of) the curve.
    expect(labelSideAt(A, B, 40, { x: 100, y: -20 })).toBe('right');
    expect(labelSideAt(A, B, 40, { x: 100, y: -60 })).toBe('left');
    // The drawn apex is a little beyond the bend (the ends sit on the circles): 45 up is inside.
    expect(labelSideAt(A, B, 40, { x: 100, y: -45 })).toBe('right');
    // B → A runs right to left: its left is below.
    expect(labelSideAt(B, A, 0, { x: 100, y: 5 })).toBe('left');
  });
});

describe('selfLoopGeometry', () => {
  it('starts and ends on the circle and labels outside the loop', () => {
    const g = selfLoopGeometry(O, -Math.PI / 2);
    expect(Math.hypot(g.end.x, g.end.y)).toBeCloseTo(STATE_RADIUS);
    expect(g.label.y).toBeLessThan(-STATE_RADIUS);
    expect(g.d.startsWith('M')).toBe(true);
    expect(g.d).toContain('C');
  });
});

describe('bestLoopAngle', () => {
  it('defaults to up and avoids neighbors', () => {
    expect(bestLoopAngle(O, [])).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(bestLoopAngle(O, [{ x: 100, y: 0 }]))).toBeCloseTo(Math.PI);
  });
});

describe('transitionGeometry', () => {
  const m = fixture({
    kind: 'NFA',
    alphabet: 'ab',
    states: ['q0', 'q1'],
    edges: [
      ['q0', 'a', 'q1'],
      ['q1', 'b', 'q0'],
    ],
    start: 'q0',
    name: 'm',
  });
  const [q0, q1] = m.states as [State, State];

  it('curves an edge whose reverse exists and keeps an explicit bend', () => {
    expect(transitionGeometry(m, q0, q1)).toEqual(edgeGeometry(q0, q1, CURVE_OFFSET));
    const bent = {
      ...m,
      transitions: m.transitions.map((t) => (t.from === 'q0' ? { ...t, bend: -10 } : t)),
    };
    expect(transitionGeometry(bent, q0, q1)).toEqual(edgeGeometry(q0, q1, -10));
  });
  it('draws the label on the side stored on the transition', () => {
    const below = {
      ...m,
      transitions: m.transitions.map((t) =>
        t.from === 'q0' ? { ...t, labelSide: 'right' as const } : t,
      ),
    };
    expect(transitionGeometry(below, q0, q1)).toEqual(edgeGeometry(q0, q1, CURVE_OFFSET, 'right'));
  });
  it('places a new self-loop away from neighbors and the start arrow', () => {
    // q1's only neighbor is to its left, so its loop goes right; q0's left is the start arrow.
    expect(transitionGeometry(m, q1, q1)).toEqual(selfLoopGeometry(q1, bestLoopAngle(q1, [q0])));
    expect(bestLoopAngle(q1, [q0])).toBeCloseTo(0);
    expect(transitionGeometry(m, q0, q0)).toEqual(
      selfLoopGeometry(q0, bestLoopAngle(q0, [q1, { x: q0.x - 100, y: q0.y }])),
    );
  });
  it('places a new self-loop away from a turned start arrow', () => {
    // Arrow from above: the loop leaves up only when the arrow is elsewhere.
    expect(bestLoopAngle(q0, [q1, { x: q0.x - 100, y: q0.y }])).toBeCloseTo(-Math.PI / 2);
    const turned = {
      ...m,
      states: m.states.map((s) => (s.id === 'q0' ? { ...s, startAngle: -Math.PI / 2 } : s)),
    };
    const q0Turned = turned.states[0] as State;
    const loop = transitionGeometry(turned, q0Turned, q0Turned);
    expect(loop).toEqual(selfLoopGeometry(q0, bestLoopAngle(q0, [q1, { x: q0.x, y: q0.y - 100 }])));
    expect(loop.end.y).toBeGreaterThan(q0.y - STATE_RADIUS);
  });
});

describe('labelFontSize', () => {
  it('keeps short labels at the base size and shrinks long ones', () => {
    expect(labelFontSize('q0')).toBe(15);
    expect(labelFontSize('{q0,q1,q2}')).toBeLessThan(15);
    const sizes = ['a', 'abcd', 'abcdef', 'abcdefghi', 'abcdefghijklmnop'].map(labelFontSize);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i] ?? 0).toBeLessThanOrEqual(sizes[i - 1] ?? 0);
    }
  });
  it('fits the text inside 85% of the diameter while that keeps it at 10 or more', () => {
    const label = '{q0q1}';
    expect(labelFontSize(label)).toBeGreaterThan(10);
    expect(labelFontSize(label) * 0.6 * label.length).toBeLessThanOrEqual(
      2 * STATE_RADIUS * 0.85 + 1e-9,
    );
  });
  it('never goes below 10: longer labels overflow the circle instead', () => {
    expect(labelFontSize('{q0,q1,q2}')).toBe(10);
    for (let n = 1; n <= 40; n++) expect(labelFontSize('x'.repeat(n))).toBeGreaterThanOrEqual(10);
  });
  it('sizes by the displayed text: subscript markup does not count', () => {
    expect(labelFontSize('q_{1234}')).toBe(labelFontSize('q1234'));
    expect(labelFontSize('q_0')).toBe(15);
  });
});

describe('startArrowGeometry', () => {
  it('comes from the left and ends on the circle', () => {
    const g = startArrowGeometry({ x: 100, y: 50 });
    expect(g.d).toBe(`M ${100 - STATE_RADIUS - 32} 50 L ${100 - STATE_RADIUS} 50`);
    expect(g.end).toEqual({ x: 100 - STATE_RADIUS, y: 50 });
    expect(g.endAngle).toBe(0);
  });
  it('comes from any angle, pointing at the center', () => {
    const right = startArrowGeometry({ x: 100, y: 50 }, 0);
    expect(right.d).toBe(`M ${100 + STATE_RADIUS + 32} 50 L ${100 + STATE_RADIUS} 50`);
    expect(Math.abs(right.endAngle)).toBeCloseTo(Math.PI);
    const above = startArrowGeometry(O, -Math.PI / 2);
    expect(above.end.x).toBeCloseTo(0);
    expect(above.end.y).toBeCloseTo(-STATE_RADIUS);
    expect(above.endAngle).toBeCloseTo(Math.PI / 2); // pointing down
  });
});

describe('snapAngle', () => {
  const step = Math.PI / 4;
  it('snaps within the tolerance and leaves other angles alone', () => {
    expect(snapAngle(0.05, step, 0.1)).toBe(0);
    expect(snapAngle(Math.PI / 4 + 0.08, step, 0.1)).toBeCloseTo(Math.PI / 4);
    expect(snapAngle(0.3, step, 0.1)).toBe(0.3);
  });
  it('keeps the result in (-π, π]', () => {
    expect(snapAngle(-Math.PI + 0.01, step, 0.1)).toBeCloseTo(Math.PI);
    expect(snapAngle(Math.PI - 0.01, step, 0.1)).toBeCloseTo(Math.PI);
  });
});

describe('hitState', () => {
  it('hits the circle and a margin around it', () => {
    expect(hitState(O, { x: STATE_RADIUS, y: 0 })).toBe(true);
    expect(hitState(O, { x: 0, y: STATE_RADIUS + HIT_MARGIN })).toBe(true);
    expect(hitState(O, { x: STATE_RADIUS + HIT_MARGIN + 1, y: 0 })).toBe(false);
  });
});
