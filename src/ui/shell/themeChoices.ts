import { useEffect, useState } from 'react';
import { DarkThemeIcon, LightThemeIcon, SystemThemeIcon } from './icons';
import { onThemeSaved, readTheme } from './theme';
import type { ThemePref } from './theme';

/** How the theme menu and the welcome's switch name each choice. */
export const THEME_LABEL: Record<ThemePref, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

export const THEME_ICON: Record<ThemePref, () => React.JSX.Element> = {
  system: SystemThemeIcon,
  light: LightThemeIcon,
  dark: DarkThemeIcon,
};

/** The theme choice, starting from the stored one and following every `saveTheme`. */
export function useThemePref(): ThemePref {
  const [pref, setPref] = useState<ThemePref>(readTheme);
  useEffect(() => onThemeSaved(setPref), []);
  return pref;
}
