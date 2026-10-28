import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moveState } from '../../core/edit';
import { runWord } from '../../core/run';
import { fixture, nthFromEnd } from '../../core/testing/fixtures';
import { serialize } from '../../persistence/fileFormat';
import { appStore, resetAppStore } from '../../store/store';
import { Toolbar } from './Toolbar';
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

  it('Convert to DFA shows an error toast when the DFA would be too large', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: [nthFromEnd(7)], activeId: 'nth7' });
    render(<Toolbar />);
    await user.click(btn('Convert to DFA'));
    await waitFor(() => expect(toastStore.getState().toasts).toHaveLength(1));
    expect(toastStore.getState().toasts[0]).toMatchObject({
      message: 'Conversion stopped: the DFA would have more than 64 states',
      kind: 'error',
    });
    expect(appStore.getState().trace).toBeNull();
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

  it('switching an NFA with ε to DFA shows an error toast', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: [nfaEps()], activeId: 'e' });
    render(<Toolbar />);
    await user.click(btn('DFA'));
    const toasts = toastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.kind).toBe('error');
    expect(toasts[0]?.message).not.toBe('');
    expect(appStore.getState().automata[0]?.kind).toBe('NFA');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Export and Export all are disabled without automata', () => {
    render(<Toolbar />);
    expect(btn('Export')).toBeDisabled();
    expect(btn('Export all')).toBeDisabled();
    expect(btn('Import')).toBeEnabled();
  });

  it('Import adds the file, activates the last automaton and toasts', async () => {
    const user = userEvent.setup();
    const a = { ...nfa(), id: 'imp1', name: 'one' };
    const b = { ...nfa(), id: 'imp2', name: 'two' };
    render(<Toolbar />);
    const file = new File([serialize([a, b])], 'x.automaton.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Import file'), file);
    await waitFor(() => expect(appStore.getState().automata).toHaveLength(2));
    expect(appStore.getState().activeId).toBe('imp2');
    expect(toastStore.getState().toasts[0]?.message).toBe('Imported 2 automata');
  });

  it('Import reports a bad file as an error toast', async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    await user.upload(screen.getByLabelText('Import file'), new File(['{oops'], 'bad.json'));
    await waitFor(() => expect(toastStore.getState().toasts).toHaveLength(1));
    expect(toastStore.getState().toasts[0]).toMatchObject({
      message: 'Not a valid JSON file',
      kind: 'error',
    });
  });

  it('Export downloads the current automaton as <slug>.automaton.json', async () => {
    const user = userEvent.setup();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const names: string[] = [];
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        names.push(this.download);
      });
    resetAppStore({ automata: [{ ...nfa(), name: 'My Auto' }], activeId: 'n' });
    render(<Toolbar />);
    await user.click(btn('Export'));
    await user.click(btn('Export all'));
    expect(names).toEqual(['my-auto.automaton.json', 'automata.automaton.json']);
    click.mockRestore();
  });

  it('kind toggle and Undo/Redo are disabled while a trace is open', () => {
    const d = fixture({
      kind: 'DFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      start: 'q0',
      edges: [['q0', 'a', 'q1']],
      name: 'd',
    });
    resetAppStore({ automata: [d], activeId: 'd' });
    const st = appStore.getState();
    st.edit((a) => moveState(a, 'q0', { x: 5, y: 5 }));
    st.edit((a) => moveState(a, 'q0', { x: 6, y: 6 }));
    appStore.getState().undo();
    const active = appStore.getState().automata[0]!;
    appStore.getState().openTrace(runWord(active, 'a'));
    render(<Toolbar />);
    for (const n of ['DFA', 'NFA', 'Undo', 'Redo']) expect(btn(n)).toBeDisabled();
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
