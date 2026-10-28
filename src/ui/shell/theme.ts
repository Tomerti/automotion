/** Colour theme: light (the default, whatever the system prefers) or dark. */
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'automaton-vis:theme';

export const OTHER_THEME: Record<Theme, Theme> = { light: 'dark', dark: 'light' };

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The stored theme; anything else (nothing stored, an old "system" choice) is light. */
export function readTheme(): Theme {
  try {
    return storage()?.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Apply `theme` to `<html data-theme>`; see src/ui/theme.css. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

/** Apply and remember `theme`. Storage is best-effort. */
export function saveTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    storage()?.setItem(THEME_KEY, theme);
  } catch {
    // Not persisted; the choice still holds for this visit.
  }
}
