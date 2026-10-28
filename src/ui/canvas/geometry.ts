export type Point = { x: number; y: number };

export const STATE_RADIUS = 24;
export const ACCEPT_INSET = 4;
export const RING_WIDTH = 8;
export const CURVE_OFFSET = 32;
export const LOOP_SIZE = 28;

const LABEL_FONT_SIZE = 15; // keep in sync with .av-state-label in diagramStyles.ts
const LABEL_MIN_FONT_SIZE = 10;
const LABEL_CHAR_WIDTH = 0.6; // average glyph width as a fraction of the font size
const LABEL_FILL = 0.85; // share of the circle's diameter a label may span
const LABEL_GAP = 14;
const START_ARROW_LENGTH = 32;
const LOOP_HALF_SPREAD = 0.5; // radians either side of the loop angle
const LOOP_ANGLE_STEPS = 16;

type PathGeometry = { d: string; label: Point; end: Point; endAngle: number };

const fmt = (n: number): string => String(Math.round(n * 100) / 100);
const pt = (p: Point): string => `${fmt(p.x)} ${fmt(p.y)}`;
const polar = (c: Point, r: number, a: number): Point => ({
  x: c.x + r * Math.cos(a),
  y: c.y + r * Math.sin(a),
});

/** Edge from one state circle to another; curves bend to the left of from→to (screen view). */
export function edgeGeometry(from: Point, to: Point, curved: boolean): PathGeometry {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  // Left of the direction of travel as seen on screen (y grows downward).
  const normal = { x: dy / len, y: -dx / len };
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

  if (!curved) {
    const ux = dx / len;
    const uy = dy / len;
    const start = { x: from.x + ux * STATE_RADIUS, y: from.y + uy * STATE_RADIUS };
    const end = { x: to.x - ux * STATE_RADIUS, y: to.y - uy * STATE_RADIUS };
    return {
      d: `M ${pt(start)} L ${pt(end)}`,
      label: { x: mid.x + normal.x * LABEL_GAP, y: mid.y + normal.y * LABEL_GAP },
      end,
      endAngle: Math.atan2(uy, ux),
    };
  }

  // Quadratic control point placed so the curve's apex is CURVE_OFFSET from the chord.
  const ctrl = { x: mid.x + normal.x * CURVE_OFFSET * 2, y: mid.y + normal.y * CURVE_OFFSET * 2 };
  const toward = (c: Point, target: Point): Point => {
    const vx = target.x - c.x;
    const vy = target.y - c.y;
    const l = Math.hypot(vx, vy) || 1;
    return { x: c.x + (vx / l) * STATE_RADIUS, y: c.y + (vy / l) * STATE_RADIUS };
  };
  const start = toward(from, ctrl);
  const end = toward(to, ctrl);
  const apex = {
    x: 0.25 * start.x + 0.5 * ctrl.x + 0.25 * end.x,
    y: 0.25 * start.y + 0.5 * ctrl.y + 0.25 * end.y,
  };
  return {
    d: `M ${pt(start)} Q ${pt(ctrl)} ${pt(end)}`,
    label: { x: apex.x + normal.x * LABEL_GAP, y: apex.y + normal.y * LABEL_GAP },
    end,
    endAngle: Math.atan2(end.y - ctrl.y, end.x - ctrl.x),
  };
}

/** Loop leaving and re-entering the circle around `angle` (radians, screen coordinates). */
export function selfLoopGeometry(center: Point, angle: number): PathGeometry {
  const start = polar(center, STATE_RADIUS, angle - LOOP_HALF_SPREAD);
  const end = polar(center, STATE_RADIUS, angle + LOOP_HALF_SPREAD);
  const reach = STATE_RADIUS + LOOP_SIZE * 1.8;
  const c1 = polar(center, reach, angle - LOOP_HALF_SPREAD * 1.6);
  const c2 = polar(center, reach, angle + LOOP_HALF_SPREAD * 1.6);
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

/**
 * State label font size: the base size, shrunk so long labels stay inside the circle, but never
 * below LABEL_MIN_FONT_SIZE; longer labels overflow the circle (the label halo keeps them legible).
 */
export function labelFontSize(label: string): number {
  const fit = (2 * STATE_RADIUS * LABEL_FILL) / (LABEL_CHAR_WIDTH * Math.max(label.length, 1));
  return Math.max(LABEL_MIN_FONT_SIZE, Math.min(LABEL_FONT_SIZE, fit));
}

/** Arrow entering the initial state from the left. */
export function startArrowGeometry(center: Point): { d: string } {
  const endX = center.x - STATE_RADIUS;
  return {
    d: `M ${fmt(endX - START_ARROW_LENGTH)} ${fmt(center.y)} L ${fmt(endX)} ${fmt(center.y)}`,
  };
}

/** body: within the circle; ring: the outer band used to start drawing a transition. */
export function hitRing(center: Point, p: Point): 'body' | 'ring' | null {
  const d = Math.hypot(p.x - center.x, p.y - center.y);
  if (d <= STATE_RADIUS) return 'body';
  if (d <= STATE_RADIUS + RING_WIDTH) return 'ring';
  return null;
}
