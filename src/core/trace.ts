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
export type AnyTrace = RunTrace;
