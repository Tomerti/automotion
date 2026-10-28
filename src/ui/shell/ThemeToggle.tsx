import { useState } from 'react';
import { DarkThemeIcon, LightThemeIcon } from './icons';
import { OTHER_THEME, readTheme, saveTheme } from './theme';
import type { Theme } from './theme';

const ICON: Record<Theme, () => React.JSX.Element> = {
  light: LightThemeIcon,
  dark: DarkThemeIcon,
};

/** Switches between light and dark; the icon shows the current theme. */
export function ThemeToggle(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const next = OTHER_THEME[theme];
  const Icon = ICON[theme];
  return (
    <button
      type="button"
      className="av-icon-button"
      aria-label={`Theme: ${theme}`}
      title={`Theme: ${theme} (switch to ${next})`}
      onClick={() => {
        saveTheme(next);
        setTheme(next);
      }}
    >
      <Icon />
    </button>
  );
}
