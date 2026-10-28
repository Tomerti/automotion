import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runWord } from '../../core/run';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { AutomatonName } from './AutomatonName';

const two = () => [
  fixture({ kind: 'DFA', alphabet: 'a', states: ['q0'], name: 'one' }),
  fixture({ kind: 'NFA', alphabet: 'a', states: ['q0'], name: 'two' }),
];

beforeEach(() => resetAppStore());
afterEach(cleanup);

const names = () => appStore.getState().automata.map((a) => a.name);

describe('AutomatonName', () => {
  it('shows the current name, with no menu: the history bar has the automata', () => {
    resetAppStore({ automata: two(), activeId: 'one' });
    render(<AutomatonName />);
    expect(screen.getByRole('button', { name: 'one' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Automata' })).toBeNull();
  });

  it('clicking the name renames in place; Enter commits', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: two(), activeId: 'one' });
    render(<AutomatonName />);
    await user.click(screen.getByRole('button', { name: 'one' }));
    const input = screen.getByRole('textbox', { name: 'Automaton name' });
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, 'renamed{Enter}');
    expect(names()).toEqual(['renamed', 'two']);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'renamed' })).toBeInTheDocument();
  });
  it('blur commits a rename; Escape and an empty name cancel it', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: two(), activeId: 'one' });
    render(
      <>
        <AutomatonName />
        <button type="button">elsewhere</button>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'one' }));
    await user.keyboard('zzz{Escape}');
    expect(names()[0]).toBe('one');

    await user.click(screen.getByRole('button', { name: 'one' }));
    await user.keyboard('{Backspace}');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(names()[0]).toBe('one');

    await user.click(screen.getByRole('button', { name: 'one' }));
    await user.keyboard('blurred');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(names()[0]).toBe('blurred');
  });
  it('the name cannot be renamed while a trace is open', () => {
    const d = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0'], start: 'q0', name: 'd' });
    resetAppStore({ automata: [d], activeId: 'd' });
    appStore.getState().openTrace(runWord(d, ''));
    render(<AutomatonName />);
    expect(screen.getByRole('button', { name: 'd' })).toBeDisabled();
  });
});
