import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import App from './App';

beforeEach(() => {
  resetAppStore({
    automata: [
      fixture({ kind: 'DFA', alphabet: 'a', states: ['q0', 'q1'], start: 'q0', name: 'd' }),
    ],
    activeId: 'd',
  });
});
afterEach(cleanup);

it('shows the table and issues, and the Table button collapses the panel', async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(screen.getByTestId('transition-table')).toBeInTheDocument();
  expect(screen.getByRole('list', { name: 'Issues' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Table' }));
  expect(screen.queryByTestId('transition-table')).toBeNull();
  expect(screen.getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'false');
});

it('table edits go through the store; clicking an issue selects it', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'q1 is unreachable' }));
  expect(appStore.getState().selection).toEqual({ states: ['q1'], transitions: [] });
  await user.selectOptions(screen.getByLabelText('δ(q0, a)'), 'q1');
  expect(appStore.getState().automata[0]?.transitions).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'q1 is unreachable' })).toBeNull();
});
