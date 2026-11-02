import { newId } from './id';

export type StateId = string;
export type Sym = string;
export const EPSILON = 'ε';
export type AutomatonKind = 'DFA' | 'NFA';

export interface State {
  id: StateId;
  label: string;
  x: number;
  y: number;
  /**
   * Start states only: direction the start arrow comes from (radians, screen coordinates, from the
   * state's center toward the arrow's tail). Absent: from the left.
   */
  startAngle?: number;
}

export interface Transition {
  id: string;
  from: StateId;
  to: StateId;
  /** One edge per (from, to) pair, carrying all its symbols. */
  symbols: Sym[];
  /**
   * Signed offset of the curve's apex from the straight chord (world px), positive to the left of
   * from→to on screen. Absent: automatic (straight, or curved when the reverse edge exists).
   */
  bend?: number;
  /** Self-loops only: direction of the loop (radians, screen coordinates). Absent: automatic. */
  loopAngle?: number;
  /**
   * Not self-loops: the side of the arrow its symbols are drawn on, looking along from→to on
   * screen (for an arrow pointing right, left is above). Absent: automatic (outside the curve;
   * left when straight).
   */
  labelSide?: LabelSide;
}

export type LabelSide = 'left' | 'right';

export interface Automaton {
  id: string;
  name: string;
  kind: AutomatonKind;
  /** Explicit and editable; never contains ε. */
  alphabet: Sym[];
  states: State[];
  /**
   * Start states, in the order they became one, without duplicates. A DFA has at most one; an
   * NFA accepts when a run from any of them does.
   */
  starts: StateId[];
  accepting: StateId[];
  transitions: Transition[];
}

export function emptyAutomaton(name: string, kind: AutomatonKind): Automaton {
  return {
    id: newId(),
    name,
    kind,
    alphabet: [],
    states: [],
    starts: [],
    accepting: [],
    transitions: [],
  };
}

/** The start states that exist (a stale id in `starts` is ignored). */
export function startStates(a: Automaton): StateId[] {
  return a.starts.filter((id) => a.states.some((s) => s.id === id));
}
