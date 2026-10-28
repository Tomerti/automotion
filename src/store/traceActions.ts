import { canRun, runWord } from '../core/run';
import { appStore } from './store';

/** Run `word` on the active automaton and open the resulting trace (no-op if it can't run). */
export function startRun(word: string): void {
  const { automata, activeId, openTrace } = appStore.getState();
  const a = automata.find((x) => x.id === activeId);
  if (!a || canRun(a, word) !== null) return;
  openTrace(runWord(a, word));
}
