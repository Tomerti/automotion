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
  expect(within(welcome()!).getByText('Watch automata come to life.')).toBeInTheDocument();
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

it('keeps Tab inside the dialog', async () => {
  const user = userEvent.setup();
  render(<App />);
  const d = welcome()!;
  expect(d).toHaveFocus();
  for (let i = 0; i < 4; i++) {
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
