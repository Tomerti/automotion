import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, it, expect } from 'vitest';
import { resetAppStore } from '../../store/store';
import App from './App';

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
