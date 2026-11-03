import { labelDisplayText } from './label';
import type { Automaton, LabelSide, State, StateId } from './model';

export type Point = { x: number; y: number };

export const STATE_RADIUS = 24;
export const ACCEPT_INSET = 4;
/** Margin around a state's circle that still counts as hitting it. */
export const HIT_MARGIN = 8;
export const CURVE_OFFSET = 32;
export const LOOP_SIZE = 28;

const LABEL_FONT_SIZE = 15; // keep in sync with .av-state-label in diagramStyles.ts
const LABEL_MIN_FONT_SIZE = 10;
const LABEL_CHAR_WIDTH = 0.6; // average glyph width as a fraction of the font size
const LABEL_FILL = 0.85; // share of the circle's diameter a label may span
const LABEL_GAP = 14;
const START_ARROW_LENGTH = 32;
/** Where a start arrow comes from when its state has no `startAngle`: the left. */
export const START_ANGLE = Math.PI;
const LOOP_HALF_SPREAD = 0.5; // radians either side of the loop angle
const LOOP_ANGLE_STEPS = 16;
/** Distance of the virtual neighbor standing in for the start arrow. */
const START_ARROW_CLEARANCE = 100;

export type PathGeometry = { d: string; label: Point; end: Point; endAngle: number };

const fmt = (n: number): string => String(Math.round(n * 100) / 100);
const pt = (p: Point): string => `${fmt(p.x)} ${fmt(p.y)}`;
const polar = (c: Point, r: number, a: number): Point => ({
  x: c.x + r * Math.cos(a),
  y: c.y + r * Math.sin(a),
});

/** Bend of an edge without an explicit `bend`: curved only when the reverse edge also exists. */
export function autoBend(hasReverse: boolean): number {
  return hasReverse ? CURVE_OFFSET : 0;
}

/**
 * Bend that puts an edge's apex at the perpendicular projection of `p`: the signed distance of `p`
 * from the chord's line, positive to the left of from→to (screen view).
 */
export function bendThrough(from: Point, to: Point, p: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  return ((p.x - mid.x) * dy - (p.y - mid.y) * dx) / len;
}

/** Direction from a state's center to `p`, for placing a self-loop or a start arrow. */
export function loopAngleToward(center: Point, p: Point): number {
  return Math.atan2(p.y - center.y, p.x - center.x);
}

/** `angle` snapped to the nearest multiple of `step` when within `tolerance` of it (radians). */
export function snapAngle(angle: number, step: number, tolerance: number): number {
  const snapped = Math.round(angle / step) * step;
  if (Math.abs(angle - snapped) > tolerance) return angle;
  // Keep the result in (-π, π], like atan2.
  return snapped <= -Math.PI ? snapped + 2 * Math.PI : snapped;
}

/** The side an edge's label is drawn on: `labelSide` when set, else outside the curve (left when straight). */
export function labelSideOf(bend: number, labelSide: LabelSide | undefined): LabelSide {
  return labelSide ?? (bend < 0 ? 'right' : 'left');
}

/**
 * The side of the edge from → to, bent by `bend`, that `p` is on: the side whose label spot is
 * nearer. The two spots mirror each other across the drawn curve's apex, so this splits at the
 * curve's tangent there.
 */
export function labelSideAt(from: Point, to: Point, bend: number, p: Point): LabelSide {
  const dist = (side: LabelSide): number => {
    const { label } = edgeGeometry(from, to, bend, side);
    return Math.hypot(p.x - label.x, p.y - label.y);
  };
  return dist('right') < dist('left') ? 'right' : 'left';
}

/**
 * Edge from one state circle to another. `bend` is the apex's signed offset from the chord
 * (0 = straight), positive to the left of from→to (screen view). The label goes on `labelSide`
 * (see `labelSideOf`).
 */
