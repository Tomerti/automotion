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
 * finds none. Hand-drawn automata sit on such a
 * grid; the candidates that find their structure (a stress layout, ELK's layers) rarely do.
 */
export function refineOnGrid(
  ids: readonly StateId[],
  pos: Positions,
  cost: (pos: Positions) => number,
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
      const c0 = Math.min(...all.map((p) => p.c)) - 1;
      const c1 = Math.max(...all.map((p) => p.c)) + 1;
      const r0 = Math.min(...all.map((p) => p.r)) - 1;
      const r1 = Math.max(...all.map((p) => p.r)) + 1;
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
