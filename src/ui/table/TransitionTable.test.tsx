import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Automaton } from '../../core/model';
import { fixture } from '../../core/testing/fixtures';
import { TransitionTable } from './TransitionTable';

afterEach(cleanup);

const dfa = () =>
  fixture({
    kind: 'DFA',
    alphabet: 'ab',
    states: ['q0', 'q1'],
    start: 'q0',
    accepting: ['q1'],
    edges: [['q0', 'a', 'q0']],
  });
const nfa = () =>
  fixture({
    kind: 'NFA',
    alphabet: 'a',
    states: ['q0', 'q1'],
    start: 'q0',
    edges: [['q0', 'a', 'q1']],
  });

function setup(a: Automaton, readOnly = false) {
  const edits: ((a: Automaton) => Automaton)[] = [];
  const onEdit = vi.fn((fn: (a: Automaton) => Automaton) => edits.push(fn));
  const user = userEvent.setup();
  render(<TransitionTable automaton={a} readOnly={readOnly} onEdit={onEdit} />);
  const last = () => edits[edits.length - 1]!(a);
  return { user, onEdit, last };
}

describe('TransitionTable', () => {
  it('choosing a target in a DFA cell moves the transition', async () => {
    const { user, last } = setup(dfa());
    await user.selectOptions(screen.getByLabelText('δ(q0, a)'), 'q1');
    const next = last();
    expect(next.transitions.find((t) => t.from === 'q0' && t.to === 'q1')?.symbols).toEqual(['a']);
    expect(next.transitions.some((t) => t.from === 'q0' && t.to === 'q0')).toBe(false);
  });

  it('choosing — removes the transition', async () => {
    const { user, last } = setup(dfa());
    expect(screen.getByLabelText('δ(q0, a)')).toHaveValue('q0');
    await user.selectOptions(screen.getByLabelText('δ(q0, a)'), '');
    expect(last().transitions).toEqual([]);
  });

  it('toggling NFA chips adds and removes targets', async () => {
    const { user, last } = setup(nfa());
    const group = screen.getByRole('group', { name: 'δ(q0, a)' });
    expect(within(group).getByRole('checkbox', { name: 'q1' })).toBeChecked();
    expect(within(group).getByRole('checkbox', { name: 'q0' })).not.toBeChecked();
    await user.click(within(group).getByRole('checkbox', { name: 'q0' }));
    expect(last().transitions.find((t) => t.to === 'q0')?.symbols).toEqual(['a']);
    await user.click(within(group).getByRole('checkbox', { name: 'q1' }));
    expect(last().transitions.some((t) => t.to === 'q1')).toBe(false);
  });

  it('shows an ε column only for NFAs', () => {
    setup(nfa());
    expect(screen.getByRole('group', { name: 'δ(q0, ε)' })).toBeInTheDocument();
    cleanup();
    setup(dfa());
    expect(screen.queryByRole('group', { name: 'δ(q0, ε)' })).toBeNull();
    expect(screen.queryByText('ε')).toBeNull();
  });

  it('adds an alphabet symbol from the header', async () => {
    const { user, last } = setup(dfa());
    await user.type(screen.getByLabelText('Add symbol'), 'c{Enter}');
    expect(last().alphabet).toEqual(['a', 'b', 'c']);
  });

  it('rejects invalid or duplicate new symbols', async () => {
    const { user, onEdit } = setup(dfa());
    await user.type(screen.getByLabelText('Add symbol'), 'a{Enter}');
    expect(screen.getByText("'a' is already in the alphabet")).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Add symbol'));
    await user.type(screen.getByLabelText('Add symbol'), 'xy{Enter}');
    expect(screen.getByText(/single characters/)).toBeInTheDocument();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('renames and removes alphabet symbols', async () => {
    const { user, last } = setup(dfa());
    await user.dblClick(screen.getByText('b', { selector: 'span' }));
    await user.clear(screen.getByLabelText('Rename symbol b'));
    await user.type(screen.getByLabelText('Rename symbol b'), 'z{Enter}');
    expect(last().alphabet).toEqual(['a', 'z']);
    await user.click(screen.getByRole('button', { name: 'Remove symbol a' }));
    expect(last().alphabet).toEqual(['b']);
  });

  it('rename symbol rejects existing symbols', async () => {
    const { user, onEdit } = setup(dfa());
    await user.dblClick(screen.getByText('b', { selector: 'span' }));
    await user.clear(screen.getByLabelText('Rename symbol b'));
    await user.type(screen.getByLabelText('Rename symbol b'), 'a{Enter}');
    expect(screen.getByText("'a' is already in the alphabet")).toBeInTheDocument();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('row header: start, accepting, delete', async () => {
    const { user, last } = setup(dfa());
    expect(screen.getByRole('button', { name: 'Set q0 as start' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Set q1 as start' }));
    expect(last().start).toBe('q1');
    expect(screen.getByRole('button', { name: 'Toggle q1 accepting' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Toggle q0 accepting' }));
    expect(last().accepting).toEqual(['q1', 'q0']);
    await user.click(screen.getByRole('button', { name: 'Delete q1' }));
    expect(last().states.map((s) => s.id)).toEqual(['q0']);
  });

  it('renames a state, rejecting empty and duplicate labels', async () => {
    const { user, onEdit, last } = setup(dfa());
    await user.dblClick(screen.getByText('q1', { selector: 'span' }));
    const input = screen.getByLabelText('Rename state q1');
    await user.clear(input);
    await user.type(input, 'q0{Enter}');
    expect(screen.getByText('Two states are named q0')).toBeInTheDocument();
    expect(onEdit).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, 'end{Enter}');
    expect(last().states[1]?.label).toBe('end');
    await user.dblClick(screen.getByText('q0', { selector: 'span' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByLabelText('Rename state q0')).toBeNull();
  });

  it('marks cells involved in nondeterminism', () => {
    const a = fixture({
      kind: 'DFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      start: 'q0',
      edges: [
        ['q0', 'a', 'q0'],
        ['q0', 'a', 'q1'],
      ],
    });
    setup(a);
    expect(screen.getByLabelText('δ(q0, a)')).toHaveAttribute('data-error', 'true');
    expect(screen.getByLabelText('δ(q1, a)')).not.toHaveAttribute('data-error');
  });

  it('is read-only while readOnly', () => {
    setup(dfa(), true);
    for (const el of [
      ...screen.getAllByRole('button'),
      ...screen.getAllByRole('combobox'),
      ...screen.getAllByRole('textbox'),
    ]) {
      expect(el).toBeDisabled();
    }
    cleanup();
    setup(nfa(), true);
    for (const el of screen.getAllByRole('checkbox')) expect(el).toBeDisabled();
  });
});