export function edgeGeometry(
  from: Point,
  to: Point,
  bend: number,
  labelSide?: LabelSide,
): PathGeometry {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  // Left of the direction of travel as seen on screen (y grows downward).
  const normal = { x: dy / len, y: -dx / len };
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const side = labelSideOf(bend, labelSide) === 'left' ? 1 : -1;
  const { start, ctrl, end } = edgeCurve(from, to, bend);

  if (bend === 0) {
    return {
      d: `M ${pt(start)} L ${pt(end)}`,
      label: { x: mid.x + side * normal.x * LABEL_GAP, y: mid.y + side * normal.y * LABEL_GAP },
      end,
      endAngle: Math.atan2(dy / len, dx / len),
    };
  }

  const apex = {
    x: 0.25 * start.x + 0.5 * ctrl.x + 0.25 * end.x,
    y: 0.25 * start.y + 0.5 * ctrl.y + 0.25 * end.y,
  };
  return {
    d: `M ${pt(start)} Q ${pt(ctrl)} ${pt(end)}`,
    label: { x: apex.x + side * normal.x * LABEL_GAP, y: apex.y + side * normal.y * LABEL_GAP },
    end,
    endAngle: Math.atan2(end.y - ctrl.y, end.x - ctrl.x),
  };
}

/**
 * The quadratic curve `edgeGeometry` draws, from circle to circle: a straight edge (bend 0) has
 * its control point midway.
 */
export function edgeCurve(
  from: Point,
  to: Point,
  bend: number,
): { start: Point; ctrl: Point; end: Point } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const normal = { x: dy / len, y: -dx / len };
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  if (bend === 0) {
    const ux = dx / len;
    const uy = dy / len;
    return {
      start: { x: from.x + ux * STATE_RADIUS, y: from.y + uy * STATE_RADIUS },
      ctrl: mid,
      end: { x: to.x - ux * STATE_RADIUS, y: to.y - uy * STATE_RADIUS },
    };
  }
  // Control point placed so the curve's apex is `bend` from the chord.
  const ctrl = { x: mid.x + normal.x * bend * 2, y: mid.y + normal.y * bend * 2 };
  const toward = (c: Point, target: Point): Point => {
    const vx = target.x - c.x;
    const vy = target.y - c.y;
    const l = Math.hypot(vx, vy) || 1;
    return { x: c.x + (vx / l) * STATE_RADIUS, y: c.y + (vy / l) * STATE_RADIUS };
  };
  return { start: toward(from, ctrl), ctrl, end: toward(to, ctrl) };
}

/** Loop leaving and re-entering the circle around `angle` (radians, screen coordinates). */
export function selfLoopGeometry(center: Point, angle: number): PathGeometry {
  const { start, c1, c2, end } = selfLoopCurve(center, angle);
  const apex = {
    x: (start.x + 3 * c1.x + 3 * c2.x + end.x) / 8,
    y: (start.y + 3 * c1.y + 3 * c2.y + end.y) / 8,
  };
  return {
    d: `M ${pt(start)} C ${pt(c1)} ${pt(c2)} ${pt(end)}`,
    label: {
      x: apex.x + Math.cos(angle) * LABEL_GAP,
      y: apex.y + Math.sin(angle) * LABEL_GAP,
    },
    end,
    endAngle: Math.atan2(end.y - c2.y, end.x - c2.x),
  };
}

/** The cubic curve `selfLoopGeometry` draws. */
export function selfLoopCurve(
  center: Point,
  angle: number,
): { start: Point; c1: Point; c2: Point; end: Point } {
  const reach = STATE_RADIUS + LOOP_SIZE * 1.8;
  return {
    start: polar(center, STATE_RADIUS, angle - LOOP_HALF_SPREAD),
    c1: polar(center, reach, angle - LOOP_HALF_SPREAD * 1.6),
    c2: polar(center, reach, angle + LOOP_HALF_SPREAD * 1.6),
    end: polar(center, STATE_RADIUS, angle + LOOP_HALF_SPREAD),
  };
}

/** Free direction for a self-loop: the sampled angle farthest from every neighbor; up when none. */
export function bestLoopAngle(center: Point, neighbors: Point[]): number {
  const up = -Math.PI / 2;
  if (neighbors.length === 0) return up;
  const neighborAngles = neighbors.map((n) => Math.atan2(n.y - center.y, n.x - center.x));
  let best = up;
  let bestClearance = -1;
  for (let i = 0; i < LOOP_ANGLE_STEPS; i++) {
    const candidate = up + (i * 2 * Math.PI) / LOOP_ANGLE_STEPS;
    const clearance = Math.min(
      ...neighborAngles.map((a) => {
        const diff = Math.abs(Math.atan2(Math.sin(candidate - a), Math.cos(candidate - a)));
        return diff;
      }),
    );
    if (clearance > bestClearance + 1e-9) {
      bestClearance = clearance;
      best = candidate;
    }
  }
  return Math.atan2(Math.sin(best), Math.cos(best));
}

