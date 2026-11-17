import { canBuildFromRegex, regexToMinimalDfa } from '../core/regexToDfa';
import { appStore } from './store';

/**
 * Build the minimal DFA of `input`, lay it out, add it as a new automaton and open it (that
 * closes any open trace). Returns its id, or null when the regex is refused or the layout fails
 * (nothing is added then).
 */
export async function createFromRegex(input: string): Promise<string | null> {
  if (canBuildFromRegex(input) !== null) return null;
  try {
    const dfa = regexToMinimalDfa(input);
    // In a worker, loaded on first use: elk stays out of the main bundle and off the main thread.
    const { layoutInWorker } = await import('../layout/layoutClient');
    const laid = await layoutInWorker(dfa);
    appStore.getState().addAutomaton(laid);
    return laid.id;
  } catch {
    return null;
  }
}
