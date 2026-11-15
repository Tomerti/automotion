import { labelPlainText } from './label';
import type { Automaton, State, StateId } from './model';

/**
 * What a minimized state stands for, as plain text for its tooltip: `A = {q₀, q₁, q₂}`. Null
 * when it doesn't carry `mergedFrom`.
 */
export function mergedNote(s: State): string | null {
  if (!s.mergedFrom || s.mergedFrom.length === 0) return null;
  return `${labelPlainText(s.label)} = {${s.mergedFrom.map(labelPlainText).join(', ')}}`;
}

/** `name` with `suffix` appended, unless it already ends with it ("D (min)" stays "D (min)"). */
export function withSuffix(name: string, suffix: string): string {
  return name.endsWith(suffix) ? name : `${name}${suffix}`;
}

/** Formats state ids as "{q0, q2}" using labels, in the order of `a.states`. */
export function formatSet(a: Automaton, ids: StateId[]): string {
  const wanted = new Set(ids);
  const labels = a.states.filter((s) => wanted.has(s.id)).map((s) => s.label);
  return labels.length === 0 ? '∅' : `{${labels.join(', ')}}`;
}
