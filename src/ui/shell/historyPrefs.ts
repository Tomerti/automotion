import { useState } from 'react';

/** Whether the history bar is open, remembered per browser like the theme. */
export const HISTORY_BAR_KEY = 'automaton-vis:history-bar';

/** Below this width the bar starts closed, so it doesn't crowd a phone screen. */
const NARROW = '(max-width: 720px)';

/** The stored choice; with none, open except on narrow screens. */
export function readHistoryOpen(): boolean {
  try {
    const stored = window.localStorage.getItem(HISTORY_BAR_KEY);
    if (stored !== null) return stored === 'open';
  } catch {
    // No storage: fall back to the default.
  }
  return typeof window.matchMedia !== 'function' || !window.matchMedia(NARROW).matches;
}

/** Remember `open`. Storage is best-effort. */
export function saveHistoryOpen(open: boolean): void {
  try {
    window.localStorage.setItem(HISTORY_BAR_KEY, open ? 'open' : 'closed');
  } catch {
    // Not persisted; the choice still holds for this visit.
  }
}

export function useHistoryOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(readHistoryOpen);
  const toggle = (): void => {
    saveHistoryOpen(!open);
    setOpen(!open);
  };
  return [open, toggle];
}
