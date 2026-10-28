import type { Automaton, StateId, Sym } from './model';

export interface Highlight {
  states?: StateId[];
  transitions?: string[];
}

export interface StepBase {
  explanation: string;
  focus: Highlight;
}

export interface RunStep extends StepBase {
  phase: 'start' | 'closure' | 'read' | 'stuck' | 'verdict';
  /** Symbols consumed after this step. */
  position: number;
  /** For 'read' and 'stuck'. */
  symbol?: Sym;
  before: StateId[];
  active: StateId[];
  /** Transition ids used in this step. */
  taken: string[];
  /** On 'stuck' and 'verdict'. */
  verdict?: 'accept' | 'reject';
}

export interface RunTrace {
  kind: 'run';
  source: Automaton;
  word: string;
  steps: RunStep[];
  accepted: boolean;
}

// SubsetTrace (Task 6) and MinimizeTrace (Task 7) widen this union.
export type AnyTrace = RunTrace | SubsetTrace;

export interface SubsetStep extends StepBase {
  phase: 'init' | 'expand' | 'done';
  /** NFA states of the DFA state being expanded (init: the start closure). */
  subset: StateId[];
  symbol?: Sym;
  /** move(subset, symbol) */
  moved?: StateId[];
  /** ε-closure(moved) */
  closure?: StateId[];
  /** Id of the result DFA state reached. */
  target?: StateId;
  isNew?: boolean;
  /** Highlights in the result DFA. */
  dfaFocus: Highlight;
  /** Result DFA states built so far (cumulative). */
  revealedStates: StateId[];
  revealedTransitions: string[];
}

export interface SubsetTrace {
  kind: 'subset';
  source: Automaton;
  result: Automaton;
  steps: SubsetStep[];
}
