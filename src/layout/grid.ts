import type { StateId } from '../core/model';
import { SPACING } from './aesthetics';
import type { Positions } from './candidates';

type Cell = { c: number; r: number };
const key = (p: Cell): string => `${p.c},${p.r}`;

/** Most passes over every move and swap; the search stops sooner once a pass finds nothing. */
const MAX_ROUNDS = 12;

/**
 * `pos` snapped onto a grid SPACING apart (each state to its nearest free cell, in the order
 * given), then improved by hill climbing: each move of one state to a free cell around the layout,
 * or swap of two states, that lowers `cost` is taken as soon as it is found, until a whole pass
 * finds none. Hand-drawn automata sit on such a grid; the candidates that find their structure
 * (a stress layout, ELK's layers) rarely do. Without `grow`, states move only to free cells
 * inside the layout's bounding box, so it doesn't spread out.
 */
export function refineOnGrid(
  ids: readonly StateId[],
  pos: Positions,
  cost: (pos: Positions) => number,
  { grow = true }: { grow?: boolean } = {},
): Positions {
  const xs = ids.map((id) => pos.get(id)!.x);
  const ys = ids.map((id) => pos.get(id)!.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const cells = new Map<StateId, Cell>();
  const taken = new Set<string>();
  for (const id of ids) {
    const p = pos.get(id)!;
    const want = { c: Math.round((p.x - x0) / SPACING), r: Math.round((p.y - y0) / SPACING) };
    const cell = nearestFree(want, taken);
    cells.set(id, cell);
    taken.add(key(cell));
  }
  const toPositions = (cs: Map<StateId, Cell>): Positions =>
    new Map(ids.map((id) => [id, { x: cs.get(id)!.c * SPACING, y: cs.get(id)!.r * SPACING }]));

  let best = cells;
  let bestCost = cost(toPositions(best));
  /** Takes `cs` if it costs less than the best so far. */
  const tryCells = (cs: Map<StateId, Cell>): boolean => {
    const c = cost(toPositions(cs));
    if (c >= bestCost - 1e-6) return false;
    best = cs;
    bestCost = c;
    return true;
  };
  for (let round = 0; round < MAX_ROUNDS; round++) {
    let improved = false;
    for (const id of ids) {
      // Cells around the layout as it is now (it changes as moves are taken).
      const all = [...best.values()];
      const used = new Set(all.map(key));
      const m = grow ? 1 : 0;
      const c0 = Math.min(...all.map((p) => p.c)) - m;
      const c1 = Math.max(...all.map((p) => p.c)) + m;
      const r0 = Math.min(...all.map((p) => p.r)) - m;
      const r1 = Math.max(...all.map((p) => p.r)) + m;
      for (let c = c0; c <= c1; c++) {
        for (let r = r0; r <= r1; r++) {
          if (used.has(key({ c, r }))) continue;
          if (tryCells(new Map(best).set(id, { c, r }))) improved = true;
        }
      }
    }
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]!;
        const b = ids[j]!;
        if (tryCells(new Map(best).set(a, best.get(b)!).set(b, best.get(a)!))) improved = true;
      }
    }
    if (!improved) break;
  }
  return toPositions(best);
}

/** Rectangles that hold `n` states: at least two rows, wider than tall (we read left to right). */
function compactShapes(n: number): { cols: number; rows: number }[] {
  const shapes: { cols: number; rows: number }[] = [];
  for (let cols = Math.ceil(Math.sqrt(n)); cols <= Math.ceil(n / 2); cols++) {
    const rows = Math.ceil(n / cols);
    if (rows >= 2) shapes.push({ cols, rows });
  }
  return shapes;
}

/**
 * Compact starting points for `refineOnGrid`, from a layout `pos` (a candidate that found the
 * automaton's structure but spreads it out): its states packed into each compact rectangle,
 * keeping their order: into columns by x, then top to bottom by y in each, and into rows by y,
 * then left to right by x. Only starting points: the search moves states out of them freely, so
 * no shape is forced on the result; they let it reach compact layouts that hill climbing from the
 * spread-out candidate can't.
 */
export function compactSeeds(ids: readonly StateId[], pos: Positions): Positions[] {
  const at = (c: number, r: number) => ({ x: c * SPACING, y: r * SPACING });
  const p = (id: StateId) => pos.get(id)!;
  const byX = [...ids].sort((a, b) => p(a).x - p(b).x || p(a).y - p(b).y);
  const byY = [...ids].sort((a, b) => p(a).y - p(b).y || p(a).x - p(b).x);
  const seeds: Positions[] = [];
  for (const { cols, rows } of compactShapes(ids.length)) {
    seeds.push(
      new Map(
        chunks(byX, rows).flatMap((col, c) =>
          col.sort((a, b) => p(a).y - p(b).y).map((id, r) => [id, at(c, r)] as const),
        ),
      ),
    );
    seeds.push(
      new Map(
        chunks(byY, cols).flatMap((line, r) =>
          line.sort((a, b) => p(a).x - p(b).x).map((id, c) => [id, at(c, r)] as const),
        ),
      ),
    );
  }
  return seeds;
}

function chunks<T>(xs: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/** The free cell nearest `want` (rings of growing size around it). */
function nearestFree(want: Cell, taken: ReadonlySet<string>): Cell {
  if (!taken.has(key(want))) return want;
  for (let ring = 1; ; ring++) {
    let found: Cell | null = null;
    let foundDist = Infinity;
    for (let dc = -ring; dc <= ring; dc++) {
      for (let dr = -ring; dr <= ring; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
        const cell = { c: want.c + dc, r: want.r + dr };
        const d = Math.hypot(dc, dr);
        if (!taken.has(key(cell)) && d < foundDist) {
          found = cell;
          foundDist = d;
        }
      }
    }
    if (found) return found;
  }
}
