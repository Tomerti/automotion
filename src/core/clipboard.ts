import { syncAlphabet } from './edit';
import { newId } from './id';
import { EPSILON } from './model';
import type { Automaton, State, StateId, Transition } from './model';

/**
 * States copied with Ctrl+C: a snapshot taken at copy time, so later edits (or deleting the
 * originals) don't change what Ctrl+V pastes.
 */
export interface Clip {
  /** In the automaton's order, with their original ids and positions. */
  states: State[];
  /** The copied states that accept. */
  accepting: StateId[];
  /**
   * Every arrow out of a copied state: to another copied state, or to a state outside the copy
   * (named by its id in the automaton copied from).
   */
  transitions: Transition[];
}

/** Copy the states `ids` of `a` (ids that are not states are ignored); null if none is. */
export function copyStates(a: Automaton, ids: readonly StateId[]): Clip | null {
  const picked = new Set(ids);
  const states = a.states.filter((s) => picked.has(s.id));
  if (states.length === 0) return null;
  const copied = new Set(states.map((s) => s.id));
  return {
    states,
    accepting: a.accepting.filter((id) => copied.has(id)),
    // Arrows into the copy from outside are left out: they would give the outside state a
    // second arrow on the same symbols, changing how it behaves (and a DFA's determinism).
    transitions: a.transitions.filter((t) => copied.has(t.from)),
  };
}

/**
 * Arrows into the states `ids` from states outside them: what copying leaves out. A cut keeps
 * them so that pasting it back (`pasteClip`'s `incoming`) is a move, not a copy.
 */
export function incomingArrows(a: Automaton, ids: readonly StateId[]): Transition[] {
  const picked = new Set(ids);
  return a.transitions.filter((t) => picked.has(t.to) && !picked.has(t.from));
}

/** `label`, or `label'`, `label''`, … if taken. */
export function uniqueLabel(label: string, taken: ReadonlySet<string>): string {
  let out = label;
  while (taken.has(out)) out += "'";
  return out;
}

/** Centre of the copied states' bounding box, in world coordinates. */
export function clipCenter(clip: Clip): { x: number; y: number } {
  const xs = clip.states.map((s) => s.x);
  const ys = clip.states.map((s) => s.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

/** Ids of the arrows of `a` whose both ends are among `stateIds`. */
export function internalTransitions(a: Automaton, stateIds: readonly StateId[]): string[] {
  const ids = new Set(stateIds);
  return a.transitions.filter((t) => ids.has(t.from) && ids.has(t.to)).map((t) => t.id);
}

/**
 * Paste `clip` into `a`, moved by `offset`. The copies get fresh ids and keep their labels when
 * free, otherwise gain primes (q_1 → q_1'). Accepting is copied, start is not. Arrows between
 * copied states are copied; arrows to an outside state are kept when `a` has that state. An
 * ε-arrow pasted into a DFA turns it into an NFA (`promoted`). The alphabet is synced.
 *
 * `incoming` (from `incomingArrows`, for a cut pasted back) are arrows from states of `a` into
 * the copied states: each is restored into the copy when `a` still has its source state. On a
 * DFA, symbols the source state now reads on another arrow are left off, so it stays
 * deterministic, and an arrow left with none is dropped.
 */
export function pasteClip(
  a: Automaton,
  clip: Clip,
  offset: { x: number; y: number },
  incoming: readonly Transition[] = [],
): { automaton: Automaton; stateIds: StateId[]; transitionIds: string[]; promoted: boolean } {
  const taken = new Set(a.states.map((s) => s.label));
  const newIds = new Map<StateId, StateId>();
  const states: State[] = clip.states.map((s) => {
    const id = newId();
    newIds.set(s.id, id);
    const label = uniqueLabel(s.label, taken);
    taken.add(label);
    // Not a start state, so no start arrow direction.
    return {
      id,
      label,
      x: s.x + offset.x,
      y: s.y + offset.y,
      ...(s.mergedFrom ? { mergedFrom: s.mergedFrom } : {}),
    };
  });
  const existing = new Set(a.states.map((s) => s.id));
  const transitions: Transition[] = [];
  for (const t of clip.transitions) {
    const from = newIds.get(t.from);
    const to = newIds.get(t.to) ?? (existing.has(t.to) ? t.to : undefined);
    if (from === undefined || to === undefined) continue;
    transitions.push({ ...t, id: newId(), from, to, symbols: [...t.symbols] });
  }
  for (const t of incoming) {
    const to = newIds.get(t.to);
    if (to === undefined || !existing.has(t.from)) continue;
    const used = new Set(
      a.kind === 'DFA'
        ? a.transitions.filter((u) => u.from === t.from).flatMap((u) => u.symbols)
        : [],
    );
    const symbols = t.symbols.filter((s) => !used.has(s));
    if (symbols.length === 0) continue;
    transitions.push({ ...t, id: newId(), to, symbols });
  }
  const promoted = a.kind === 'DFA' && transitions.some((t) => t.symbols.includes(EPSILON));
  const automaton = syncAlphabet({
    ...a,
    kind: promoted ? 'NFA' : a.kind,
    states: [...a.states, ...states],
    accepting: [...a.accepting, ...clip.accepting.flatMap((id) => newIds.get(id) ?? [])],
    transitions: [...a.transitions, ...transitions],
  });
  return {
    automaton,
    stateIds: states.map((s) => s.id),
    transitionIds: transitions.map((t) => t.id),
    promoted,
  };
}
