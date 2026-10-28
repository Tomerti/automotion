import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Automaton } from '../../core/model';
import { appStore, resetAppStore } from '../../store/store';
import App from '../shell/App';
import { RunPanel } from './RunPanel';

/** DFA over {0,1} accepting words with an even number of zeros. */
const evenZeros: Automaton = {
  id: 'a1',
  name: 'even zeros',
  kind: 'DFA',
  alphabet: ['0', '1'],
  states: [
    { id: 'q0', label: 'q0', x: 100, y: 100 },
    { id: 'q1', label: 'q1', x: 300, y: 100 },
  ],
  start: 'q0',
  accepting: ['q0'],
  transitions: [
    { id: 't1', from: 'q0', to: 'q1', symbols: ['0'] },
    { id: 't2', from: 'q1', to: 'q0', symbols: ['0'] },
    { id: 't3', from: 'q0', to: 'q0', symbols: ['1'] },
    { id: 't4', from: 'q1', to: 'q1', symbols: ['1'] },
  ],
};
const ab: Automaton = { ...evenZeros, alphabet: ['a', 'b'], transitions: [] };

beforeEach(() => resetAppStore());
afterEach(cleanup);

describe('RunPanel', () => {
  it('Run is disabled without an automaton', () => {
    render(<RunPanel />);
    const run = screen.getByRole('button', { name: 'Run' });
    expect(run).toBeDisabled();
    expect(run).toHaveAttribute('title', 'Create an automaton first');
  });

  it('Run is disabled with the reason for a bad word', async () => {
    resetAppStore({ automata: [ab] });
    const user = userEvent.setup();
    render(<RunPanel />);
    expect(screen.getByPlaceholderText('Word (empty = ε)')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Word'), 'ac');
    const run = screen.getByRole('button', { name: 'Run' });
    expect(run).toBeDisabled();
    expect(run).toHaveAttribute('title', "'c' is not in the alphabet {a, b}");
  });

  it('Enter runs the word and opens a trace', async () => {
    resetAppStore({ automata: [evenZeros] });
    const user = userEvent.setup();
    render(<RunPanel />);
    await user.type(screen.getByLabelText('Word'), '0010{Enter}');
    expect(appStore.getState().trace?.kind).toBe('run');
  });

  it('running shows the verdict on the last step', async () => {
    resetAppStore({ automata: [evenZeros] });
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('Word'), '0010');
    await user.click(screen.getByRole('button', { name: 'Run' }));
    // Trace view replaced the editable canvas.
    expect(screen.getAllByTestId('word-char')).toHaveLength(4);
    expect(screen.queryByTestId('verdict')).toBeNull();
    const n = appStore.getState().trace?.steps.length ?? 0;
    for (let i = 1; i < n; i++) await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('verdict')).toHaveTextContent('Rejected');
    // Re-running while a trace is open replaces it.
    await user.clear(screen.getByLabelText('Word'));
    await user.type(screen.getByLabelText('Word'), '00');
    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(appStore.getState().stepIndex).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(appStore.getState().trace).toBeNull();
  });

  it('marks consumed/current/pending chars and shows ε for the empty word', async () => {
    resetAppStore({ automata: [evenZeros] });
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('Word'), '01');
    await user.click(screen.getByRole('button', { name: 'Run' }));
    const states = (): (string | null)[] =>
      screen.getAllByTestId('word-char').map((c) => c.getAttribute('data-state'));
    expect(states()).toEqual(['pending', 'pending']);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(states()).toEqual(['current', 'pending']);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.clear(screen.getByLabelText('Word'));
    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(screen.queryAllByTestId('word-char')).toHaveLength(0);
    expect(screen.getByText('ε')).toBeInTheDocument();
  });
});
