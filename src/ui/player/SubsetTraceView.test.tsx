import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { startSubset } from '../../store/traceActions';
import { endsAb } from '../../store/testing/fixtures';
import App from '../shell/App';
import { chooseSplitLayout } from './splitLayout';

beforeEach(() => resetAppStore());
afterEach(cleanup);

const dfaStates = (): number =>
  within(screen.getByTestId('subset-dfa')).queryAllByTestId(/^state-/).length;

const lastStep = (): void =>
  act(() => appStore.getState().setStep(appStore.getState().trace!.steps.length - 1));

async function open(): Promise<void> {
  appStore.getState().addAutomaton(endsAb);
  render(<App />);
  await act(async () => {
    await startSubset();
  });
}

describe('SubsetTraceView', () => {
  it('shows NFA and DFA panes and reveals DFA states step by step', async () => {
    await open();
    expect(within(screen.getByTestId('subset-nfa')).getAllByTestId(/^state-/)).toHaveLength(3);
    const first = dfaStates();
    lastStep();
    expect(dfaStates()).toBeGreaterThan(first);
  });

  it('exposes the pane orientation chosen for the container size', async () => {
    await open();
    const trace = appStore.getState().trace;
    if (trace?.kind !== 'subset') throw new Error('no subset trace');
    // jsdom has no layout, so the view measures the 800 × 500 fallback size.
    const expected = chooseSplitLayout(trace.source.states, trace.result.states, {
      width: 800,
      height: 500,
    });
    expect(screen.getByTestId('subset-view')).toHaveAttribute('data-layout', expected);
  });

  it('labels DFA edges only with the symbols built so far', async () => {
    const nfa = fixture({
      kind: 'NFA',
      alphabet: 'ab',
      states: ['q0', 'q1'],
      start: 'q0',
      accepting: ['q1'],
      edges: [['q0', 'a', 'q1']],
      name: 'dead',
    });
    appStore.getState().addAutomaton(nfa);
    render(<App />);
    await act(async () => {
      await startSubset();
    });
    const trace = appStore.getState().trace;
    if (trace?.kind !== 'subset') throw new Error('no subset trace');
    // The ∅ state's self-loop appears on 'a'; 'b' joins it one step later.
    const i = trace.steps.findIndex(
      (s) => s.phase === 'expand' && s.subset.length === 0 && s.symbol === 'a',
    );
    expect(i).toBeGreaterThan(-1);
    const loopLabel = () =>
      within(within(screen.getByTestId('subset-dfa')).getByTestId('edge-∅-∅')).getByTestId(
        'edge-label',
      );
    act(() => appStore.getState().setStep(i));
    expect(loopLabel()).toHaveTextContent(/^a$/);
    lastStep();
    expect(loopLabel()).toHaveTextContent(/^a,b$/);
  });

  it('marks the NFA transitions taken on an expand step', async () => {
    await open();
    const trace = appStore.getState().trace;
    if (trace?.kind !== 'subset') throw new Error('no subset trace');
    const i = trace.steps.findIndex(
      (s) => s.phase === 'expand' && (s.focus.transitions?.length ?? 0) > 0,
    );
    expect(i).toBeGreaterThan(-1);
    act(() => appStore.getState().setStep(i));
    const taken = within(screen.getByTestId('subset-nfa'))
      .getAllByTestId(/^edge-/)
      .filter((e) => e.getAttribute('data-taken') === 'true');
    expect(taken.length).toBeGreaterThan(0);
  });

  it('Save as new automaton adds "N → DFA" and closes the trace', async () => {
    const user = userEvent.setup();
    await open();
    expect(screen.queryByRole('button', { name: 'Save as new automaton' })).toBeNull();
    lastStep();
    await user.click(screen.getByRole('button', { name: 'Save as new automaton' }));
    const s = appStore.getState();
    expect(s.trace).toBeNull();
    expect(s.automata.map((a) => a.name)).toContain('ends ab → DFA');
    expect(s.automata.find((a) => a.id === s.activeId)?.kind).toBe('DFA');
  });
});
