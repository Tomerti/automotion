import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyAutomaton } from '../../core/model';
import { fixture } from '../../core/testing/fixtures';
import { serialize } from '../../persistence/fileFormat';
import { appStore, resetAppStore } from '../../store/store';
import { startRun } from '../../store/traceActions';
import { HistoryBar } from './HistoryBar';
import { toastStore } from './toastStore';

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
const names = (): string[] => st().automata.map((a) => a.name);

/** Open the ⋯ menu of the entry named `name` and pick `action`. */
async function openAction(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  action: string,
): Promise<void> {
  await user.click(screen.getByRole('button', { name: `More actions for ${name}` }));
  await user.click(screen.getByRole('menuitem', { name: action }));
}

beforeEach(() => {
  resetAppStore({ automata: [parity, blank], activeId: parity.id });
  toastStore.setState({ toasts: [] });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

describe('HistoryBar actions', () => {
  it('each entry has a ⋯ menu that takes focus, moves with the arrows and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<HistoryBar />);
    const more = screen.getByRole('button', { name: 'More actions for Blank' });
    expect(more).toHaveAttribute('aria-haspopup', 'menu');
    await user.click(more);
    const menu = screen.getByRole('menu', { name: 'Actions for Blank' });
    const entries = within(menu).getAllByRole('menuitem');
    expect(entries.map((e) => e.textContent)).toEqual(['Rename', 'Export JSON', 'Delete']);
    expect(entries[0]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(entries[1]).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(more).toHaveFocus();
    // Opening the menu doesn't switch automata.
    expect(st().activeId).toBe(parity.id);
  });

  it('Rename opens the automaton and edits its name in place; Enter commits', async () => {
    const user = userEvent.setup();
    render(<HistoryBar />);
    await openAction(user, 'Blank', 'Rename');
    expect(st().activeId).toBe('blank');
    const input = screen.getByRole('textbox', { name: 'Automaton name' });
    expect(input).toHaveValue('Blank');
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, 'Renamed{Enter}');
    expect(screen.queryByRole('textbox')).toBeNull();
    // A rename is an edit: it goes to the top.
    expect(names()).toEqual(['Renamed', 'Parity']);
    expect(items()[0]).toHaveTextContent('Renamed');
  });

  it('double-clicking an entry renames it; Escape and an empty name cancel, blur commits', async () => {
    const user = userEvent.setup();
    render(
      <>
        <HistoryBar />
        <button type="button">elsewhere</button>
      </>,
    );
    await user.dblClick(items()[1]!);
    await user.keyboard('zzz{Escape}');
    expect(names()).toEqual(['Parity', 'Blank']);
    await user.dblClick(items()[1]!);
    await user.clear(screen.getByRole('textbox', { name: 'Automaton name' }));
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(names()).toEqual(['Parity', 'Blank']);
    await user.dblClick(items()[1]!);
    await user.keyboard('{End} 2');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(names()).toEqual(['Blank 2', 'Parity']);
  });

  it('Rename is disabled while a run is open', async () => {
    const user = userEvent.setup();
    render(<HistoryBar />);
    act(() => startRun('a'));
    await user.click(screen.getByRole('button', { name: 'More actions for Parity' }));
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeDisabled();
  });

  it('Delete asks, removes that automaton and always keeps one', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<HistoryBar />);
    await openAction(user, 'Blank', 'Delete');
    expect(confirm).toHaveBeenCalledWith('Delete "Blank"?');
    expect(names()).toEqual(['Parity', 'Blank']);

    confirm.mockReturnValue(true);
    await openAction(user, 'Blank', 'Delete');
    expect(names()).toEqual(['Parity']);
    // Deleting another automaton keeps the open one.
    expect(st().activeId).toBe(parity.id);

    await openAction(user, 'Parity', 'Delete');
    expect(st().automata).toHaveLength(1);
    expect(st().automata[0]).toMatchObject({ name: 'Untitled', kind: 'DFA', states: [] });
    expect(st().activeId).toBe(st().automata[0]?.id);
  });

  it('Export JSON downloads that automaton; Export all downloads every one', async () => {
    const user = userEvent.setup();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const files: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      files.push(this.download);
    });
    render(<HistoryBar />);
    await openAction(user, 'Blank', 'Export JSON');
    await user.click(screen.getByRole('button', { name: 'Export all' }));
    expect(files).toEqual(['blank.automaton.json', 'automata.automaton.json']);
  });

  it('Import… opens the file picker; a picked file is added, opened and toasted', async () => {
    const user = userEvent.setup();
    render(<HistoryBar />);
    const pick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'Import…' }));
    expect(pick).toHaveBeenCalledTimes(1);
    pick.mockRestore();
    const a = { ...parity, id: 'imp1', name: 'In 1' };
    const b = { ...parity, id: 'imp2', name: 'In 2' };
    const file = new File([serialize([a, b])], 'x.automaton.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Import file'), file);
    await waitFor(() => expect(st().automata).toHaveLength(4));
    expect(st().activeId).toBe('imp2');
    expect(items()[0]).toHaveTextContent('In 2');
    expect(toastStore.getState().toasts[0]?.message).toBe('Imported 2 automata');
  });

  it('Import reports a bad file as an error toast', async () => {
    const user = userEvent.setup();
    render(<HistoryBar />);
    await user.upload(screen.getByLabelText('Import file'), new File(['{oops'], 'bad.json'));
    await waitFor(() => expect(toastStore.getState().toasts).toHaveLength(1));
    expect(toastStore.getState().toasts[0]).toMatchObject({
      message: 'Not a valid JSON file',
      kind: 'error',
    });
  });
});

describe('HistoryBar thumbnails with several start states', () => {
  it('draws a start arrow for each start state', () => {
    const n = fixture({
      kind: 'NFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      starts: ['q0', 'q1'],
      name: 'Two',
    });
    resetAppStore({ automata: [n], activeId: n.id });
    render(<HistoryBar />);
    const thumb = within(items()[0]!).getByTestId('history-thumbnail');
    expect(thumb.querySelectorAll('.av-thumb-start')).toHaveLength(2);
  });
});
