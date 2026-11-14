import { useCallback, useEffect, useState } from 'react';

/** Set once the welcome dialog has been answered, so it opens by itself only until then. */
export const SEEN_HELP_KEY = 'automotion:seen-help';

export function hasSeenHelp(): boolean {
  try {
    return window.localStorage.getItem(SEEN_HELP_KEY) !== null;
  } catch {
    // No storage: treat every visit as a return visit rather than nag on each load.
    return true;
  }
}

export function markHelpSeen(): void {
  try {
    window.localStorage.setItem(SEEN_HELP_KEY, '1');
  } catch {
    // Best-effort.
  }
}

/** Keys typed into a field are text, not shortcuts. */
export function isTypingTarget(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLElement &&
    (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)
  );
}

/**
 * Open state of the welcome dialog: open on every visit until it is answered (closed, or the
 * tutorial started). Marked seen on close, not on open: a reload before answering (Vite's own
 * reload after optimizing dependencies, a refresh) would otherwise lose it for good. `suppress`
 * (arrived by a share link) starts it closed without marking it seen.
 */
export function useWelcome(suppress = false): [boolean, () => void] {
  const [open, setOpen] = useState(() => !suppress && !hasSeenHelp());
  const close = useCallback((): void => {
    markHelpSeen();
    setOpen(false);
  }, []);
  return [open, close];
}

/** Open state of the controls popup: opened by `?` anywhere (and the help button). */
export function useControlsHelp(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return [open, setOpen];
}
