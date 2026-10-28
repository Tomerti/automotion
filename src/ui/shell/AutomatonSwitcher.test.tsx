import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runWord } from '../../core/run';
import { fixture } from '../../core/testing/fixtures';
import { serialize } from '../../persistence/fileFormat';
import { appStore, resetAppStore } from '../../store/store';
import { AutomatonSwitcher } from './AutomatonSwitcher';
import { toastStore } from './toastStore';

const two = () => [
  fixture({ kind: 'DFA', alphabet: 'a', states: ['q0'], name: 'one' }),
  fixture({ kind: 'NFA', alphabet: 'a', states: ['q0'], name: 'two' }),
];

beforeEach(() => {
  resetAppStore();
  toastStore.setState({ toasts: [] });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const openMenu = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: 'Automata' }));
};
const menuItem = (name: string) => screen.getByRole('menuitem', { name });
const names = () => appStore.getState().automata.map((a) => a.name);

describe('AutomatonSwitcher', () => {
  it('shows the current name and lists the automata with the active one checked', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: two(), activeId: 'one' });
    render(<AutomatonSwitcher />);
    expect(screen.getByRole('button', { name: 'one' })).toBeInTheDocument();
    await openMenu(user);
    const items = screen.getAllByTestId('automaton-item');
    expect(items.map((i) => i.textContent)).toEqual(['oneDFA', 'twoNFA']);
    expect(items[0]).toHaveAttribute('aria-checked', 'true');
    expect(items[1]).toHaveAttribute('aria-checked', 'false');
    // The menu takes focus, and the arrow keys move through it.
    expect(items[0]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(items[1]).toHaveFocus();
  });

  it('clicking an automaton switches to it and closes the menu', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: two(), activeId: 'one' });
    render(<AutomatonSwitcher />);
    await openMenu(user);
    await user.click(screen.getByRole('menuitemradio', { name: /two/ }));
    expect(appStore.getState().activeId).toBe('two');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'two' })).toBeInTheDocument();
  });

  it('closes on Escape and on a click outside', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: two(), activeId: 'one' });
    render(
      <>
        <AutomatonSwitcher />
        <p>outside</p>
      </>,
    );
    await openMenu(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'Automata' })).toHaveFocus();
    await openMenu(user);
    await user.click(screen.getByText('outside'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('New DFA and New NFA create and activate an automaton', async () => {
    const user = userEvent.setup();
    render(<AutomatonSwitcher />);
    await openMenu(user);
    await user.click(menuItem('New DFA'));
    expect(appStore.getState().automata[0]?.kind).toBe('DFA');
    expect(appStore.getState().activeId).toBe(appStore.getState().automata[0]?.id);
    await openMenu(user);
    await user.click(menuItem('New NFA'));
    // Newest first.
    expect(appStore.getState().automata[0]?.kind).toBe('NFA');
    expect(appStore.getState().activeId).toBe(appStore.getState().automata[0]?.id);
  });

  it('clicking the name renames in place; Enter commits', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: two(), activeId: 'one' });
    render(<AutomatonSwitcher />);
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
        <AutomatonSwitcher />
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
    render(<AutomatonSwitcher />);
    expect(screen.getByRole('button', { name: 'd' })).toBeDisabled();
  });

  it('Delete asks, removes the active automaton and keeps one on the canvas', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: two(), activeId: 'one' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AutomatonSwitcher />);
    await openMenu(user);
    await user.click(menuItem('Delete'));
    expect(confirm).toHaveBeenCalledWith('Delete "one"?');
    expect(names()).toEqual(['one', 'two']);

    confirm.mockReturnValue(true);
    await openMenu(user);
    await user.click(menuItem('Delete'));
    expect(names()).toEqual(['two']);
    expect(appStore.getState().activeId).toBe('two');

    await openMenu(user);
    await user.click(menuItem('Delete'));
    const left = appStore.getState().automata;
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ name: 'Untitled', kind: 'DFA', states: [] });
    expect(appStore.getState().activeId).toBe(left[0]?.id);
  });

  it('Import adds the file, activates the last automaton and toasts', async () => {
    const user = userEvent.setup();
    const a = { ...two()[1]!, id: 'imp1', name: 'one' };
    const b = { ...two()[1]!, id: 'imp2', name: 'two' };
    render(<AutomatonSwitcher />);
    const file = new File([serialize([a, b])], 'x.automaton.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Import file'), file);
    await waitFor(() => expect(appStore.getState().automata).toHaveLength(2));
    expect(appStore.getState().activeId).toBe('imp2');
    expect(toastStore.getState().toasts[0]?.message).toBe('Imported 2 automata');
  });

  it('Import… opens the file picker', async () => {
    const user = userEvent.setup();
    render(<AutomatonSwitcher />);
    const pick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    await openMenu(user);
    await user.click(menuItem('Import…'));
    expect(pick).toHaveBeenCalledTimes(1);
  });

  it('Import reports a bad file as an error toast', async () => {
    const user = userEvent.setup();
    render(<AutomatonSwitcher />);
    await user.upload(screen.getByLabelText('Import file'), new File(['{oops'], 'bad.json'));
    await waitFor(() => expect(toastStore.getState().toasts).toHaveLength(1));
    expect(toastStore.getState().toasts[0]).toMatchObject({
      message: 'Not a valid JSON file',
      kind: 'error',
    });
  });

  it('Export JSON downloads the current automaton; Export all appears with several', async () => {
    const user = userEvent.setup();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const files: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      files.push(this.download);
    });
    resetAppStore({ automata: [{ ...two()[0]!, name: 'My Auto' }], activeId: 'one' });
    render(<AutomatonSwitcher />);
    await openMenu(user);
    expect(screen.queryByRole('menuitem', { name: 'Export all' })).toBeNull();
    await user.click(menuItem('Export JSON'));
    act(() => appStore.getState().addAutomaton(two()[1]!));
    await openMenu(user);
    await user.click(menuItem('Export all'));
    expect(files).toEqual(['my-auto.automaton.json', 'automata.automaton.json']);
  });
});
