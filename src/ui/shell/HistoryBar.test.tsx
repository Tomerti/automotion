import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyAutomaton } from '../../core/model';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { startRun } from '../../store/traceActions';
import { HistoryBar } from './HistoryBar';

const parity = fixture({
  kind: 'DFA',
  alphabet: 'a',
  states: ['q0', 'q1'],
  start: 'q0',
  accepting: ['q1'],
  edges: [
    ['q0', 'a', 'q1'],
    ['q1', 'a', 'q0'],
  ],
  name: 'Parity',
});
const blank = { ...emptyAutomaton('Blank', 'NFA'), id: 'blank' };

const items = (): HTMLElement[] => screen.getAllByTestId('history-item');
const st = () => appStore.getState();

beforeEach(() => resetAppStore({ automata: [parity, blank], activeId: parity.id }));
afterEach(cleanup);

describe('HistoryBar', () => {
  it('lists the automata in store order with kind and size, marking the open one', () => {
    render(<HistoryBar />);
    expect(screen.getByRole('navigation', { name: 'History' })).toBeInTheDocument();
    expect(items().map((i) => i.textContent)).toEqual([
      'ParityDFA · 2 states',
      'BlankEmptyNFA · 0 states',
    ]);
    expect(items()[0]).toHaveAttribute('aria-current', 'page');
    expect(items()[1]).not.toHaveAttribute('aria-current');
  });

  it('clicking an entry opens that automaton and closes an open trace', async () => {
    const user = userEvent.setup();
    render(<HistoryBar />);
    act(() => startRun('a'));
    expect(st().trace).not.toBeNull();
    await user.click(items()[1]!);
    expect(st().activeId).toBe('blank');
    expect(st().trace).toBeNull();
    expect(items()[1]).toHaveAttribute('aria-current', 'page');
  });

  it('New DFA and New NFA create an automaton at the top and open it', async () => {
    const user = userEvent.setup();
    render(<HistoryBar />);
    await user.click(screen.getByRole('button', { name: 'New NFA' }));
    expect(items()).toHaveLength(3);
    expect(items()[0]).toHaveTextContent('Untitled NFA');
    expect(items()[0]).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('button', { name: 'New DFA' }));
    expect(items()[0]).toHaveTextContent('Untitled DFA');
    expect(st().automata[0]?.kind).toBe('DFA');
  });

  it('an edit moves the automaton to the top of the list', () => {
    resetAppStore({ automata: [parity, blank], activeId: 'blank' });
    render(<HistoryBar />);
    act(() => st().edit((a) => ({ ...a, name: 'Edited' })));
    expect(items()[0]).toHaveTextContent('Edited');
  });

  it('thumbnails draw each state, a second ring on accepting ones, and the edges', () => {
    render(<HistoryBar />);
    const thumb = within(items()[0]!).getByTestId('history-thumbnail');
    expect(thumb.querySelectorAll('.av-thumb-state')).toHaveLength(2);
    expect(thumb.querySelectorAll('.av-thumb-accept')).toHaveLength(1);
    expect(thumb.querySelectorAll('.av-thumb-edge')).toHaveLength(2);
    expect(thumb.querySelector('.av-thumb-start')).not.toBeNull();
    // No canvas test ids inside thumbnails: they would clash with the canvas's own.
    expect(thumb.querySelector('[data-testid]')).toBeNull();
    expect(within(items()[1]!).queryByTestId('history-thumbnail')).toBeNull();
    expect(within(items()[1]!).getByText('Empty')).toBeInTheDocument();
  });

  it('says "1 state" for a single state', () => {
    const one = fixture({ kind: 'DFA', alphabet: '', states: ['q0'], edges: [], name: 'One' });
    resetAppStore({ automata: [one], activeId: one.id });
    render(<HistoryBar />);
    expect(items()[0]).toHaveTextContent('DFA · 1 state');
  });
});
