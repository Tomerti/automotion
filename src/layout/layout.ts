import type { Automaton, State, StateId, Transition } from '../core/model';
import { SPACING, assignBends, assignStartAngles, layoutCost } from './aesthetics';
import {
  LAYERED_VARIANTS,
  circleLayout,
  elkLayered,
  rowLayout,
  stressLayout,
  type Positions,
} from './candidates';
import { readingOrders } from './order';

/** Largest connected part laid out on a single row, or around a circle, as a candidate. */
const MAX_ROW = 8;
const MAX_CIRCLE = 12;
/** Parts larger than this choose bends for their two best candidates only. */
const SHORTLIST_ABOVE = 16;
/** Room between connected parts stacked under each other. */
const PART_GAP = SPACING;

/**
 * Lays an automaton out for reading: several candidate layouts (a row, a circle, ELK's layered
 * and stress layouts) of each connected part, each with its arrows bent clear of the states and
 * its start arrows pointed into free space, scored on how the canvas draws them; the cheapest
 * wins. Parts are stacked top to bottom, the one with a start state first.
 *
 * Replaces every state's position and `startAngle`, and every transition's `bend`,
 * `loopAngle` and `labelSide` (left automatic where that reads best); nothing else changes.
 */
export async function layoutAutomaton(a: Automaton): Promise<Automaton> {
  if (a.states.length === 0) return a;
  const plain = withoutDrawingChoices(a);
  let placed: Automaton | null = null;
  let top = 0;
  for (const part of connectedParts(plain)) {
    const best = await bestLayout(part);
    const box = extent(best.states);
    const shifted = translate(best, -box.x0, top - box.y0);
    top += box.y1 - box.y0 + PART_GAP;
    placed = placed === null ? shifted : merge(placed, shifted);
  }
  const pos = new Map(placed!.states.map((s) => [s.id, s]));
  const drawn = new Map(placed!.transitions.map((t) => [t.id, t]));
  return {
    ...a,
    states: a.states.map((s) => pos.get(s.id) ?? s),
    transitions: plain.transitions.map((t) => drawn.get(t.id) ?? t),
  };
}

async function bestLayout(part: Automaton): Promise<Automaton> {
  if (part.states.length === 1) {
    return assignStartAngles(place(part, new Map([[part.states[0]!.id, { x: 0, y: 0 }]])));
  }
  const candidates: Positions[] = [];
  for (const order of readingOrders(part)) {
    if (part.states.length <= MAX_ROW) candidates.push(rowLayout(order));
    if (part.states.length >= 3 && part.states.length <= MAX_CIRCLE) {
      candidates.push(circleLayout(order));
    }
  }
  const [order] = readingOrders(part);
  for (const variant of LAYERED_VARIANTS) {
    try {
      candidates.push(await elkLayered(part, order!, variant));
    } catch {
      // ELK rejects some graphs under some options: the other candidates remain.
    }
  }
  candidates.push(stressLayout(part, order!));

  // Distinct candidates, start arrows pointed. Large parts first keep the two that read best
  // with automatic bends: choosing bends is the slow part.
  const seen = new Set<string>();
  let shortlist: Automaton[] = [];
  for (const c of candidates) {
    const key = signature(c);
    if (seen.has(key)) continue;
    seen.add(key);
    shortlist.push(assignStartAngles(place(part, c)));
  }
  if (part.states.length > SHORTLIST_ABOVE) {
    shortlist = shortlist
      .map((c) => ({ c, cost: layoutCost(c) }))
      .sort((p, q) => p.cost - q.cost)
      .slice(0, 2)
      .map(({ c }) => c);
  }

  let best: Automaton | null = null;
  let bestCost = Infinity;
  for (const c of shortlist) {
    const laidOut = assignStartAngles(assignBends(c));
    const cost = layoutCost(laidOut);
    if (cost < bestCost) {
      bestCost = cost;
      best = laidOut;
    }
  }
  return best!;
}

/** Drops the hand-made drawing choices: bends, loop and start arrow directions, label sides. */
function withoutDrawingChoices(a: Automaton): Automaton {
  return {
    ...a,
    states: a.states.map((s) => {
      const plain: State = { ...s };
      delete plain.startAngle;
      return plain;
    }),
    transitions: a.transitions.map((t) => {
      const plain: Transition = { ...t };
      delete plain.bend;
      delete plain.loopAngle;
      delete plain.labelSide;
      return plain;
    }),
  };
}

/** The parts of the automaton connected by transitions (either way), in reading order. */
function connectedParts(a: Automaton): Automaton[] {
  const neighbors = new Map<StateId, StateId[]>(a.states.map((s) => [s.id, []]));
  for (const t of a.transitions) {
    neighbors.get(t.from)?.push(t.to);
    neighbors.get(t.to)?.push(t.from);
  }
  const roots = [...a.starts, ...a.states.map((s) => s.id)];
  const partOf = new Map<StateId, number>();
  let count = 0;
  for (const root of roots) {
    if (partOf.has(root) || !neighbors.has(root)) continue;
    const stack = [root];
    partOf.set(root, count);
    while (stack.length > 0) {
      for (const n of neighbors.get(stack.pop()!) ?? []) {
        if (!partOf.has(n)) {
          partOf.set(n, count);
          stack.push(n);
        }
      }
    }
    count++;
  }
  return Array.from({ length: count }, (_, i) => {
    const ids = new Set(a.states.filter((s) => partOf.get(s.id) === i).map((s) => s.id));
    return {
      ...a,
      states: a.states.filter((s) => ids.has(s.id)),
      starts: a.starts.filter((id) => ids.has(id)),
      accepting: a.accepting.filter((id) => ids.has(id)),
      transitions: a.transitions.filter((t) => ids.has(t.from) && ids.has(t.to)),
    };
  });
}

function place(a: Automaton, pos: Positions): Automaton {
  return {
    ...a,
    states: a.states.map((s) => {
      const p = pos.get(s.id);
      return p ? { ...s, x: Math.round(p.x), y: Math.round(p.y) } : s;
    }),
  };
}

function signature(pos: Positions): string {
  return [...pos]
    .sort(([p], [q]) => p.localeCompare(q))
    .map(([id, p]) => `${id}:${Math.round(p.x)},${Math.round(p.y)}`)
    .join(' ');
}

function extent(states: State[]): { x0: number; y0: number; x1: number; y1: number } {
  const xs = states.map((s) => s.x);
  const ys = states.map((s) => s.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function translate(a: Automaton, dx: number, dy: number): Automaton {
  return { ...a, states: a.states.map((s) => ({ ...s, x: s.x + dx, y: s.y + dy })) };
}

function merge(p: Automaton, q: Automaton): Automaton {
  return {
    ...p,
    states: [...p.states, ...q.states],
    transitions: [...p.transitions, ...q.transitions],
  };
}
