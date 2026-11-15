import {
  CURVE_OFFSET,
  EDGE_LABEL_CHAR_WIDTH,
  STATE_RADIUS,
  START_ANGLE,
  autoBend,
  labelSideOf,
  startArrowGeometry,
  transitionGeometry,
  transitionPolyline,
  type Point,
} from '../core/geometry';
import type { Automaton, LabelSide, State, StateId, Transition } from '../core/model';
import { readingOrders } from './order';

/**
 * How a laid-out automaton reads, judged on the curves the canvas draws (`core/geometry`), not on
 * the routes a layout algorithm would like to draw: arrows crossing each other or running through
 * a state, labels sitting on states, labels or arrows, and the space it takes.
 */

/** Distance between neighboring states the layouts aim for (centers, world px). */
export const SPACING = 140;

// Edge labels: 15 px IBM Plex Mono (diagramStyles.ts), EDGE_LABEL_CHAR_WIDTH a character.
const LABEL_HEIGHT = 18;

const W_CROSSING = 10;
const W_THROUGH_STATE = 40;
const W_LABEL_ON_STATE = 14;
const W_LABEL_ON_LABEL = 14;
const W_LABEL_ON_EDGE = 4;
const W_START_ARROW = 12;
const W_TOO_CLOSE = 60;
const W_LENGTH = 1.5; // per SPACING of arrow
const W_BEND = 1.5; // per CURVE_OFFSET of bend beyond the automatic one
const W_AREA = 0.4; // per SPACING² of bounding box
const W_START_NOT_LEFT = 5;
const W_FLOW = 3; // an arrow forward in reading order pointing left; half of it pointing up or down
const W_CROWDED = 6; // two arrows meeting a state less than CROWDED_ANGLE apart
const CROWDED_ANGLE = (20 * Math.PI) / 180;
const W_SKEW = 1; // a straight arrow halfway between two multiples of 45°
/** Clearance an arrow keeps from a state it doesn't touch, beyond its circle. */
const STATE_CLEARANCE = 6;

type Box = { x: number; y: number; w: number; h: number }; // centered

interface Drawn {
  t: Transition;
  from: State;
  to: State;
  pts: Point[];
  /** Bounds of `pts`, for quick rejection. */
  box: Bounds;
  label: Box;
}

type Bounds = { x0: number; y0: number; x1: number; y1: number };

const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distToPolyline(p: Point, pts: Point[]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++)
    best = Math.min(best, distToSegment(p, pts[i - 1]!, pts[i]!));
  return best;
}

function segmentIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (d === 0) return null;
  const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return { x: p1.x + u * (p2.x - p1.x), y: p1.y + u * (p2.y - p1.y) };
}

function bounds(pts: Point[]): Bounds {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0, y0, x1, y1 };
}

function polylineIntersections(a: Point[], b: Point[], ba: Bounds, bb: Bounds): Point[] {
  if (ba.x1 < bb.x0 || bb.x1 < ba.x0 || ba.y1 < bb.y0 || bb.y1 < ba.y0) return [];
  const out: Point[] = [];
  for (let i = 1; i < a.length; i++) {
    for (let j = 1; j < b.length; j++) {
      const p = segmentIntersection(a[i - 1]!, a[i]!, b[j - 1]!, b[j]!);
      if (p) out.push(p);
    }
  }
  return out;
}

function boxHitsCircle(b: Box, c: Point, r: number): boolean {
  const nx = Math.max(b.x - b.w / 2, Math.min(c.x, b.x + b.w / 2));
  const ny = Math.max(b.y - b.h / 2, Math.min(c.y, b.y + b.h / 2));
  return Math.hypot(c.x - nx, c.y - ny) < r;
}

function boxesOverlap(a: Box, b: Box): boolean {
  return Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
}

/** Whether a label box reaches into an arrow's bounds. */
function boxNear(b: Bounds, label: Box): boolean {
  return (
    label.x + label.w / 2 > b.x0 &&
    label.x - label.w / 2 < b.x1 &&
    label.y + label.h / 2 > b.y0 &&
    label.y - label.h / 2 < b.y1
  );
}

