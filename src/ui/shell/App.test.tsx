import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { startMinimize, startRun, startSubset } from '../../store/traceActions';
import App from './App';
import { toastStore } from './toastStore';

const loop = () =>
  fixture({
    kind: 'DFA',
    alphabet: 'a',
    states: ['q0'],
    start: 'q0',
    accepting: ['q0'],
    edges: [['q0', 'a', 'q0']],
    name: 'd',
  });

beforeEach(() => resetAppStore());
afterEach(cleanup);

it('renders the app title in the top bar', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Automaton Vis' })).toBeInTheDocument();
  expect(screen.getByRole('banner')).toContainElement(
    screen.getByRole('toolbar', { name: 'Automaton tools' }),
  );
});

it('has no side panels: the canvas and the dock fill the page under the top bar', () => {
  resetAppStore({ automata: [loop()], activeId: 'd' });
  render(<App />);
  expect(screen.queryByTestId('right-panel')).toBeNull();
  expect(screen.queryByRole('navigation')).toBeNull();
  const main = screen.getByRole('main');
  expect(within(main).getByTestId('diagram')).toBeInTheDocument();
  expect(within(main).getByTestId('dock')).toContainElement(screen.getByLabelText('Word'));
});

it('the dock swaps the run pill for the trace player while a trace is open', async () => {
  const user = userEvent.setup();
  resetAppStore({ automata: [loop()], activeId: 'd' });
  render(<App />);
  const dock = screen.getByTestId('dock');
  expect(dock).toHaveAttribute('data-mode', 'run');
  act(() => startRun('aa'));
  expect(dock).toHaveAttribute('data-mode', 'trace');
  expect(screen.getByLabelText('Word')).not.toBeVisible();
  expect(within(dock).getByRole('button', { name: 'Next' })).toBeInTheDocument();
  await user.click(within(dock).getByRole('button', { name: 'Close' }));
  expect(dock).toHaveAttribute('data-mode', 'run');
  expect(screen.getByLabelText('Word')).toBeVisible();
});

it('New DFA from the switcher shows its diagram', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Automata' }));
  await user.click(screen.getByRole('menuitem', { name: 'New DFA' }));
  expect(screen.getByTestId('diagram')).toBeInTheDocument();
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

it('a run plays at once, and a new run starts again at 1× speed', async () => {
  const user = userEvent.setup();
  resetAppStore({ automata: [loop()], activeId: 'd' });
  render(<App />);
  act(() => startRun('aaaaaa'));
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Speed' }), '2');
  act(() => startRun('aaa'));
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Speed' })).toHaveValue('1');
});

it('a conversion to DFA plays at once', async () => {
  const nfa = fixture({
    kind: 'NFA',
    alphabet: 'a',
    states: ['q0', 'q1'],
    start: 'q0',
    accepting: ['q1'],
    edges: [
      ['q0', 'a', 'q0'],
      ['q0', 'a', 'q1'],
    ],
    name: 'n',
  });
  resetAppStore({ automata: [nfa], activeId: 'n' });
  render(<App />);
  await act(() => startSubset());
  expect(appStore.getState().trace?.kind).toBe('subset');
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
});

it('a minimization walkthrough opens paused', () => {
  resetAppStore({ automata: [loop()], activeId: 'd' });
  render(<App />);
  act(() => startMinimize());
  expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
});
