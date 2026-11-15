/**
 * The letter of a Ctrl/⌘ shortcut, lower case, whatever the keyboard layout: `e.key` when it is
 * a Latin letter (so AZERTY's Ctrl+A is the key labelled A), else the physical key (`e.code`),
 * since a Hebrew or Russian layout reports Ctrl+A as `ש` or `ф`. `''` for a key with no letter.
 */
export function shortcutLetter(e: { key: string; code: string }): string {
  if (/^[a-z]$/i.test(e.key)) return e.key.toLowerCase();
  const m = /^Key([A-Z])$/.exec(e.code);
  return m?.[1]?.toLowerCase() ?? '';
}

/** Ctrl+`letter` (⌘ on a Mac), without Shift or Alt, on any keyboard layout. */
export function isCtrlLetter(
  e: {
    key: string;
    code: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  },
  letter: string,
): boolean {
  return (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && shortcutLetter(e) === letter;
}