function polylineHitsBox(pts: Point[], b: Box): boolean {
  const inside = (p: Point): boolean =>
    Math.abs(p.x - b.x) * 2 < b.w && Math.abs(p.y - b.y) * 2 < b.h;
  for (let i = 0; i < pts.length; i++) {
    if (inside(pts[i]!)) return true;
    // Midpoints catch a segment passing straight across the box.
    if (i > 0 && inside({ x: (pts[i - 1]!.x + pts[i]!.x) / 2, y: (pts[i - 1]!.y + pts[i]!.y) / 2 }))
      return true;
  }
  return false;
}

function drawOne(a: Automaton, t: Transition, byId: Map<StateId, State>): Drawn | null {
  const from = byId.get(t.from);
  const to = byId.get(t.to);
  if (!from || !to) return null;
  const g = transitionGeometry(a, from, to);
  const text = t.symbols.join(',');
  const pts = transitionPolyline(a, from, to);
  return {
    t,
    from,
    to,
    pts,
    box: bounds(pts),
    label: {
      x: g.label.x,
      y: g.label.y,
      w: Math.max(1, Array.from(text).length) * EDGE_LABEL_CHAR_WIDTH + 4,
      h: LABEL_HEIGHT,
    },
  };
}

function drawAll(a: Automaton): Drawn[] {
  const byId = new Map(a.states.map((s) => [s.id, s]));
  return a.transitions.map((t) => drawOne(a, t, byId)).filter((d): d is Drawn => d !== null);
}

/** Crossings between two drawn arrows, not counting where they meet at a shared state. */
function crossings(d: Drawn, e: Drawn): number {
  const shared = [d.from, d.to].filter((s) => s.id === e.from.id || s.id === e.to.id);
  return polylineIntersections(d.pts, e.pts, d.box, e.box).filter(
    (p) => !shared.some((s) => dist(p, s) < STATE_RADIUS + 8),
  ).length;
}

/** Penalties of one arrow against everything else drawn (each pair counted once overall). */
function arrowCost(d: Drawn, others: Drawn[], states: State[]): number {
  let cost = 0;
  const reach = STATE_RADIUS + STATE_CLEARANCE;
  for (const s of states) {
    const near =
      s.x > d.box.x0 - reach &&
      s.x < d.box.x1 + reach &&
      s.y > d.box.y0 - reach &&
      s.y < d.box.y1 + reach;
    if (near && s.id !== d.from.id && s.id !== d.to.id) {
      if (distToPolyline(s, d.pts) < reach) cost += W_THROUGH_STATE;
    }
    if (boxHitsCircle(d.label, s, STATE_RADIUS + 2)) cost += W_LABEL_ON_STATE;
  }
  for (const e of others) {
    if (e === d) continue;
    cost += W_CROSSING * crossings(d, e);
    if (boxesOverlap(d.label, e.label)) cost += W_LABEL_ON_LABEL;
    if (boxNear(e.box, d.label) && polylineHitsBox(e.pts, d.label)) cost += W_LABEL_ON_EDGE;
    if (boxNear(d.box, e.label) && polylineHitsBox(d.pts, e.label)) cost += W_LABEL_ON_EDGE;
  }
  return cost;
}

function startArrowSegment(s: State): [Point, Point] {
  const angle = s.startAngle ?? START_ANGLE;
  const g = startArrowGeometry(s, angle);
  const tail = {
    x: s.x + Math.cos(angle) * (STATE_RADIUS + 32),
    y: s.y + Math.sin(angle) * (STATE_RADIUS + 32),
  };
  return [tail, g.end];
}

function startArrowCost(s: State, drawn: Drawn[], states: State[]): number {
  const [tail, end] = startArrowSegment(s);
  let cost = 0;
  for (const d of drawn) {
    for (let i = 1; i < d.pts.length; i++) {
      if (segmentIntersection(tail, end, d.pts[i - 1]!, d.pts[i]!)) {
        cost += W_START_ARROW;
        break;
      }
    }
    if (polylineHitsBox([tail, end], d.label)) cost += W_START_ARROW / 2;
  }
  for (const o of states) {
    if (o.id !== s.id && distToSegment(o, tail, end) < STATE_RADIUS + STATE_CLEARANCE) {
      cost += W_START_ARROW;
    }
  }
  return cost;
}

