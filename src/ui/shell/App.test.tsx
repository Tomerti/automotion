import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { startRun } from '../../store/traceActions';
import App from './App';
import { toastStore } from './toastStore';

beforeEach(() => resetAppStore());
afterEach(cleanup);

it('renders the app title', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Automaton Vis' })).toBeInTheDocument();
});

it('shows the empty state and the layout slots', () => {
  render(<App />);
  expect(screen.getByText('Create an automaton to get started')).toBeInTheDocument();
  expect(screen.getByTestId('right-panel')).toBeInTheDocument();
  expect(screen.getByTestId('bottom-panel')).toBeInTheDocument();
});

it('New DFA shows the diagram in place of the empty state', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'New DFA' }));
  expect(screen.getByTestId('diagram')).toBeInTheDocument();
  expect(screen.queryByText('Create an automaton to get started')).toBeNull();
});

it('a failed autosave shows an error toast', async () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('full');
  });
  toastStore.setState({ toasts: [] });
  render(<App />);
  act(() => {
    appStore.getState().createAutomaton('DFA');
  });
  await waitFor(() =>
    expect(toastStore.getState().toasts).toEqual([
      expect.objectContaining({ message: "Changes won't persist — export to save", kind: 'error' }),
    ]),
  );
  setItem.mockRestore();
});

it('a new trace resets the player (paused, 1× speed)', async () => {
  const user = userEvent.setup();
  const d = fixture({
    kind: 'DFA',
    alphabet: 'a',
    states: ['q0'],
    start: 'q0',
    accepting: ['q0'],
    edges: [['q0', 'a', 'q0']],
    name: 'd',
  });
  resetAppStore({ automata: [d], activeId: 'd' });
  render(<App />);
  act(() => startRun('aaaaaa'));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Speed' }), '2');
  await user.click(screen.getByRole('button', { name: 'Play' }));
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  act(() => startRun('aaa'));
  expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Speed' })).toHaveValue('1');
});
