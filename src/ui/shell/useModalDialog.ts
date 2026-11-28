import { useEffect, useRef } from 'react';

/**
 * Keyboard and focus for a modal dialog: it takes focus when it opens (no ring on a button when
 * it opens by itself), Escape closes it, Tab cycles through its `[data-focus-stop]` elements, `?`
 * doesn't open the Controls popup on top of it, and focus goes back where it was on close.
 */
export function useModalDialog(
  dialogRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  const latestClose = useRef(onClose);
  useEffect(() => {
    latestClose.current = onClose;
  });

  useEffect(() => {
    const before = document.activeElement;
    // Clicked, not reached with the keyboard: give the focus back without a ring.
    const quiet = before instanceof HTMLElement && !before.matches(':focus-visible');
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        // Keep Escape from also closing a trace or a menu underneath.
        e.stopPropagation();
        latestClose.current();
      } else if (e.key === '?') {
        e.stopPropagation();
      } else if (e.key === 'Tab') {
        const stops = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>('[data-focus-stop]') ?? [],
        ).filter((el) => el.tabIndex >= 0);
        if (stops.length === 0) return;
        e.preventDefault();
        const at = stops.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey
          ? at <= 0
            ? stops.length - 1
            : at - 1
          : at === -1 || at === stops.length - 1
            ? 0
            : at + 1;
        stops[next]?.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (!(before instanceof HTMLElement)) return;
      if (quiet) focusWithoutRing(before);
      else before.focus();
    };
  }, [dialogRef]);
}

/**
 * Focus `el` with its focus ring hidden (`[data-quiet-focus]` in `theme.css`) until a key is
 * pressed or the focus leaves. Escape pressed in a text box would otherwise ring the button the
 * dialog was opened from by a click: focus moved by a script after a key press, or away from an
 * element showing its ring (a text box always does), is `:focus-visible` in Chrome.
 */
function focusWithoutRing(el: HTMLElement): void {
  el.setAttribute('data-quiet-focus', '');
  const done = (): void => {
    el.removeAttribute('data-quiet-focus');
    el.removeEventListener('blur', done);
    window.removeEventListener('keydown', done, true);
  };
  el.addEventListener('blur', done);
  el.focus();
  // After the Escape that closed the dialog, still being dispatched, has passed.
  setTimeout(() => window.addEventListener('keydown', done, true));
}
