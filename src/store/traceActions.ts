import { canMinimize, minimize } from '../core/minimize';
import { canRun, runWord } from '../core/run';
import { canConvert, subsetConstruction } from '../core/subset';
import { appStore } from './store';

/** Run `word` on the active automaton and open the resulting trace (no-op if it can't run). */
export function startRun(word: string): void {
  const { automata, activeId, openTrace } = appStore.getState();
  const a = automata.find((x) => x.id === activeId);
  if (!a || canRun(a, word) !== null) return;
  openTrace(runWord(a, word));
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
    onError?.(e instanceof Error ? e.message : 'Could not convert the automaton');
    return;
  }
  converting = true;
  let result;
  try {
    // Dynamic import keeps elk out of the main bundle.
    const { layoutAutomaton } = await import('../layout/layout');
    result = await layoutAutomaton(trace.result);
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
