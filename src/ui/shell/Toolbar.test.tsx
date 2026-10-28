import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { moveState } from '../../core/edit';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { Toolbar } from './Toolbar';

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

beforeEach(() => resetAppStore());
afterEach(cleanup);

const btn = (name: string) => screen.getByRole('button', { name });

describe('Toolbar', () => {
  it('disables everything without an active automaton', () => {
    render(<Toolbar />);
    for (const n of ['DFA', 'NFA', 'Undo', 'Redo', 'Fit', 'Tidy', 'Convert to DFA', 'Minimize']) {
      expect(btn(n)).toBeDisabled();
    }
  });

  it('Minimize is disabled with a reason on an NFA', () => {
    resetAppStore({ automata: [nfa()], activeId: 'n' });
    render(<Toolbar />);
    expect(btn('Minimize')).toBeDisabled();
    expect(btn('Minimize')).toHaveAttribute('title', 'Minimization needs a DFA');
  });

  it('Convert to DFA is disabled with a reason on a DFA', () => {
    resetAppStore({ automata: [{ ...nfa(), kind: 'DFA' }], activeId: 'n' });
    render(<Toolbar />);
    expect(btn('Convert to DFA')).toBeDisabled();
    expect(btn('Convert to DFA')).toHaveAttribute('title');
  });

  it('kind toggle reflects and changes the kind', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: [nfa()], activeId: 'n' });
    render(<Toolbar />);
    expect(btn('NFA')).toHaveAttribute('aria-pressed', 'true');
    expect(btn('DFA')).toHaveAttribute('aria-pressed', 'false');
    await user.click(btn('DFA'));
    expect(appStore.getState().automata[0]?.kind).toBe('DFA');
    expect(btn('DFA')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('switching an NFA with ε to DFA shows an alert, cleared by the next success', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: [nfaEps()], activeId: 'e' });
    render(<Toolbar />);
    await user.click(btn('DFA'));
    expect(screen.getByRole('alert')).not.toBeEmptyDOMElement();
    expect(appStore.getState().automata[0]?.kind).toBe('NFA');
    await user.click(btn('NFA'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Undo/Redo call the store and follow history', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: [nfa()], activeId: 'n' });
    render(<Toolbar />);
    expect(btn('Undo')).toBeDisabled();
    expect(btn('Redo')).toBeDisabled();
    appStore.getState().edit((a) => moveState(a, 'q0', { x: 5, y: 5 }));
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeEnabled();
    await user.click(btn('Undo'));
    expect(appStore.getState().automata[0]?.states[0]?.x).toBe(0);
    expect(btn('Redo')).toBeEnabled();
    await user.click(btn('Redo'));
    expect(appStore.getState().automata[0]?.states[0]?.x).toBe(5);
  });
});
