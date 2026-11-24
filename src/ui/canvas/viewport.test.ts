import { describe, expect, it } from 'vitest';
import { STATE_RADIUS } from '../../core/geometry';
import { ISSUES_CHIP_ROOM, dockInset } from './useCanvasEditing';
import { fitToView, fitToViewInset, screenToWorld, zoomAt } from './viewport';

describe('screenToWorld', () => {
  it('inverts pan and zoom', () => {
    const vp = { x: 30, y: -10, zoom: 2 };
    const world = screenToWorld({ x: 150, y: 110 }, { left: 10, top: 20 }, vp);
    expect(world.x).toBeCloseTo(55);
    expect(world.y).toBeCloseTo(50);
    expect(world.x * vp.zoom + vp.x + 10).toBeCloseTo(150);
    expect(world.y * vp.zoom + vp.y + 20).toBeCloseTo(110);
  });
});

describe('zoomAt', () => {
  it('keeps the screen point fixed and clamps zoom', () => {
    const vp = { x: 20, y: 40, zoom: 1 };
    const s = { x: 300, y: 200 };
    const before = screenToWorld(s, { left: 0, top: 0 }, vp);
    const z = zoomAt(vp, s, 2);
    expect(z.zoom).toBe(2);
    const after = screenToWorld(s, { left: 0, top: 0 }, z);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(zoomAt(vp, s, 100).zoom).toBe(4);
    expect(zoomAt(vp, s, 0.001).zoom).toBe(0.25);
  });
});

describe('fitToView', () => {
  const size = { width: 800, height: 600 };
  it('contains all points', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1000, y: 400 },
    ];
    const vp = fitToView(pts, size);
    for (const p of pts) {
      const sx = p.x * vp.zoom + vp.x;
      const sy = p.y * vp.zoom + vp.y;
      const m = STATE_RADIUS * vp.zoom;
      expect(sx - m).toBeGreaterThanOrEqual(-1e-6);
      expect(sx + m).toBeLessThanOrEqual(size.width + 1e-6);
      expect(sy - m).toBeGreaterThanOrEqual(-1e-6);
      expect(sy + m).toBeLessThanOrEqual(size.height + 1e-6);
    }
  });
  it('handles zero and one point', () => {
    expect(fitToView([], size)).toEqual({ x: 0, y: 0, zoom: 1 });
    const vp = fitToView([{ x: 10, y: 20 }], size);
    expect(vp.zoom).toBe(1);
    expect(10 * vp.zoom + vp.x).toBeCloseTo(400);
    expect(20 * vp.zoom + vp.y).toBeCloseTo(300);
  });
  it('caps auto-fit zoom at 1.5 by default', () => {
    const vp = fitToView(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      { width: 1600, height: 1000 },
    );
    expect(vp.zoom).toBe(1.5);
    expect(
      fitToView(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        { width: 1600, height: 1000 },
        48,
        3,
      ).zoom,
    ).toBe(3);
  });
  it('shrinks for a big spread', () => {
    expect(
      fitToView(
        [
          { x: 0, y: 0 },
          { x: 3000, y: 0 },
        ],
        size,
      ).zoom,
    ).toBeLessThan(1);
  });
  it('treats coincident points like a single point', () => {
    const vp = fitToView(
      [
        { x: 10, y: 20 },
        { x: 10, y: 20 },
      ],
      size,
    );
    expect(vp.zoom).toBeLessThanOrEqual(1.5);
    expect(10 * vp.zoom + vp.x).toBeCloseTo(400);
    expect(20 * vp.zoom + vp.y).toBeCloseTo(300);
  });
  it('clamps zoom', () => {
    const vp = fitToView(
      [
        { x: 0, y: 0 },
        { x: 100000, y: 0 },
      ],
      size,
    );
    expect(vp.zoom).toBe(0.25);
  });
});

describe('fitToViewInset', () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
  ];
  const size = { width: 1200, height: 600 };

  it('stays centred on the whole width', () => {
    const vp = fitToViewInset(pts, size, 200);
    expect(vp.x + 500 * vp.zoom).toBeCloseTo(600);
  });

  it('keeps the inset clear on both sides', () => {
    const vp = fitToViewInset(pts, size, 200);
    expect(vp.x - STATE_RADIUS * vp.zoom).toBeGreaterThanOrEqual(200);
    expect(vp.x + (1000 + STATE_RADIUS) * vp.zoom).toBeLessThanOrEqual(1000);
  });

  it('is fitToView without an inset', () => {
    expect(fitToViewInset(pts, size, 0)).toEqual(fitToView(pts, size));
  });

  it('keeps a top inset clear, centred in the height below it', () => {
    const vp = fitToViewInset(pts, size, 0, 300);
    expect(vp.y - STATE_RADIUS * vp.zoom).toBeGreaterThanOrEqual(300);
    expect(vp.y).toBeCloseTo(450);
    expect(vp.x + 500 * vp.zoom).toBeCloseTo(600);
  });

  it('keeps a bottom inset clear (the dock), centred in the height between the insets', () => {
    const vp = fitToViewInset(pts, size, 0, 100, 200);
    expect(vp.y + STATE_RADIUS * vp.zoom).toBeLessThanOrEqual(600 - 200);
    expect(vp.y).toBeCloseTo(250);
  });
});

describe('dockInset', () => {
  const rect = (top: number, bottom: number): DOMRect =>
    ({ top, bottom, height: bottom - top }) as DOMRect;

  it('is the space from the dock’s top to the canvas’s bottom, plus the issues chip’s room', () => {
    const area = document.createElement('main');
    const canvas = document.createElement('div');
    const dock = document.createElement('div');
    dock.dataset.testid = 'dock';
    area.append(canvas, dock);
    document.body.append(area);
    canvas.getBoundingClientRect = () => rect(50, 650);
    dock.getBoundingClientRect = () => rect(588, 632);
    expect(dockInset(canvas)).toBe(650 - 588 + ISSUES_CHIP_ROOM);
    area.remove();
  });

  it('is 0 without a canvas or without a dock (the canvas alone, as in its tests)', () => {
    expect(dockInset(null)).toBe(0);
    const canvas = document.createElement('div');
    document.body.append(canvas);
    expect(dockInset(canvas)).toBe(0);
    canvas.remove();
  });
});
