import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  followSystemTheme,
  readTheme,
  resolveTheme,
  saveTheme,
  THEME_KEY,
} from './theme';
import { ThemeMenu } from './ThemeMenu';

const root = document.documentElement;

/** A `prefers-color-scheme: dark` query the test can flip, firing `change` like a browser. */
function stubSystem(dark: boolean): { set: (dark: boolean) => void } {
  const listeners = new Set<() => void>();
  const query = {
    get matches() {
      return dark;
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  };
  vi.stubGlobal('matchMedia', () => query);
  return {
    set(next) {
      dark = next;
      act(() => listeners.forEach((l) => l()));
    },
  };
}

const trigger = (): HTMLElement => screen.getByRole('button', { name: /^Theme:/ });

beforeEach(() => {
  localStorage.removeItem(THEME_KEY);
  root.removeAttribute('data-theme');
  applyTheme('system');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ThemeMenu', () => {
  it('follows the system by default', () => {
    stubSystem(true);
    applyTheme(readTheme());
    render(<ThemeMenu />);
    expect(trigger()).toHaveAccessibleName('Theme: system');
    expect(trigger()).toHaveAttribute('title', 'Theme: system (dark)');
    expect(root).toHaveAttribute('data-theme', 'dark');
  });

  it('lists System, Light and Dark with the current one checked and focused', async () => {
    stubSystem(false);
    const user = userEvent.setup();
    render(<ThemeMenu />);
    await user.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((i) => i.textContent)).toEqual(['System', 'Light', 'Dark']);
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('forces light or dark, persisting and applying each, and goes back to the system', async () => {
    const system = stubSystem(false);
    const user = userEvent.setup();
    render(<ThemeMenu />);

    await user.click(trigger());
    await user.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger()).toHaveAccessibleName('Theme: dark');
    expect(trigger()).toHaveFocus();
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');

    // A forced theme ignores the system.
    system.set(true);
    system.set(false);
    expect(root).toHaveAttribute('data-theme', 'dark');

    await user.click(trigger());
    await user.click(screen.getByRole('menuitemradio', { name: 'Light' }));
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');

    await user.click(trigger());
    await user.click(screen.getByRole('menuitemradio', { name: 'System' }));
    expect(trigger()).toHaveAccessibleName('Theme: system');
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    system.set(true);
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(trigger()).toHaveAttribute('title', 'Theme: system (dark)');
  });

  it('starts from the stored choice', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    render(<ThemeMenu />);
    expect(trigger()).toHaveAccessibleName('Theme: dark');
    expect(trigger()).toHaveAttribute('title', 'Theme: dark');
  });

  it('keyboard: arrows move between the choices, Enter picks one', async () => {
    stubSystem(false);
    const user = userEvent.setup();
    render(<ThemeMenu />);
    trigger().focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(root).toHaveAttribute('data-theme', 'dark');
  });
});

describe('theme storage', () => {
  it('reads the system choice when nothing (or anything unknown) is stored', () => {
    expect(readTheme()).toBe('system');
    localStorage.setItem(THEME_KEY, 'system');
    expect(readTheme()).toBe('system');
    localStorage.setItem(THEME_KEY, 'sepia');
    expect(readTheme()).toBe('system');
    localStorage.setItem(THEME_KEY, 'light');
    expect(readTheme()).toBe('light');
  });

  it('resolves the system choice through prefers-color-scheme, light when unknown', () => {
    expect(resolveTheme('system')).toBe('light'); // jsdom has no matchMedia
    stubSystem(true);
    expect(resolveTheme('system')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });

  it('applyTheme always sets the resolved theme on <html>', () => {
    stubSystem(true);
    applyTheme('system');
    expect(root).toHaveAttribute('data-theme', 'dark');
    applyTheme('light');
    expect(root).toHaveAttribute('data-theme', 'light');
  });

  it('followSystemTheme switches only while the choice is system, until unsubscribed', () => {
    const system = stubSystem(false);
    const onChange = vi.fn();
    applyTheme('system');
    const stop = followSystemTheme(onChange);
    system.set(true);
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(onChange).toHaveBeenCalledTimes(1);
    applyTheme('light');
    system.set(false);
    system.set(true);
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(onChange).toHaveBeenCalledTimes(1);
    applyTheme('system');
    stop();
    system.set(false);
    expect(root).toHaveAttribute('data-theme', 'dark');
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readTheme()).toBe('system');
    expect(() => saveTheme('dark')).not.toThrow();
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(() => saveTheme('system')).not.toThrow();
  });
});
