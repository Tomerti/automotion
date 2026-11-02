import { STATE_RADIUS, type Point } from './geometry';

/** A dragged state within this many screen px of a snap position snaps to it. */
export const SNAP_DISTANCE = 8;
/** World distance from a row's (column's) state edges to its gap markers. */
export const GAP_OFFSET = 10;
/** Gaps this close (world units) count as equal: they come out of float arithmetic. */
const EPSILON = 1e-6;

/** A line segment in world coordinates. */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A dashed alignment guide through a row or column of states. */
export type Guide = Segment;
/** An equal-gap marker: spans the space between two states' edges, just beside their row. */
export type Gap = Segment;

export interface Snap {
  pos: Point;
  guides: Guide[];
  gaps: Gap[];
}

type Axis = 'x' | 'y';
const across = (axis: Axis): Axis => (axis === 'x' ? 'y' : 'x');

/** Sorted distinct coordinates along `axis` of the states whose other coordinate is `line`. */
function lineCoords(others: Point[], axis: Axis, line: number): number[] {
  const coords = others.filter((o) => o[across(axis)] === line).map((o) => o[axis]);
  return [...new Set(coords)].sort((a, b) => a - b);
}

function pairs(coords: number[]): [number, number][] {
  return coords.slice(1).map((b, i) => [coords[i] as number, b]);
}

/**
 * Where a state on a line of states makes equal gaps: one existing gap past either end, or the
 * midpoint between two neighbours. Positions where it would overlap a neighbour are left out.
 */
function spacingTargets(coords: number[]): number[] {
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first === undefined || last === undefined) return [];
  const targets: number[] = [];
  for (const [a, b] of pairs(coords)) {
    const gap = b - a;
    if (gap >= 2 * STATE_RADIUS) targets.push(first - gap, last + gap);
    if (gap / 2 >= 2 * STATE_RADIUS) targets.push((a + b) / 2);
  }
  return targets;
}

/**
 * Snap one axis: to the nearest of an alignment with another state and (on a line of states)
 * an equal-gap position, within SNAP_DISTANCE screen px. Alignment wins a tie.
 */
function snapAxis(
  value: number,
  align: number | undefined,
  line: number[],
  zoom: number,
): { value: number; spaced: boolean } | undefined {
  let best: { value: number; spaced: boolean; d: number } | undefined;
  const consider = (target: number, spaced: boolean) => {
    const d = Math.abs(target - value) * zoom;
    if (d <= SNAP_DISTANCE && (best === undefined || d < best.d))
      best = { value: target, spaced, d };
  };
  if (align !== undefined) consider(align, false);
  for (const t of spacingTargets(line)) consider(t, true);
  return best;
}

function nearestAlign(pos: Point, others: Point[], axis: Axis, zoom: number): number | undefined {
  let best: number | undefined;
  for (const o of others) {
    const d = Math.abs(o[axis] - pos[axis]) * zoom;
    if (d <= SNAP_DISTANCE && (best === undefined || d < Math.abs(best - pos[axis]) * zoom)) {
      best = o[axis];
    }
  }
  return best;
}

/** The guide through every state on the line `pos` shares with others across `axis`. */
function guideFor(pos: Point, others: Point[], axis: Axis): Guide | undefined {
  const line = pos[across(axis)];
  const coords = lineCoords(others, axis, line);
  if (coords.length === 0) return undefined;
  const lo = Math.min(pos[axis], ...coords) - STATE_RADIUS;
  const hi = Math.max(pos[axis], ...coords) + STATE_RADIUS;
  return axis === 'x'
    ? { x1: lo, y1: line, x2: hi, y2: line }
    : { x1: line, y1: lo, x2: line, y2: hi };
}

/**
 * Markers for the gaps along a line of states that equal one of the dragged state's gaps to its
 * neighbours (which only shows when at least two gaps match).
 */
function gapsFor(pos: Point, others: Point[], axis: Axis): Gap[] {
  const line = pos[across(axis)];
  const coords = lineCoords(others, axis, line);
  if (coords.length === 0) return [];
  const all = pairs([...new Set([...coords, pos[axis]])].sort((a, b) => a - b));
  const len = ([a, b]: [number, number]) => b - a;
  const same = (u: number, v: number) => Math.abs(u - v) < EPSILON;
  const marked = all
    .filter(([a, b]) => a === pos[axis] || b === pos[axis])
    .map(len)
    .filter((v) => all.filter((p) => same(len(p), v)).length >= 2);
  const offset = line + STATE_RADIUS + GAP_OFFSET;
  return all
    .filter((p) => marked.some((v) => same(len(p), v)))
    .map(([a, b]) =>
      axis === 'x'
        ? { x1: a + STATE_RADIUS, y1: offset, x2: b - STATE_RADIUS, y2: offset }
        : { x1: offset, y1: a + STATE_RADIUS, x2: offset, y2: b - STATE_RADIUS },
    );
}

/**
 * Snap a dragged state's position to the other states: each axis lines up with another
 * state's x or y, or, once the state is on a row (column) of states, lands where the gaps along
 * it come out equal, whichever is nearer, within SNAP_DISTANCE screen px. Returns a dashed guide
 * through each line it snapped to, and a marker on each of the equal gaps.
 */
export function snapPosition(pos: Point, others: Point[], zoom: number): Snap {
  const alignX = nearestAlign(pos, others, 'x', zoom);
  const alignY = nearestAlign(pos, others, 'y', zoom);
  // x first, along the row the state's y lines up with. If x took an equal gap on that row, y
  // stays on the row; otherwise y may take an equal gap along the column x lines up with.
  const row = alignY === undefined ? [] : lineCoords(others, 'x', alignY);
  const sx = snapAxis(pos.x, alignX, row, zoom);
  const x = sx?.value ?? pos.x;
  let y: number;
  let snappedY: boolean;
  if (sx?.spaced) {
    y = alignY as number;
    snappedY = true;
  } else {
    const column = sx === undefined ? [] : lineCoords(others, 'y', x);
    const sy = snapAxis(pos.y, alignY, column, zoom);
    y = sy?.value ?? pos.y;
    snappedY = sy !== undefined;
  }
  const snapped = { x, y };
  const guides: Guide[] = [];
  const gaps: Gap[] = [];
  if (sx !== undefined) {
    const g = guideFor(snapped, others, 'y');
    if (g) guides.push(g);
    gaps.push(...gapsFor(snapped, others, 'y'));
  }
  if (snappedY) {
    const g = guideFor(snapped, others, 'x');
    if (g) guides.push(g);
    gaps.push(...gapsFor(snapped, others, 'x'));
  }
  return { pos: snapped, guides, gaps };
}
