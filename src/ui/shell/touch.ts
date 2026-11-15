import { useSyncExternalStore } from 'react';

const COARSE = '(pointer: coarse)';
const ANY_FINE = '(any-pointer: fine)';

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

/**
 * True on a touch-only device (a phone, a tablet): the main pointer is coarse and no attached
 * pointer is fine. A laptop with a touch screen has a mouse or trackpad, so it is not touch-only.
 */
export function isTouchOnly(): boolean {
  if (!hasMatchMedia()) return false;
  return window.matchMedia(COARSE).matches && !window.matchMedia(ANY_FINE).matches;
}

/** Calls `onChange` whenever either pointer query flips; returns the unsubscribe. */
function subscribe(onChange: () => void): () => void {
  if (!hasMatchMedia()) return () => {};
  const queries = [window.matchMedia(COARSE), window.matchMedia(ANY_FINE)];
  for (const q of queries) q.addEventListener?.('change', onChange);
  return () => {
    for (const q of queries) q.removeEventListener?.('change', onChange);
  };
}

/**
 * `isTouchOnly()`, kept current: attaching a mouse or keyboard to a tablet (or detaching it)
 * re-renders with the new answer.
 */
export function useTouchOnly(): boolean {
  return useSyncExternalStore(subscribe, isTouchOnly, () => false);
}
