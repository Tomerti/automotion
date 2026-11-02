import { useEffect, useReducer, useRef } from 'react';
import { CheckIcon } from './icons';
import { followSystemTheme, saveTheme, systemTheme, THEME_PREFS } from './theme';
import type { ThemePref } from './theme';
import { THEME_ICON as ICON, THEME_LABEL as LABEL, useThemePref } from './themeChoices';
import { focusFirstItem, onMenuKeyDown, usePopover } from './usePopover';

/**
 * The theme button: its icon shows the current choice, and it opens a menu to follow the
 * system (the default) or force light or dark.
 */
export function ThemeMenu(): React.JSX.Element {
  const pref = useThemePref();
  const { open, setOpen, rootRef, triggerRef } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);
  // Re-render when the system switches, so "System (dark)" stays true.
  const [, systemChanged] = useReducer((n: number) => n + 1, 0);
  useEffect(() => followSystemTheme(systemChanged), []);
  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const checked = menu?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (checked) checked.focus();
    else focusFirstItem(menu);
  }, [open]);

  const Icon = ICON[pref];
  const shown = pref === 'system' ? `system (${systemTheme()})` : pref;
  const choose = (next: ThemePref): void => {
    saveTheme(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="av-menu-anchor" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="av-icon-button"
        aria-label={`Theme: ${pref}`}
        title={`Theme: ${shown}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="av-popover av-menu av-menu-end av-theme-menu"
          role="menu"
          aria-label="Theme"
          onKeyDown={onMenuKeyDown}
        >
          {THEME_PREFS.map((p) => {
            const ItemIcon = ICON[p];
            return (
              <button
                key={p}
                type="button"
                role="menuitemradio"
                aria-checked={p === pref}
                onClick={() => choose(p)}
              >
                <ItemIcon />
                {LABEL[p]}
                {p === pref && (
                  <span className="av-theme-check">
                    <CheckIcon />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
