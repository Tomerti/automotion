import { EPSILON, type Automaton, type StateId } from '../core/model';

/** Each state's successors, in the order a person reads them: ε first, then by symbol. */
function successors(a: Automaton): Map<StateId, StateId[]> {
  const rank = (syms: string[]): string =>
    syms.map((s) => (s === EPSILON ? '' : s)).sort()[0] ?? '';
  const out = new Map<StateId, StateId[]>(a.states.map((s) => [s.id, []]));
  const sorted = [...a.transitions]
    .filter((t) => t.from !== t.to)
    .sort((p, q) => rank(p.symbols).localeCompare(rank(q.symbols)));
  for (const t of sorted) out.get(t.from)?.push(t.to);
  return out;
}

function traverse(a: Automaton, depthFirst: boolean): StateId[] {
  const next = successors(a);
  const seen = new Set<StateId>();
  const order: StateId[] = [];
  const roots = [...a.starts, ...a.states.map((s) => s.id)];
  for (const root of roots) {
    if (seen.has(root) || !next.has(root)) continue;
    if (depthFirst) {
      const visit = (id: StateId): void => {
        if (seen.has(id)) return;
        seen.add(id);
        order.push(id);
        for (const n of next.get(id) ?? []) visit(n);
      };
      visit(root);
    } else {
      const queue = [root];
      seen.add(root);
      while (queue.length > 0) {
        const id = queue.shift()!;
        order.push(id);
        for (const n of next.get(id) ?? []) {
          if (!seen.has(n)) {
            seen.add(n);
            queue.push(n);
          }
        }
      }
    }
  }
  return order;
}

/**
 * Orders in which a reader meets the states: breadth-first and depth-first from the start
 * states (then from any state not reached), without duplicates.
 */
export function readingOrders(a: Automaton): StateId[][] {
  const bfs = traverse(a, false);
  const dfs = traverse(a, true);
  return bfs.join('\n') === dfs.join('\n') ? [bfs] : [bfs, dfs];
}