/** The bend the diagram draws the edge from → to with: its own `bend`, else the automatic one. */
export function drawnBend(a: Automaton, from: StateId, to: StateId): number {
  const own = a.transitions.find((t) => t.from === from && t.to === to);
  if (own?.bend !== undefined) return own.bend;
  return autoBend(a.transitions.some((t) => t.from === to && t.to === from));
}

/**
 * The transition from → to as the diagram draws it: its own `bend` / `loopAngle` when it exists,
 * else the automatic one. A preview of a new edge uses this too, so it matches the edge it creates.
 */
export function transitionGeometry(a: Automaton, from: State, to: State): PathGeometry {
  const own = a.transitions.find((t) => t.from === from.id && t.to === to.id);
  if (from.id !== to.id) {
    return edgeGeometry(from, to, drawnBend(a, from.id, to.id), own?.labelSide);
  }
  return selfLoopGeometry(from, own?.loopAngle ?? autoLoopAngle(a, from));
}

/**
 * The transition from → to as the diagram draws it, as `segments` + 1 points along its curve,
 * from circle to circle.
 */
export function transitionPolyline(a: Automaton, from: State, to: State, segments = 16): Point[] {
  const out: Point[] = [];
  if (from.id === to.id) {
    const own = a.transitions.find((t) => t.from === from.id && t.to === to.id);
    const { start, c1, c2, end } = selfLoopCurve(from, own?.loopAngle ?? autoLoopAngle(a, from));
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const u = 1 - t;
      const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
      out.push({
        x: w[0] * start.x + w[1] * c1.x + w[2] * c2.x + w[3] * end.x,
        y: w[0] * start.y + w[1] * c1.y + w[2] * c2.y + w[3] * end.y,
      });
    }
    return out;
  }
  const { start, ctrl, end } = edgeCurve(from, to, drawnBend(a, from.id, to.id));
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    out.push({
      x: u * u * start.x + 2 * u * t * ctrl.x + t * t * end.x,
      y: u * u * start.y + 2 * u * t * ctrl.y + t * t * end.y,
    });
  }
  return out;
}

/**
 * Direction of `state`'s self-loop when it has no `loopAngle`: away from its neighbors and its
 * start arrow.
 */
export function autoLoopAngle(a: Automaton, state: State): number {
  const neighbors: Point[] = a.transitions
    .filter((t) => t.from !== t.to && (t.from === state.id || t.to === state.id))
    .map((t) => a.states.find((s) => s.id === (t.from === state.id ? t.to : t.from)))
    .filter((s): s is State => s !== undefined);
  // Treat the direction the start arrow comes from as occupied.
  if (a.starts.includes(state.id)) {
    neighbors.push(polar(state, START_ARROW_CLEARANCE, state.startAngle ?? START_ANGLE));
  }
  return bestLoopAngle(state, neighbors);
}

/**
 * State label font size: the base size, shrunk so long labels stay inside the circle, but never
 * below LABEL_MIN_FONT_SIZE; longer labels overflow the circle (the label halo keeps them legible).
 * Sized by the label as displayed, so `q_{12}` counts as three characters.
 */
export function labelFontSize(label: string): number {
  const chars = Array.from(labelDisplayText(label)).length;
  const fit = (2 * STATE_RADIUS * LABEL_FILL) / (LABEL_CHAR_WIDTH * Math.max(chars, 1));
  return Math.max(LABEL_MIN_FONT_SIZE, Math.min(LABEL_FONT_SIZE, fit));
}

/**
 * Arrow into a start state, coming from `angle` (radians, screen coordinates, toward the tail) and
 * ending on its circle.
 */
export function startArrowGeometry(
  center: Point,
  angle: number = START_ANGLE,
): Pick<PathGeometry, 'd' | 'end' | 'endAngle'> {
  const end = polar(center, STATE_RADIUS, angle);
  const tail = polar(center, STATE_RADIUS + START_ARROW_LENGTH, angle);
  const endAngle = angle > 0 ? angle - Math.PI : angle + Math.PI;
  return { d: `M ${pt(tail)} L ${pt(end)}`, end, endAngle };
}

/** Whether `p` hits the state at `center`: its circle plus HIT_MARGIN. */
export function hitState(center: Point, p: Point): boolean {
  return Math.hypot(p.x - center.x, p.y - center.y) <= STATE_RADIUS + HIT_MARGIN;
}
