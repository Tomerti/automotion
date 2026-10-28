import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { AutomatonList } from './AutomatonList';

const two = () => [
  fixture({ kind: 'DFA', alphabet: 'a', states: ['q0'], name: 'one' }),
  fixture({ kind: 'NFA', alphabet: 'a', states: ['q0'], name: 'two' }),
];

beforeEach(() => resetAppStore());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AutomatonList', () => {
  it('New DFA creates and activates an automaton', async () => {
    const user = userEvent.setup();
    render(<AutomatonList />);
    await user.click(screen.getByRole('button', { name: 'New DFA' }));
    expect(screen.getByTestId('automaton-item')).toHaveAttribute('aria-current', 'true');
    expect(appStore.getState().automata[0]?.kind).toBe('DFA');
  });

  it('New NFA creates an NFA', async () => {
    const user = userEvent.setup();
    render(<AutomatonList />);
    await user.click(screen.getByRole('button', { name: 'New NFA' }));
    expect(appStore.getState().automata[0]?.kind).toBe('NFA');
  });

  it('clicking an item activates it', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: two(), activeId: 'one' });
    render(<AutomatonList />);
    await user.click(screen.getByText('two'));
    expect(appStore.getState().activeId).toBe('two');
    const items = screen.getAllByTestId('automaton-item');
    expect(items[1]).toHaveAttribute('aria-current', 'true');
    expect(items[0]).not.toHaveAttribute('aria-current');
  });

  it('double-click renames', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: two(), activeId: 'one' });
    render(<AutomatonList />);
    await user.dblClick(screen.getByText('one'));
    const input = screen.getByRole('textbox', { name: 'Automaton name' });
    await user.clear(input);
    await user.type(input, 'renamed{Enter}');
    expect(appStore.getState().automata[0]?.name).toBe('renamed');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('Escape cancels a rename', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: two(), activeId: 'one' });
    render(<AutomatonList />);
    await user.dblClick(screen.getByText('one'));
    await user.type(screen.getByRole('textbox'), 'zzz{Escape}');
    expect(appStore.getState().automata[0]?.name).toBe('one');
  });

  it('delete asks for confirmation', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: two(), activeId: 'one' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AutomatonList />);
    const item = screen.getAllByTestId('automaton-item')[0]!;
    await user.click(within(item).getByRole('button', { name: 'Delete one' }));
    expect(confirm).toHaveBeenCalledWith('Delete "one"?');
    expect(appStore.getState().automata).toHaveLength(2);
    confirm.mockReturnValue(true);
    await user.click(within(item).getByRole('button', { name: 'Delete one' }));
    expect(appStore.getState().automata.map((a) => a.id)).toEqual(['two']);
  });
});
