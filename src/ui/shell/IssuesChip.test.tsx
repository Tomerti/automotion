import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setEdgeSymbols } from '../../core/edit';
import { emptyAutomaton } from '../../core/model';
import { runWord } from '../../core/run';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { issueMarksStore } from '../canvas/issueMarks';
import { IssuesChip } from './IssuesChip';

/** Complete DFA whose only issue is that q1 is unreachable. */
const unreachable = () =>
  fixture({
    kind: 'DFA',
    alphabet: 'a',
    states: ['q0', 'q1'],
    start: 'q0',
    accepting: ['q0'],
    edges: [
      ['q0', 'a', 'q0'],
      ['q1', 'a', 'q1'],
    ],
    name: 'd',
  });

beforeEach(() => resetAppStore({ automata: [unreachable()], activeId: 'd' }));
afterEach(cleanup);

describe('IssuesChip', () => {
  it('is hidden without issues or without an automaton', () => {
    resetAppStore({
      automata: [
        fixture({
          kind: 'DFA',
          alphabet: 'a',
          states: ['q0'],
          start: 'q0',
          accepting: ['q0'],
          edges: [['q0', 'a', 'q0']],
          name: 'ok',
        }),
      ],
      activeId: 'ok',
    });
    const { container, rerender } = render(<IssuesChip />);
    expect(container).toBeEmptyDOMElement();
    resetAppStore();
    rerender(<IssuesChip />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is hidden on a blank automaton', () => {
    const blank = emptyAutomaton('Untitled', 'DFA');
    resetAppStore({ automata: [blank], activeId: blank.id });
    const { container } = render(<IssuesChip />);
    expect(container).toBeEmptyDOMElement();
  });

  it('counts the issues and opens a popover listing them', async () => {
    const user = userEvent.setup();
    render(<IssuesChip />);
    const chip = screen.getByRole('button', { name: '1 issue' });
    expect(chip).toHaveAttribute('data-severity', 'warning');
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Issues' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Issues' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('marks the states the issues are about while the popover is open', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<IssuesChip />);
    expect(issueMarksStore.getState().states).toEqual({});
    await user.click(screen.getByRole('button', { name: '1 issue' }));
    expect(issueMarksStore.getState().states).toEqual({ q1: 'warning' });
    await user.keyboard('{Escape}');
    expect(issueMarksStore.getState().states).toEqual({});
    await user.click(screen.getByRole('button', { name: '1 issue' }));
    unmount();
    expect(issueMarksStore.getState().states).toEqual({});
  });

  it('marks each incomplete DFA state as an error', async () => {
    const user = userEvent.setup();
    resetAppStore({
      automata: [
        fixture({
          kind: 'DFA',
          alphabet: 'ab',
          states: ['q0', 'q1'],
          start: 'q0',
          accepting: ['q1'],
          edges: [['q0', 'a', 'q1']],
          name: 'inc',
        }),
      ],
      activeId: 'inc',
    });
    render(<IssuesChip />);
    await user.click(screen.getByRole('button', { name: '2 issues' }));
    expect(screen.getByRole('button', { name: "q0 needs a transition on 'b'" })).toBeVisible();
    expect(issueMarksStore.getState().states).toEqual({ q0: 'error', q1: 'error' });
  });

  it('clicking an issue selects its state and closes the popover', async () => {
    const user = userEvent.setup();
    render(<IssuesChip />);
    await user.click(screen.getByRole('button', { name: '1 issue' }));
    await user.click(screen.getByRole('button', { name: 'q1 is unreachable' }));
    expect(appStore.getState().selection).toEqual({ states: ['q1'], transitions: [] });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('follows edits: fixing the automaton hides the chip, errors turn it red', () => {
    const { container } = render(<IssuesChip />);
    // Point q0's loop at q1 instead: q1 becomes reachable and the DFA stays complete.
    act(() =>
      appStore
        .getState()
        .edit((a) => setEdgeSymbols(setEdgeSymbols(a, 'q0', 'q0', []), 'q0', 'q1', ['a'])),
    );
    expect(container).toBeEmptyDOMElement();
    act(() =>
      appStore.getState().edit((a) => ({
        ...a,
        transitions: [...a.transitions, { id: 'bad', from: 'q0', to: 'gone', symbols: ['a'] }],
      })),
    );
    expect(screen.getByRole('button', { name: /issue/ })).toHaveAttribute('data-severity', 'error');
  });

  it('is hidden while a trace is open', () => {
    const a = appStore.getState().automata[0]!;
    act(() => appStore.getState().openTrace(runWord(a, '')));
    const { container } = render(<IssuesChip />);
    expect(container).toBeEmptyDOMElement();
  });
});
