import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runWord } from '../../core/run';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { KindPill } from './KindPill';
import { toastStore } from './toastStore';

const nfa = () => fixture({ kind: 'NFA', alphabet: 'a', states: ['q0'], start: 'q0', name: 'n' });
const nfaEps = () =>
  fixture({
    kind: 'NFA',
    alphabet: 'a',
    states: ['q0', 'q1'],
    start: 'q0',
    edges: [['q0', 'ε', 'q1']],
    name: 'e',
  });

beforeEach(() => {
  resetAppStore();
  toastStore.setState({ toasts: [] });
});
afterEach(cleanup);

const btn = (name: string) => screen.getByRole('button', { name });

describe('KindPill', () => {
  it('reflects and changes the kind', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: [nfa()], activeId: 'n' });
    render(<KindPill />);
    expect(screen.getByRole('group', { name: 'Kind' })).toBeInTheDocument();
    expect(btn('NFA')).toHaveAttribute('aria-pressed', 'true');
    expect(btn('DFA')).toHaveAttribute('aria-pressed', 'false');
    await user.click(btn('DFA'));
    expect(appStore.getState().automata[0]?.kind).toBe('DFA');
    expect(btn('DFA')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('switching an NFA with ε to DFA shows an error toast', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: [nfaEps()], activeId: 'e' });
    render(<KindPill />);
    await user.click(btn('DFA'));
    const toasts = toastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.kind).toBe('error');
    expect(toasts[0]?.message).not.toBe('');
    expect(appStore.getState().automata[0]?.kind).toBe('NFA');
  });

  it('is not shown without an automaton or while a trace is open', () => {
    resetAppStore({ automata: [] });
    const { unmount } = render(<KindPill />);
    expect(screen.queryByTestId('kind-pill')).toBeNull();
    unmount();

    const d = fixture({
      kind: 'DFA',
      alphabet: 'a',
      states: ['q0'],
      start: 'q0',
      edges: [['q0', 'a', 'q0']],
      name: 'd',
    });
    resetAppStore({ automata: [d], activeId: 'd' });
    appStore.getState().openTrace(runWord(d, 'a'));
    render(<KindPill />);
    expect(screen.queryByTestId('kind-pill')).toBeNull();
  });

  it('disables DFA for an NFA with several start states, and says why', () => {
    const two = fixture({
      kind: 'NFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      starts: ['q0', 'q1'],
      name: 'two',
    });
    resetAppStore({ automata: [two], activeId: two.id });
    const { unmount } = render(<KindPill />);
    expect(btn('DFA')).toBeDisabled();
    expect(btn('DFA')).toHaveAttribute(
      'title',
      "An NFA with several start states can't be a DFA: use Convert to DFA",
    );
    unmount();
    resetAppStore({ automata: [nfa()], activeId: 'n' });
    render(<KindPill />);
    expect(btn('DFA')).toBeEnabled();
  });
});
