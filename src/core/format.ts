import type { Automaton, StateId } from './model';

/** Formats state ids as "{q0, q2}" using labels, in the order of `a.states`. */
export function formatSet(a: Automaton, ids: StateId[]): string {
  const wanted = new Set(ids);
  const labels = a.states.filter((s) => wanted.has(s.id)).map((s) => s.label);
  return labels.length === 0 ? '∅' : `{${labels.join(', ')}}`;
}
