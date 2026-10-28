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
}

export interface Transition {
  id: string;
  from: StateId;
  to: StateId;
  /** One edge per (from, to) pair, carrying all its symbols. */
  symbols: Sym[];
}

export interface Automaton {
  id: string;
  name: string;
  kind: AutomatonKind;
  /** Explicit and editable; never contains ε. */
  alphabet: Sym[];
  states: State[];
  start: StateId | null;
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
    start: null,
    accepting: [],
    transitions: [],
  };
}
