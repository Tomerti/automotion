import { saveTheme, THEME_PREFS } from './theme';
import { THEME_ICON, THEME_LABEL, useThemePref } from './themeChoices';

/**
 * System / Light / Dark side by side, the current one pressed, styled like the DFA/NFA switch.
 * The welcome dialog's way to pick a theme; the top bar's theme menu shows the same choice.
 */
export function ThemeSwitch(): React.JSX.Element {
  const pref = useThemePref();
  return (
    <div className="av-theme-switch" role="group" aria-label="Theme" data-testid="theme-switch">
      {THEME_PREFS.map((p) => {
        const Icon = THEME_ICON[p];
        return (
          <button
            key={p}
            type="button"
            aria-pressed={p === pref}
            data-focus-stop
            onClick={() => saveTheme(p)}
          >
            <Icon />
            {THEME_LABEL[p]}
          </button>
        );
      })}
    </div>
  );
}