/** The terms of `layoutCost`, by name (for tests and tuning). */
export function layoutCostTerms(a: Automaton): Record<string, number> {
  const terms: Record<string, number> = {};
  const add = (name: string, v: number): void => {
    if (v !== 0) terms[name] = (terms[name] ?? 0) + v;
  };
  const drawn = drawAll(a);
  for (let i = 0; i < drawn.length; i++) {
    const d = drawn[i]!;
    // Pairwise terms are symmetric: count each pair once.
    add('arrows', arrowCost(d, drawn.slice(i + 1), a.states));
    if (d.from.id !== d.to.id) add('length', (W_LENGTH * dist(d.from, d.to)) / SPACING);
    const bend = d.t.bend;
    if (bend !== undefined) {
      const auto = autoBend(drawn.some((e) => e.from.id === d.to.id && e.to.id === d.from.id));
      add('bends', (W_BEND * Math.max(0, Math.abs(bend) - auto)) / CURVE_OFFSET);
    }
  }
  // Reading order: arrows forward in it should point right, as text reads.
  const index = new Map((readingOrders(a)[0] ?? []).map((id, i) => [id, i]));
  for (const d of drawn) {
    if (d.from.id === d.to.id) continue;
    const angle = Math.atan2(d.to.y - d.from.y, d.to.x - d.from.x);
    if ((index.get(d.from.id) ?? 0) < (index.get(d.to.id) ?? 0)) {
      add('flow', (W_FLOW * (1 - Math.cos(angle))) / 2);
    }
    if (d.t.bend === undefined) {
      const eighth = Math.PI / 4;
      const off = Math.abs(angle / eighth - Math.round(angle / eighth));
      add('skew', W_SKEW * 2 * off);
    }
  }
  // Angular resolution: arrows bunched where they meet a state are hard to tell apart.
  for (const s of a.states) {
    const angles = drawn
      .filter((d) => d.from.id !== d.to.id && (d.from.id === s.id || d.to.id === s.id))
      .map((d) => (d.from.id === s.id ? d.pts[0]! : d.pts[d.pts.length - 1]!))
      .map((p) => Math.atan2(p.y - s.y, p.x - s.x));
    for (let i = 0; i < angles.length; i++) {
      for (let j = i + 1; j < angles.length; j++) {
        const gap = Math.abs(
          Math.atan2(Math.sin(angles[i]! - angles[j]!), Math.cos(angles[i]! - angles[j]!)),
        );
        if (gap < CROWDED_ANGLE) add('crowded', W_CROWDED * (1 - gap / CROWDED_ANGLE));
      }
    }
  }
  const starts = a.states.filter((s) => a.starts.includes(s.id));
  for (const s of starts) add('start arrows', startArrowCost(s, drawn, a.states));
  for (let i = 0; i < a.states.length; i++) {
    for (let j = i + 1; j < a.states.length; j++) {
      const gap = dist(a.states[i]!, a.states[j]!);
      if (gap < 2 * STATE_RADIUS + 40) add('too close', W_TOO_CLOSE);
    }
  }
  const box = bounds(a.states);
  const w = box.x1 - box.x0 + SPACING;
  const h = box.y1 - box.y0 + SPACING;
  add('area', (W_AREA * w * h) / (SPACING * SPACING));
  if (starts.length > 0 && !starts.some((s) => s.x <= box.x0 + 1)) {
    add('start not left', W_START_NOT_LEFT);
  }
  return terms;
}

/** How badly a laid-out automaton reads: lower is better. */
export function layoutCost(a: Automaton): number {
  return Object.values(layoutCostTerms(a)).reduce((s, v) => s + v, 0);
}

const BENDS = [0, 32, 48, 64, 88, 120, 160];

/**
 * Chooses each arrow's bend and label side: as straight as it can be without running through a
 * state, crossing other arrows or putting its label on something. Arrows with a reverse keep
 * curving to their own left (the canvas's automatic look), only further when they must.
 * Self-loops and start arrows are left automatic.
 */
