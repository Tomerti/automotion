import { canEliminate, eliminate, GNFA_ACCEPT, GNFA_START } from '../core/eliminate';
import { canMinimize, minimize } from '../core/minimize';
import type { StateId } from '../core/model';
import { canRun, runWord } from '../core/run';
import { canConvert, subsetConstruction } from '../core/subset';
import { canThompson, thompson } from '../core/thompson';
import { appStore } from './store';

const message = (e: unknown, fallback: string): string =>
  e instanceof Error ? e.message : fallback;

/** Run `word` on the active automaton and open the resulting trace (no-op if it can't run). */
export function startRun(word: string): void {
  const { automata, activeId, openTrace } = appStore.getState();
  const a = automata.find((x) => x.id === activeId);
  if (!a || canRun(a, word) !== null) return;
  openTrace(runWord(a, word));
}

/**
 * Open Thompson's construction for `input` over whatever automaton is active (which stays
 * as it is; it is locked while the trace is open). No-op when the regex is refused.
 */
export function startThompson(input: string): void {
  if (canThompson(input) !== null) return;
  appStore.getState().openTrace(thompson(input));
}

/** A conversion is waiting for its layout: further Convert clicks are ignored until it settles. */
let converting = false;

/**
 * Convert the active NFA to a DFA: lay out the result and open the subset-construction trace.
 * Failures (the state cap, a layout error) are reported through `onError`. If the automaton,
 * the active automaton or the open trace changes while the layout runs, the result is dropped.
 */
export async function startSubset(onError?: (message: string) => void): Promise<void> {
  if (converting) return;
  const { automata, activeId } = appStore.getState();
  const a = automata.find((x) => x.id === activeId);
  if (!a || canConvert(a) !== null) return;
  let trace;
  try {
    trace = subsetConstruction(a);
  } catch (e) {
    onError?.(message(e, 'Could not convert the automaton'));
    return;
  }
  converting = true;
  let result;
  try {
    // In a worker, loaded on first use: elk stays out of the main bundle and off the main thread.
    const { layoutInWorker } = await import('../layout/layoutClient');
    result = await layoutInWorker(trace.result);
  } catch {
    onError?.('Could not lay out the automaton');
    return;
  } finally {
    converting = false;
  }
  const now = appStore.getState();
  const current = now.automata.find((x) => x.id === a.id);
  if (now.activeId !== a.id || current !== a || now.trace) return;
  now.openTrace({ ...trace, result });
}

/** Open the minimization walkthrough for the active automaton (no-op if it can't be minimized). */
export function startMinimize(): void {
  const { automata, activeId, openTrace } = appStore.getState();
  const a = automata.find((x) => x.id === activeId);
  if (!a || canMinimize(a) !== null) return;
  openTrace(minimize(a));
}

/**
 * Open the To regex walkthrough (state elimination) for the active automaton. No-op when
 * `canEliminate` refuses; a regex past the length cap is reported through `onError`.
 */
export function startEliminate(onError?: (message: string) => void): void {
  const { automata, activeId, openTrace } = appStore.getState();
  const a = automata.find((x) => x.id === activeId);
  if (!a || canEliminate(a) !== null) return;
  try {
    openTrace(eliminate(a));
  } catch (e) {
    onError?.(message(e, 'Could not turn the automaton into a regex'));
  }
}

/**
 * Make `stateId` the next state the open To regex walkthrough removes, from the step it is on (a
 * `gnfa`, `pick` or `remove` step, not the done one): the trace is recomputed with the states
 * removed so far, then `stateId`, and the player moves to its pick. On a pick step the click
 * replaces that pick. `s`, `f`, removed states and unknown ids do nothing. If the recomputed regex
 * grows too long, the trace stays as it was and `onError` gets the reason.
 */
export function pickEliminate(stateId: StateId, onError?: (message: string) => void): void {
  const { trace, stepIndex, replaceTrace } = appStore.getState();
  if (trace?.kind !== 'eliminate' || stepIndex >= trace.steps.length - 1) return;
  const step = trace.steps[stepIndex];
  if (!step || step.phase === 'done') return;
  if (stateId === GNFA_START || stateId === GNFA_ACCEPT) return;
  if (!trace.source.states.some((s) => s.id === stateId)) return;
  if (step.phase === 'pick' && step.removing === stateId) return;
  const removed =
    step.phase === 'pick' ? (trace.steps[stepIndex - 1]?.removed ?? []) : step.removed;
  if (removed.includes(stateId)) return;
  let next;
  try {
    next = eliminate(trace.source, [...removed, stateId]);
  } catch (e) {
    onError?.(message(e, 'Could not turn the automaton into a regex'));
    return;
  }
  const pick = next.steps.findIndex((s) => s.phase === 'pick' && s.removing === stateId);
  replaceTrace(next, pick);
}
