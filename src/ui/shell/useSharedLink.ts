import { useEffect } from 'react';
import { decodeShare, readShareHash, sameAutomaton } from '../../persistence/shareLink';
import { appStore } from '../../store/store';
import { fitActive } from '../canvas/useCanvasEditing';
import { toast } from './toastStore';

/** Whether this page load came through a share link; read once, before the hash is cleared. */
const ARRIVED_BY_LINK = readShareHash(window.location.hash) !== null;
export function arrivedByLink(): boolean {
  return ARRIVED_BY_LINK;
}

/** Open the automaton in a `#a=` share link (a saved copy if there is one, else add it). */
export async function openSharedLink(hash: string): Promise<void> {
  const payload = readShareHash(hash);
  if (payload === null) return;
  // Before the async decode, so a second call for the same hash (StrictMode) finds nothing.
  history.replaceState(null, '', location.pathname + location.search);
  const app = appStore.getState();
  const result = await decodeShare(payload, new Set(app.automata.map((a) => a.id)));
  const incoming = result.ok ? result.automata[0] : undefined;
  if (!incoming) {
    toast("This link's automaton couldn't be read", 'error');
    return;
  }
  const state = appStore.getState();
  const saved = state.automata.find((a) => sameAutomaton(a, incoming));
  if (saved) {
    state.setActive(saved.id);
    // setActive keeps an open trace when the automaton is already active.
    if (appStore.getState().trace) appStore.getState().closeTrace();
  } else {
    state.addAutomaton(incoming);
  }
  const id = saved?.id ?? incoming.id;
  // Once the canvas has its size.
  requestAnimationFrame(() => {
    if (appStore.getState().activeId === id) fitActive();
  });
  toast(`Opened “${(saved ?? incoming).name}”`);
}

/** Open a shared link on load and whenever the hash changes. */
export function useSharedLink(): void {
  useEffect(() => {
    void openSharedLink(location.hash);
    const onChange = (): void => void openSharedLink(location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
}
