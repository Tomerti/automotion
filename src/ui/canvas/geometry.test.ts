import { describe, expect, it } from 'vitest';
import {
  CURVE_OFFSET,
  RING_WIDTH,
  STATE_RADIUS,
  bestLoopAngle,
  edgeGeometry,
  hitRing,
  labelFontSize,
  selfLoopGeometry,
  startArrowGeometry,
} from './geometry';

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
});

describe('startArrowGeometry', () => {
  it('comes from the left and ends on the circle', () => {
    const { d } = startArrowGeometry({ x: 100, y: 50 });
    expect(d).toBe(`M ${100 - STATE_RADIUS - 32} 50 L ${100 - STATE_RADIUS} 50`);
  });
});

describe('hitRing', () => {
  it('distinguishes body and ring', () => {
    expect(hitRing(O, { x: STATE_RADIUS, y: 0 })).toBe('body');
    expect(hitRing(O, { x: STATE_RADIUS + 1, y: 0 })).toBe('ring');
    expect(hitRing(O, { x: STATE_RADIUS + RING_WIDTH, y: 0 })).toBe('ring');
    expect(hitRing(O, { x: STATE_RADIUS + RING_WIDTH + 1, y: 0 })).toBeNull();
  });
});
