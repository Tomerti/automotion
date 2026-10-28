/** Colour theme preference: follow the system, or force light or dark. */
export type ThemePref = 'system' | 'light' | 'dark';

export const THEME_KEY = 'automaton-vis:theme';

/** The cycle the theme button walks through. */
export const NEXT_THEME: Record<ThemePref, ThemePref> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readTheme(): ThemePref {
  try {
    const v = storage()?.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Apply `pref` to `<html data-theme>` (absent = system); see src/ui/theme.css. */
export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

/** Apply and remember `pref`. Storage is best-effort. */
export function saveTheme(pref: ThemePref): void {
  applyTheme(pref);
  try {
    const s = storage();
    if (pref === 'system') s?.removeItem(THEME_KEY);
    else s?.setItem(THEME_KEY, pref);
  } catch {
    // Not persisted; the choice still holds for this visit.
  }
}
