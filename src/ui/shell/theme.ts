/** The colour theme in use. */
export type Theme = 'light' | 'dark';

/** The user's choice: follow the system (the default), or force light or dark. */
export type ThemePref = 'system' | Theme;

export const THEME_KEY = 'automotion:theme';

/** The choices, in the order the theme menu lists them. */
export const THEME_PREFS: readonly ThemePref[] = ['system', 'light', 'dark'];

const DARK_QUERY = '(prefers-color-scheme: dark)';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function darkQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
}

/** What the system prefers; light when it can't tell. */
export function systemTheme(): Theme {
  return darkQuery()?.matches ? 'dark' : 'light';
}

/** The theme `pref` shows right now. */
export function resolveTheme(pref: ThemePref): Theme {
  return pref === 'system' ? systemTheme() : pref;
}

/** The stored choice; nothing stored (or anything unknown) follows the system. */
export function readTheme(): ThemePref {
  try {
    const v = storage()?.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** The last choice applied, so a system change knows whether to follow it. */
let current: ThemePref = 'system';

/**
 * Apply `pref` to `<html data-theme>`, always as the resolved `light` or `dark` (see
 * src/ui/theme.css), so styles never have to know about the system choice.
 */
export function applyTheme(pref: ThemePref): void {
  current = pref;
  document.documentElement.setAttribute('data-theme', resolveTheme(pref));
}

const saved = new Set<(pref: ThemePref) => void>();

/**
 * Call `listener` with each choice `saveTheme` makes, so every control showing the choice (the
 * theme menu, the welcome's switch) agrees. Returns the unsubscribe.
 */
export function onThemeSaved(listener: (pref: ThemePref) => void): () => void {
  saved.add(listener);
  return () => saved.delete(listener);
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
  saved.forEach((l) => l(pref));
}

/**
 * While the choice is "system", switch with the system as it changes (e.g. a scheduled dark
 * mode at sunset). Returns the unsubscribe.
 */
export function followSystemTheme(onChange?: () => void): () => void {
  const query = darkQuery();
  if (!query) return () => {};
  const listener = (): void => {
    if (current !== 'system') return;
    applyTheme('system');
    onChange?.();
  };
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
