import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resetAppStore } from '../../store/store';
import App from '../shell/App';
import { SEEN_HELP_KEY } from '../shell/help';
import { applyTheme, THEME_KEY } from '../shell/theme';
import { endTutorial } from './tutorialStore';

const welcome = () => screen.queryByRole('dialog', { name: 'Welcome' });

beforeEach(() => {
  resetAppStore();
  localStorage.removeItem(SEEN_HELP_KEY);
  localStorage.removeItem(THEME_KEY);
  applyTheme('system');
});
afterEach(() => {
  act(() => endTutorial());
  cleanup();
});

it('opens by itself on a first visit, instead of the Controls popup', () => {
  render(<App />);
  expect(welcome()).not.toBeNull();
  expect(welcome()).toHaveAttribute('aria-modal', 'true');
  expect(screen.queryByRole('dialog', { name: 'Controls' })).toBeNull();
  expect(within(welcome()!).getByText('Watch automata come to life.')).toBeInTheDocument();
  expect(within(welcome()!).getByText(/Press \? at any time/)).toBeInTheDocument();
  expect(within(welcome()!).getByTestId('welcome-demo')).toHaveAttribute('aria-hidden', 'true');
});

it('opens again after a reload until it is answered, then never again', async () => {
  const user = userEvent.setup();
  // A reload before answering (a refresh, Vite's reload after optimizing dependencies).
  render(<App />).unmount();
  expect(localStorage.getItem(SEEN_HELP_KEY)).toBeNull();
  render(<App />);
  expect(welcome()).not.toBeNull();
  await user.click(within(welcome()!).getByRole('button', { name: 'Not now' }));
  expect(localStorage.getItem(SEEN_HELP_KEY)).not.toBeNull();
  cleanup();
  render(<App />);
  expect(welcome()).toBeNull();
});

it('Start tutorial answers it too', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(within(welcome()!).getByRole('button', { name: 'Start tutorial' }));
  expect(localStorage.getItem(SEEN_HELP_KEY)).not.toBeNull();
});

it('Start tutorial closes it and starts the tutorial', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(within(welcome()!).getByRole('button', { name: 'Start tutorial' }));
  expect(welcome()).toBeNull();
  expect(screen.getByTestId('tutorial-card')).toHaveAttribute('data-step', '1');
});

it('Not now and Escape close it without a tutorial', async () => {
  const user = userEvent.setup();
  const first = render(<App />);
  await user.click(within(welcome()!).getByRole('button', { name: 'Not now' }));
  expect(welcome()).toBeNull();
  expect(screen.queryByTestId('tutorial-card')).toBeNull();
  first.unmount();

  localStorage.removeItem(SEEN_HELP_KEY);
  render(<App />);
  await user.keyboard('{Escape}');
  expect(welcome()).toBeNull();
});

it('picks the theme, like the top bar theme menu, without closing', async () => {
  const user = userEvent.setup();
  render(<App />);
  const pick = within(within(welcome()!).getByRole('group', { name: 'Theme' }));
  expect(pick.getAllByRole('button').map((b) => b.textContent)).toEqual([
    'System',
    'Light',
    'Dark',
  ]);
  expect(pick.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true');

  await user.click(pick.getByRole('button', { name: 'Dark' }));
  expect(welcome()).not.toBeNull();
  expect(pick.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  expect(pick.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'false');
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  expect(screen.getByRole('button', { name: 'Theme: dark' })).toBeInTheDocument();

  await user.click(pick.getByRole('button', { name: 'System' }));
  expect(localStorage.getItem(THEME_KEY)).toBeNull();
  expect(screen.getByRole('button', { name: 'Theme: system' })).toBeInTheDocument();
});

it('keeps Tab inside the dialog', async () => {
  const user = userEvent.setup();
  render(<App />);
  const d = welcome()!;
  expect(d).toHaveFocus();
  for (let i = 0; i < 7; i++) {
    await user.tab();
    expect(d).toContainElement(document.activeElement as HTMLElement);
  }
});

it('? does not open the Controls popup on top of it', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.keyboard('?');
  expect(screen.queryByRole('dialog', { name: 'Controls' })).toBeNull();
  await user.keyboard('{Escape}');
  expect(welcome()).toBeNull();
  await user.keyboard('?');
  expect(screen.getByRole('dialog', { name: 'Controls' })).toBeInTheDocument();
});

it('gives focus back to what had it when it closes', async () => {
  const user = userEvent.setup();
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  render(<App />);
  expect(welcome()).toHaveFocus();
  await user.click(within(welcome()!).getByRole('button', { name: 'Not now' }));
  expect(outside).toHaveFocus();
  outside.remove();
});

/** A matchMedia whose only true queries are the pointer ones asked for. */
function stubPointers(coarse: boolean, fine: boolean): void {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('any-pointer') ? fine : q.includes('pointer: coarse') ? coarse : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

it('on a touch-only device offers Got it instead of the tutorial', async () => {
  stubPointers(true, false);
  try {
    const user = userEvent.setup();
    render(<App />);
    const d = welcome()!;
    expect(
      within(d).getByText(/made for a computer with a mouse and keyboard/),
    ).toBeInTheDocument();
    expect(within(d).queryByRole('button', { name: 'Start tutorial' })).toBeNull();
    expect(within(d).queryByRole('button', { name: 'Not now' })).toBeNull();
    expect(within(d).getByTestId('welcome-demo')).toBeInTheDocument();
    // A phone has no keyboard to press ? on.
    expect(within(d).queryByText(/Press \? at any time/)).toBeNull();
    await user.click(within(d).getByRole('button', { name: 'Got it' }));
    expect(welcome()).toBeNull();
    expect(localStorage.getItem(SEEN_HELP_KEY)).not.toBeNull();
    expect(screen.queryByTestId('tutorial-card')).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});

it('with a fine pointer too (a laptop with a touch screen) keeps the tutorial offer', () => {
  stubPointers(true, true);
  try {
    render(<App />);
    expect(within(welcome()!).getByRole('button', { name: 'Start tutorial' })).toBeInTheDocument();
    expect(within(welcome()!).queryByRole('button', { name: 'Got it' })).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});
