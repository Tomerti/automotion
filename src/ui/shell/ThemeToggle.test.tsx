import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, readTheme, saveTheme, THEME_KEY } from './theme';
import { ThemeToggle } from './ThemeToggle';

const root = document.documentElement;

beforeEach(() => {
  localStorage.removeItem(THEME_KEY);
  root.removeAttribute('data-theme');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ThemeToggle', () => {
  it('cycles system → light → dark → system, persisting and applying each', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Theme: system' });
    expect(root).not.toHaveAttribute('data-theme');

    await user.click(button);
    expect(button).toHaveAccessibleName('Theme: light');
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');

    await user.click(button);
    expect(button).toHaveAccessibleName('Theme: dark');
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');

    await user.click(button);
    expect(button).toHaveAccessibleName('Theme: system');
    expect(root).not.toHaveAttribute('data-theme');
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it('starts from the stored choice', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Theme: dark' })).toHaveAttribute(
      'title',
      'Theme: dark (switch to system)',
    );
  });
});

describe('theme storage', () => {
  it('reads unknown or missing values as system', () => {
    expect(readTheme()).toBe('system');
    localStorage.setItem(THEME_KEY, 'sepia');
    expect(readTheme()).toBe('system');
  });

  it('applyTheme sets or clears data-theme on <html>', () => {
    applyTheme('dark');
    expect(root).toHaveAttribute('data-theme', 'dark');
    applyTheme('system');
    expect(root).not.toHaveAttribute('data-theme');
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readTheme()).toBe('system');
    expect(() => saveTheme('light')).not.toThrow();
    expect(root).toHaveAttribute('data-theme', 'light');
  });
});
