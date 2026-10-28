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

/** Convert the active NFA to a DFA: lay out the result and open the subset-construction trace. */
export async function startSubset(): Promise<void> {
  const { automata, activeId, openTrace } = appStore.getState();
  const a = automata.find((x) => x.id === activeId);
  if (!a || canConvert(a) !== null) return;
  const trace = subsetConstruction(a);
  // Dynamic import keeps elk out of the main bundle.
  const { layoutAutomaton } = await import('../layout/layout');
  const result = await layoutAutomaton(trace.result);
  openTrace({ ...trace, result });
}

/** Open the minimization walkthrough for the active automaton (no-op if it can't be minimized). */
export function startMinimize(): void {
  const { automata, activeId, openTrace } = appStore.getState();
  const a = automata.find((x) => x.id === activeId);
  if (!a || canMinimize(a) !== null) return;
  openTrace(minimize(a));
}
