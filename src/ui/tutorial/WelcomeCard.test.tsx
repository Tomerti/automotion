import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { resetAppStore } from '../../store/store';
import App from '../shell/App';
import { SEEN_HELP_KEY } from '../shell/help';
import { endTutorial } from './tutorialStore';

const welcome = () => screen.queryByRole('dialog', { name: 'Welcome' });

beforeEach(() => {
  resetAppStore();
  localStorage.removeItem(SEEN_HELP_KEY);
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
  expect(within(welcome()!).getByText(/Press \? at any time/)).toBeInTheDocument();
  expect(localStorage.getItem(SEEN_HELP_KEY)).not.toBeNull();
});

it('only once', () => {
  render(<App />).unmount();
  render(<App />);
  expect(welcome()).toBeNull();
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