export function assignBends(a: Automaton): Automaton {
  const states = a.states;
  const cx = states.reduce((s, p) => s + p.x, 0) / states.length;
  const cy = states.reduce((s, p) => s + p.y, 0) / states.length;
  const byId = new Map(states.map((s) => [s.id, s]));
  const chord = (t: Transition): number => {
    const f = byId.get(t.from);
    const g = byId.get(t.to);
    return f && g ? dist(f, g) : 0;
  };
  const order = a.transitions
    .filter((t) => t.from !== t.to)
    .sort((p, q) => chord(p) - chord(q) || p.id.localeCompare(q.id));
  let cur = a;
  // Only the arrow being tried changes shape: keep the others drawn.
  let drawn = drawAll(cur);
  const passes = states.length <= 24 ? 2 : 1;
  for (let pass = 0; pass < passes; pass++) {
    for (const t0 of order) {
      const hasReverse = cur.transitions.some((t) => t.from === t0.to && t.to === t0.from);
      const auto = autoBend(hasReverse);
      const options: { bend: number; side?: LabelSide }[] = [];
      for (const m of BENDS) {
        if (hasReverse && m < auto) continue;
        for (const sign of m === 0 || hasReverse ? [1] : [1, -1]) {
          const bend = sign * m;
          options.push({ bend });
          // A straight arrow may carry its label on either side; a curve keeps it outside.
          if (bend === 0) options.push({ bend, side: 'right' });
        }
      }
      let best: Automaton = cur;
      let bestDrawn: Drawn | null = null;
      let bestCost = Infinity;
      const others = drawn.filter((e) => e.t.id !== t0.id);
      for (const o of options) {
        const t: Transition = { ...t0, bend: o.bend === auto ? undefined : o.bend };
        delete t.labelSide;
        if (o.side !== undefined && o.side !== labelSideOf(o.bend, undefined)) t.labelSide = o.side;
        if (t.bend === undefined) delete t.bend;
        const next = { ...cur, transitions: cur.transitions.map((x) => (x.id === t.id ? t : x)) };
        const d = drawOne(next, t, byId);
        if (!d) continue;
        let cost = arrowCost(d, others, states);
        cost += (W_BEND * Math.max(0, Math.abs(o.bend) - auto)) / CURVE_OFFSET;
        if (o.side !== undefined) cost += 0.1;
        // Tie-break: curves bulge away from the middle of the drawing.
        const chordMid = { x: (d.from.x + d.to.x) / 2, y: (d.from.y + d.to.y) / 2 };
        const apex = d.pts[Math.floor(d.pts.length / 2)]!;
        const center = { x: cx, y: cy };
        if (o.bend !== 0)
          cost -= (0.05 * (dist(apex, center) - dist(chordMid, center))) / CURVE_OFFSET;
        for (const s of cur.states.filter((s) => cur.starts.includes(s.id))) {
          cost += startArrowCost(s, [d], []);
        }
        if (cost < bestCost - 1e-9) {
          bestCost = cost;
          best = next;
          bestDrawn = d;
        }
      }
      cur = best;
      if (bestDrawn) drawn = [...others, bestDrawn];
    }
  }
  return cur;
}

const START_DIRECTIONS = [
  Math.PI,
  (3 * Math.PI) / 4,
  (-3 * Math.PI) / 4,
  -Math.PI / 2,
  Math.PI / 2,
  -Math.PI / 4,
  Math.PI / 4,
  0,
];

/**
 * Points each start arrow where nothing else is drawn, from the left when that is free (the
 * default, so `startAngle` stays unset).
 */
export function assignStartAngles(a: Automaton): Automaton {
  const drawn = drawAll(a).filter((d) => d.from.id !== d.to.id);
  return {
    ...a,
    states: a.states.map((s) => {
      if (!a.starts.includes(s.id)) return s;
      const plain: State = { ...s };
      delete plain.startAngle;
      let best: State = plain;
      let bestCost = Infinity;
      for (const [i, angle] of START_DIRECTIONS.entries()) {
        const candidate: State = angle === START_ANGLE ? plain : { ...plain, startAngle: angle };
        // Where the arrows leave this state's circle: keep the start arrow clear of them.
        const touching = drawn
          .filter((d) => d.from.id === s.id || d.to.id === s.id)
          .map((d) => (d.from.id === s.id ? d.pts[0]! : d.pts[d.pts.length - 1]!))
          .map((p) => Math.atan2(p.y - s.y, p.x - s.x));
        const gap = Math.min(
          Math.PI,
          ...touching.map((t) => Math.abs(Math.atan2(Math.sin(t - angle), Math.cos(t - angle)))),
        );
        const cost =
          startArrowCost(candidate, drawn, a.states) +
          (gap < Math.PI / 5 ? W_START_ARROW : 0) +
          i * 0.5;
        if (cost < bestCost) {
          bestCost = cost;
          best = candidate;
        }
      }
      return best;
    }),
  };
}
