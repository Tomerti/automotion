/**
 * True on a touch-only device (a phone, a tablet): the main pointer is coarse and no attached
 * pointer is fine. A laptop with a touch screen has a mouse or trackpad, so it is not touch-only.
 */
export function isTouchOnly(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches &&
    !window.matchMedia('(any-pointer: fine)').matches
  );
}
