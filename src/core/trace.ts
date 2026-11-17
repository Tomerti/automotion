import type { Automaton, StateId, Sym } from './model';
import type { Span } from './regex';

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

export type AnyTrace = RunTrace | SubsetTrace | MinimizeTrace | ThompsonTrace;

/** Id of the automaton a trace was computed from; null for a trace with no source (Thompson). */
export function traceSourceId(t: AnyTrace): string | null {
  return t.kind === 'thompson' ? null : t.source.id;
}

export interface SubsetStep extends StepBase {
  /** `starts`: several start states, so a single new one is added first. */
  phase: 'starts' | 'init' | 'expand' | 'done';
  /** NFA states of the DFA state being expanded (init: the start closure; starts: none). */
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

export interface MinimizeStep extends StepBase {
  phase: 'trim' | 'complete' | 'partition' | 'split' | 'done';
  /** The working DFA to draw at this step. */
  automaton: Automaton;
  /** 'trim': states fading out (still present in `automaton`). */
  removed?: StateId[];
  /** 'complete': the added dead state. */
  deadState?: StateId;
  /** Current partition; block i is named `blockName(i)` (minimize.ts): A … Z, AA, AB, … */
  blocks: StateId[][];
  split?: { block: number; parts: StateId[][]; witness: { p: StateId; q: StateId; symbol: Sym } };
}

export interface MinimizeTrace {
  kind: 'minimize';
  source: Automaton;
  result: Automaton;
  steps: MinimizeStep[];
  /** Nothing was removed or merged: `result` is `source` (plus at most a dead state). */
  alreadyMinimal: boolean;
}

export interface ThompsonStep extends StepBase {
  phase: 'intro' | 'build' | 'done';
  /** build: this node's span in `trace.regex`. */
  span?: Span;
  /** Spans of every node built so far, this one included. */
  builtSpans: Span[];
  newStates: StateId[];
  newTransitions: string[];
  /** build: every state of this piece; done: all. */
  pieceStates: StateId[];
  /** build and done. */
  pieceStart?: StateId;
  pieceAccept?: StateId;
  /** Cumulative. */
  revealedStates: StateId[];
  revealedTransitions: string[];
}

export interface ThompsonTrace {
  kind: 'thompson';
  /** The normalised regex text that the spans index. */
  regex: string;
  result: Automaton;
  steps: ThompsonStep[];
}
