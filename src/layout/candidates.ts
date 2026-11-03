import ELK from 'elkjs/lib/elk.bundled.js';
import { STATE_RADIUS, type Point } from '../core/geometry';
import type { Automaton, StateId } from '../core/model';
import { SPACING } from './aesthetics';

/** Where each state goes: one candidate layout. */
export type Positions = Map<StateId, Point>;

const NODE_SIZE = 2 * STATE_RADIUS + 16;
/** Vertical distance between states of one layer (centers). */
const ROW_SPACING = SPACING;

const elk = new ELK();

/** All states on one row, in `order`. */
export function rowLayout(order: StateId[]): Positions {
  return new Map(order.map((id, i) => [id, { x: i * SPACING, y: 0 }]));
}

/** States around a circle in `order`, clockwise from the left, neighbors SPACING apart. */
export function circleLayout(order: StateId[]): Positions {
  const n = order.length;
  const r = SPACING / (2 * Math.sin(Math.PI / n));
  return new Map(
    order.map((id, i) => {
      const angle = Math.PI + (2 * Math.PI * i) / n;
      return [id, { x: r * Math.cos(angle), y: r * Math.sin(angle) }];
    }),
  );
}

/** Variants of ELK's layered layout tried by `elkLayered`. */
export const LAYERED_VARIANTS: Record<string, string>[] = [
  // Back edges are the ones that go against the reading order; rows kept straight.
  {
    'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  },
  {
    'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  },
  { 'elk.layered.cycleBreaking.strategy': 'GREEDY' },
];

/** ELK's layered layout, left to right, with the states given in reading `order`. */
export async function elkLayered(
  a: Automaton,
  order: StateId[],
  variant: Record<string, string>,
): Promise<Positions> {
  const graph = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': String(ROW_SPACING - NODE_SIZE),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(SPACING - NODE_SIZE),
      ...variant,
    },
    children: order.map((id) => ({
      id,
      width: NODE_SIZE,
      height: NODE_SIZE,
      // Model order already puts the start states first (and ELK rejects FIRST on a state with
      // arrows coming in under it).
      ...(a.starts.includes(id) && variant['elk.layered.cycleBreaking.strategy'] !== 'MODEL_ORDER'
        ? { layoutOptions: { 'elk.layered.layering.layerConstraint': 'FIRST' } }
        : {}),
    })),
    edges: orderedEdges(a, order),
  });
  return alignRowsAndColumns(
    new Map(
      (graph.children ?? []).map((c) => [
        c.id,
        { x: (c.x ?? 0) + NODE_SIZE / 2, y: (c.y ?? 0) + NODE_SIZE / 2 },
      ]),
    ),
  );
}

/**
 * Stress majorization: places states so their distances match the number of arrows between them
 * (either way) times SPACING, like springs. Started from a circle in reading order and turned so
 * the start state is on the left. Done here rather than with ELK's stress layout, which is far
 * slower on the 64 states a subset construction can produce.
 */
export function stressLayout(a: Automaton, order: StateId[]): Positions {
  const n = order.length;
  const index = new Map(order.map((id, i) => [id, i]));
  const adj: number[][] = order.map(() => []);
  for (const t of a.transitions) {
    const i = index.get(t.from);
    const j = index.get(t.to);
    if (i === undefined || j === undefined || i === j) continue;
    adj[i]!.push(j);
    adj[j]!.push(i);
  }
  // Graph distances by breadth-first search from each state (unreached: as far as any).
  const d: number[][] = order.map((_, src) => {
    const row = new Array<number>(n).fill(Infinity);
    row[src] = 0;
    const queue = [src];
    while (queue.length > 0) {
      const u = queue.shift()!;
      for (const v of adj[u]!) {
        if (row[v] === Infinity) {
          row[v] = row[u]! + 1;
          queue.push(v);
        }
      }
    }
    return row.map((x) => (x === Infinity ? n : x) * SPACING);
  });
  const init = circleLayout(order);
  const xs = order.map((id) => init.get(id)!.x);
  const ys = order.map((id) => init.get(id)!.y);
  for (let iter = 0; iter < STRESS_ITERATIONS; iter++) {
    for (let i = 0; i < n; i++) {
      let sx = 0;
      let sy = 0;
      let sw = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dij = d[i]![j]!;
        const w = 1 / (dij * dij);
        const dx = xs[i]! - xs[j]!;
        const dy = ys[i]! - ys[j]!;
        const len = Math.hypot(dx, dy) || 1e-6;
        sx += w * (xs[j]! + (dij * dx) / len);
        sy += w * (ys[j]! + (dij * dy) / len);
        sw += w;
      }
      if (sw > 0) {
        xs[i] = sx / sw;
        ys[i] = sy / sw;
      }
    }
  }
  const pos: Positions = new Map(order.map((id, i) => [id, { x: xs[i]!, y: ys[i]! }]));
  return alignRowsAndColumns(startOnTheLeft(pos, order[0]));
}

const STRESS_ITERATIONS = 150;

function orderedEdges(
  a: Automaton,
  order: StateId[],
): { id: string; sources: string[]; targets: string[] }[] {
  const index = new Map(order.map((id, i) => [id, i]));
  return a.transitions
    .filter((t) => t.from !== t.to && index.has(t.from) && index.has(t.to))
    .sort((p, q) => index.get(p.from)! - index.get(q.from)! || index.get(p.to)! - index.get(q.to)!)
    .map((t) => ({ id: t.id, sources: [t.from], targets: [t.to] }));
}

/** Turns the layout about its center so `first` is to the left of the rest. */
function startOnTheLeft(pos: Positions, first: StateId | undefined): Positions {
  const p0 = first === undefined ? undefined : pos.get(first);
  if (!p0 || pos.size < 2) return pos;
  const pts = [...pos.values()];
  const c = {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
  // Rotate so the direction start → center points right.
  const turn = -Math.atan2(c.y - p0.y, c.x - p0.x);
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return new Map(
    [...pos].map(([id, p]) => [
      id,
      {
        x: c.x + (p.x - c.x) * cos - (p.y - c.y) * sin,
        y: c.y + (p.x - c.x) * sin + (p.y - c.y) * cos,
      },
    ]),
  );
}

/**
 * Pulls coordinates that almost agree onto one value (their mean), so states that were meant to
 * share a row or column do, and arrows between them come out straight.
 */
export function alignRowsAndColumns(pos: Positions, tolerance = 28): Positions {
  const snap = (values: number[]): Map<number, number> => {
    const sorted = [...new Set(values)].sort((p, q) => p - q);
    const out = new Map<number, number>();
    let group: number[] = [];
    const flush = (): void => {
      const mean = group.reduce((s, v) => s + v, 0) / group.length;
      for (const v of group) out.set(v, mean);
      group = [];
    };
    for (const v of sorted) {
      if (group.length > 0 && v - group[0]! > tolerance) flush();
      group.push(v);
    }
    if (group.length > 0) flush();
    return out;
  };
  const xs = snap([...pos.values()].map((p) => p.x));
  const ys = snap([...pos.values()].map((p) => p.y));
  const out: Positions = new Map();
  for (const [id, p] of pos) out.set(id, { x: xs.get(p.x) ?? p.x, y: ys.get(p.y) ?? p.y });
  // Snapping must never put two states on top of each other: keep the original then.
  const keys = new Set([...out.values()].map((p) => `${Math.round(p.x)},${Math.round(p.y)}`));
  return keys.size === out.size ? out : pos;
}
