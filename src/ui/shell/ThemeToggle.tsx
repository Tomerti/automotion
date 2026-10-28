import { useState } from 'react';
import { DarkThemeIcon, LightThemeIcon, SystemThemeIcon } from './icons';
import { NEXT_THEME, readTheme, saveTheme } from './theme';
import type { ThemePref } from './theme';

const LABEL: Record<ThemePref, string> = { system: 'system', light: 'light', dark: 'dark' };
const ICON: Record<ThemePref, () => React.JSX.Element> = {
  system: SystemThemeIcon,
  light: LightThemeIcon,
  dark: DarkThemeIcon,
};

/** Cycles system → light → dark; the icon shows the current choice. */
export function ThemeToggle(): React.JSX.Element {
  const [pref, setPref] = useState<ThemePref>(readTheme);
  const next = NEXT_THEME[pref];
  const Icon = ICON[pref];
  return (
    <button
      type="button"
      className="av-icon-button"
      aria-label={`Theme: ${LABEL[pref]}`}
      title={`Theme: ${LABEL[pref]} (switch to ${LABEL[next]})`}
      onClick={() => {
        saveTheme(next);
        setPref(next);
      }}
    >
      <Icon />
    </button>
  );
}
