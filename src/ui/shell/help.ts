import { useEffect, useState } from 'react';

/** Set once the welcome dialog has been shown, so it opens by itself only on the first visit. */
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

/** Open state of the welcome dialog: open on the first visit only. */
export function useWelcome(): [boolean, () => void] {
  const [open, setOpen] = useState(() => !hasSeenHelp());
  useEffect(() => {
    if (open) markHelpSeen();
  }, [open]);
  return [open, () => setOpen(false)];
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
