import type { Viewport } from '../../store/types';
import { STATE_RADIUS, type Point } from './geometry';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

const clampZoom = (z: number, max = MAX_ZOOM): number => Math.min(max, Math.max(MIN_ZOOM, z));

/** screen = world * zoom + (x, y), measured from the canvas element's top-left corner. */
export function screenToWorld(p: Point, rect: { left: number; top: number }, vp: Viewport): Point {
  return { x: (p.x - rect.left - vp.x) / vp.zoom, y: (p.y - rect.top - vp.y) / vp.zoom };
}

/** Scale by `factor` around `screenPoint` (canvas-relative), keeping that point fixed. */
export function zoomAt(vp: Viewport, screenPoint: Point, factor: number): Viewport {
  const zoom = clampZoom(vp.zoom * factor);
  const wx = (screenPoint.x - vp.x) / vp.zoom;
  const wy = (screenPoint.y - vp.y) / vp.zoom;
  return { x: screenPoint.x - wx * zoom, y: screenPoint.y - wy * zoom, zoom };
}

/**
 * Viewport that centers and fits all state centers (padded by the state radius and `padding`).
 * Auto-fit zoom is capped at `maxZoom` so small automata are not blown up.
 */
export function fitToView(
  points: Point[],
  size: { width: number; height: number },
  padding = 48,
  maxZoom = 1.5,
): Viewport {
  if (points.length === 0) return { x: 0, y: 0, zoom: 1 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const margin = STATE_RADIUS + padding;
  const minX = Math.min(...xs) - margin;
  const maxX = Math.max(...xs) + margin;
  const minY = Math.min(...ys) - margin;
  const maxY = Math.max(...ys) + margin;
  const zoom =
    points.length === 1
      ? 1
      : clampZoom(Math.min(size.width / (maxX - minX), size.height / (maxY - minY)), maxZoom);
  return {
    x: size.width / 2 - ((minX + maxX) / 2) * zoom,
    y: size.height / 2 - ((minY + maxY) / 2) * zoom,
    zoom,
  };
}

/**
 * `fitToView` keeping `inset` px clear on the left and on the right (the history bar covers the
 * left edge), so the fit stays centred on the whole width.
 */
export function fitToViewInset(
  points: Point[],
  size: { width: number; height: number },
  inset: number,
): Viewport {
  const width = Math.max(size.width - 2 * inset, 1);
  const vp = fitToView(points, { width, height: size.height });
  return { ...vp, x: vp.x + (size.width - width) / 2 };
}
