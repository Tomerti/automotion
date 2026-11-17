import { canBuildFromRegex, regexToMinimalDfa } from '../core/regexToDfa';
import { appStore } from './store';

/**
 * Build the minimal DFA of `input` and lay it out. The dialog opens from the empty canvas, so the
 * DFA goes into that canvas: the active automaton, when it has no states and can be edited, gets
 * the DFA's states, transitions, kind and name in place (its history entry and id stay; one undo
 * step brings the empty one back). With nothing to fill (no automaton, or the active one isn't
 * empty), it is added as a new automaton and opened, which closes any open trace.
 *
 * Returns the id of the automaton that now holds the DFA, or null when the regex is refused or the
 * layout fails (nothing changes then; a layout failure is also reported through `onError`, like
 * `startSubset`). If the target changes during the layout (it got states, another one opened, a
 * trace opened), the DFA is added as a new automaton instead of overwriting anything.
 */
export async function createFromRegex(
  input: string,
  onError?: (message: string) => void,
): Promise<string | null> {
  if (canBuildFromRegex(input) !== null) return null;
  const dfa = regexToMinimalDfa(input);
  const target = emptyTarget();
  let laid;
  try {
    // In a worker, loaded on first use: elk stays out of the main bundle and off the main thread.
    const { layoutInWorker } = await import('../layout/layoutClient');
    laid = await layoutInWorker(dfa);
  } catch {
    onError?.('Could not lay out the automaton');
    return null;
  }
  if (target !== null && emptyTarget() === target) {
    appStore.getState().edit(() => ({ ...laid, id: target }));
    return target;
  }
  appStore.getState().addAutomaton(laid);
  return laid.id;
}

/** The active automaton's id when it can take the DFA in place: no states, editable, no trace, and not a lesson's. */
function emptyTarget(): string | null {
  const { activeId, automata, readOnly, lessonIds, trace } = appStore.getState();
  if (activeId === null || trace !== null || readOnly.includes(activeId)) return null;
  if (lessonIds.includes(activeId)) return null;
  const active = automata.find((a) => a.id === activeId);
  return active && active.states.length === 0 ? activeId : null;
}
