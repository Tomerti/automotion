import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyAutomaton } from '../../core/model';
import { fixture } from '../../core/testing/fixtures';
import { serialize } from '../../persistence/fileFormat';
import { decodeShare, readShareHash, sameAutomaton } from '../../persistence/shareLink';
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

  it('Create adds a DFA at the top and opens it', async () => {
    const user = userEvent.setup();
    render(<HistoryBar />);
    expect(screen.queryByRole('button', { name: /New [DN]FA/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(items()).toHaveLength(3);
    expect(items()[0]).toHaveTextContent('Untitled');
    expect(items()[0]).toHaveAttribute('aria-current', 'page');
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
    expect(entries.map((e) => e.textContent)).toEqual([
      'Rename',
      'Duplicate',
      'Copy link',
      'Export JSON',
      'Export LaTeX',
      'Delete',
    ]);
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

  it('Duplicate adds a copy at the top and opens it, also while a run is open', async () => {
    const user = userEvent.setup();
    render(<HistoryBar />);
    act(() => startRun('a'));
    await openAction(user, 'Parity', 'Duplicate');
    expect(names()).toEqual(['Parity copy', 'Parity', 'Blank']);
    expect(st().activeId).toBe(st().automata[0]?.id);
    expect(st().trace).toBeNull();
    expect(items()[0]).toHaveTextContent('Parity copyDFA · 2 states');
    expect(items()[0]).toHaveAttribute('aria-current', 'page');
  });

  it('an entry menu copies its link', async () => {
    const user = userEvent.setup();
    const texts: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (t: string) => {
          texts.push(t);
        },
      },
      configurable: true,
    });
    render(<HistoryBar />);
    await openAction(user, 'Blank', 'Copy link');
    await waitFor(() => expect(texts).toHaveLength(1));
    const base = location.origin + location.pathname;
    expect(texts[0]!.startsWith(base + '#a=')).toBe(true);
    const payload = readShareHash(texts[0]!.slice(base.length));
    expect(payload).not.toBeNull();
    const result = await decodeShare(payload!, new Set());
    expect(result.ok).toBe(true);
    if (result.ok) expect(sameAutomaton(result.automata[0]!, blank)).toBe(true);
    expect(st().activeId).toBe(parity.id);
    await waitFor(() =>
      expect(toastStore.getState().toasts).toMatchObject([{ message: 'Link copied' }]),
    );
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

  it('the Delete key on a clicked entry asks and deletes it; keys in a rename field don’t', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<HistoryBar />);
    await user.click(items()[1]!);
    expect(items()[1]).toHaveFocus();
    await user.keyboard('{Delete}');
    expect(confirm).toHaveBeenCalledWith('Delete "Blank"?');
    expect(names()).toEqual(['Parity', 'Blank']);

    confirm.mockReturnValue(true);
    await user.keyboard('{Backspace}');
    expect(names()).toEqual(['Parity']);
    expect(st().activeId).toBe(parity.id);

    confirm.mockClear();
    await user.dblClick(items()[0]!);
    await user.keyboard('{Backspace}{Delete}');
    expect(confirm).not.toHaveBeenCalled();
    expect(names()).toEqual(['Parity']);
  });

  it('Ctrl+click picks several entries, with the open one, and Delete deletes them all after asking', async () => {
    const third = { ...emptyAutomaton('Third', 'DFA'), id: 'third' };
    resetAppStore({ automata: [parity, blank, third], activeId: parity.id });
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<HistoryBar />);
    await user.keyboard('{Control>}');
    await user.click(items()[2]!);
    await user.keyboard('{/Control}');
    // Ctrl+click doesn't open the entry; the open one joins the selection.
    expect(st().activeId).toBe(parity.id);
    expect(items()[2]).toHaveFocus();
    expect(items().map((el) => el.dataset.selected)).toEqual(['true', undefined, 'true']);

    await user.keyboard('{Delete}');
    expect(confirm).toHaveBeenCalledWith('Delete 2 automata ("Parity" and "Third")?');
    expect(names()).toEqual(['Parity', 'Blank', 'Third']);
    expect(items().filter((el) => el.dataset.selected)).toHaveLength(2);

    confirm.mockReturnValue(true);
    await user.keyboard('{Backspace}');
    expect(names()).toEqual(['Blank']);
    expect(st().activeId).toBe(blank.id);
    expect(items()[0]!.dataset.selected).toBeUndefined();
  });

  it('Ctrl+A on an entry picks every automaton, and Delete deletes them all', async () => {
    const third = { ...emptyAutomaton('Third', 'DFA'), id: 'third' };
    resetAppStore({ automata: [parity, blank, third], activeId: parity.id });
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<HistoryBar />);
    await user.click(items()[1]!);
    await user.keyboard('{Control>}a{/Control}');
    expect(items().map((el) => el.dataset.selected)).toEqual(['true', 'true', 'true']);
    expect(st().activeId).toBe(blank.id);

    // Ctrl+click still takes one out.
    await user.keyboard('{Control>}');
    await user.click(items()[0]!);
    await user.keyboard('{/Control}');
    expect(items().map((el) => el.dataset.selected)).toEqual([undefined, 'true', 'true']);

    await user.keyboard('{Control>}a{/Control}{Delete}');
    expect(confirm).toHaveBeenCalledWith('Delete 3 automata ("Parity", "Blank" and "Third")?');
    expect(st().automata).toHaveLength(1);
    expect(st().automata[0]).toMatchObject({ name: 'Untitled', kind: 'DFA', states: [] });

    // In the rename field, Ctrl+A selects its text, not the entries.
    await user.dblClick(items()[0]!);
    await user.keyboard('{Control>}a{/Control}');
    expect(screen.getByRole('textbox', { name: 'Automaton name' })).toBeInTheDocument();
    expect(items()[0]!.dataset.selected).toBeUndefined();
  });

  it('Ctrl+click on a picked entry takes it out; a plain click, Escape or a click outside clears', async () => {
    const third = { ...emptyAutomaton('Third', 'DFA'), id: 'third' };
    resetAppStore({ automata: [parity, blank, third], activeId: parity.id });
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <>
        <HistoryBar />
        <button type="button">Outside</button>
      </>,
    );
    const picked = (): (string | undefined)[] => items().map((el) => el.dataset.selected);
    const ctrlClick = async (el: HTMLElement): Promise<void> => {
      await user.keyboard('{Control>}');
      await user.click(el);
      await user.keyboard('{/Control}');
    };

    await ctrlClick(items()[1]!);
    await ctrlClick(items()[2]!);
    await ctrlClick(items()[0]!);
    expect(picked()).toEqual([undefined, 'true', 'true']);
    // Ctrl+double-click doesn't rename.
    await user.keyboard('{Control>}');
    await user.dblClick(items()[1]!);
    await user.keyboard('{/Control}');
    expect(screen.queryByRole('textbox', { name: 'Automaton name' })).toBeNull();
    expect(picked()).toEqual([undefined, 'true', 'true']);

    await user.keyboard('{Escape}');
    expect(picked()).toEqual([undefined, undefined, undefined]);

    await ctrlClick(items()[1]!);
    expect(picked()).toEqual(['true', 'true', undefined]);
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(picked()).toEqual([undefined, undefined, undefined]);

    await ctrlClick(items()[1]!);
    await user.click(items()[2]!);
    expect(picked()).toEqual([undefined, undefined, undefined]);
    expect(st().activeId).toBe(third.id);
    // With nothing picked, Delete takes only the focused entry.
    await user.keyboard('{Delete}');
    expect(confirm).toHaveBeenLastCalledWith('Delete "Third"?');
    expect(names()).toEqual(['Parity', 'Blank']);
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
    await user.click(screen.getByRole('menuitem', { name: 'Export all as JSON' }));
    expect(files).toEqual(['blank.automaton.json', 'automata.automaton.json']);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Export all as LaTeX downloads one .tex with a picture per automaton that has states', async () => {
    const user = userEvent.setup();
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:x';
    });
    URL.revokeObjectURL = vi.fn();
    const files: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      files.push(this.download);
    });
    render(<HistoryBar />);
    await user.click(screen.getByRole('button', { name: 'Export all' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export all as LaTeX' }));
    expect(files).toEqual(['automata.tex']);
    const text = (await blobs[0]?.text()) ?? '';
    expect(text).toContain('% AutoMotion DFA: Parity');
    expect(text).not.toContain('Blank'); // no states: nothing to draw
  });

  it('Export LaTeX downloads that automaton as a .tex document', async () => {
    const user = userEvent.setup();
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:x';
    });
    URL.revokeObjectURL = vi.fn();
    const files: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      files.push(this.download);
    });
    render(<HistoryBar />);
    await openAction(user, 'Parity', 'Export LaTeX');
    expect(files).toEqual(['parity.tex']);
    const text = await blobs[0]?.text();
    expect(text).toContain('\\documentclass[tikz, border=10pt]{standalone}');
    expect(text).toContain('% AutoMotion DFA: Parity');
    expect(text).toContain('\\node[state, initial, initial text={}] (q0)');
  });

  it('Import… takes a LaTeX file, one automaton per tikzpicture', async () => {
    const user = userEvent.setup();
    render(<HistoryBar />);
    const tex = String.raw`
      \begin{tikzpicture}
        \node[state, initial] (a) at (0,0) {$a$};
        \node[state, accepting] (b) at (2,0) {$b$};
        \path[->] (a) edge node {0} (b);
      \end{tikzpicture}
      \begin{tikzpicture}
        \node[state, initial] (c) at (0,0) {$c$};
      \end{tikzpicture}`;
    await user.upload(screen.getByLabelText('Import file'), new File([tex], 'homework 3.tex'));
    await waitFor(() => expect(st().automata).toHaveLength(4));
    expect(names().slice(0, 2)).toEqual(['homework 3 2', 'homework 3 1']);
    expect(toastStore.getState().toasts[0]?.message).toBe('Imported 2 automata');
  });

  it('Import reports a LaTeX file it can’t read', async () => {
    const user = userEvent.setup();
    render(<HistoryBar />);
    await user.upload(
      screen.getByLabelText('Import file'),
      new File(['\\section{Hi}'], 'notes.tex'),
    );
    await waitFor(() => expect(toastStore.getState().toasts).toHaveLength(1));
    expect(toastStore.getState().toasts[0]).toMatchObject({
      message: 'No tikzpicture found in the LaTeX file',
      kind: 'error',
    });
  });

  it('Import → Import file… opens the file picker; a picked file is added, opened and toasted', async () => {
    const user = userEvent.setup();
    render(<HistoryBar />);
    const pick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import file…' }));
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

  it('Import → Paste LaTeX… adds the automata pasted into its box', async () => {
    const user = userEvent.setup();
    render(<HistoryBar />);
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await user.click(screen.getByRole('menuitem', { name: 'Paste LaTeX…' }));
    const dialog = screen.getByRole('dialog', { name: 'Paste LaTeX' });
    const box = within(dialog).getByRole('textbox');
    expect(box).toHaveFocus();
    expect(dialog).toHaveTextContent('press Ctrl+V on the canvas');
    const tex = String.raw`\begin{tikzpicture}
      \node[state, initial] (a) at (0,0) {$a$};
      \node[state, accepting] (b) at (2,0) {$b$};
      \path[->] (a) edge node {0} (b);
    \end{tikzpicture}`;
    await user.click(box);
    await user.paste(tex);
    await user.click(within(dialog).getByRole('button', { name: 'Add automata' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(st().automata).toHaveLength(3);
    expect(st().automata[0]?.states.map((q) => q.label)).toEqual(['a', 'b']);
    expect(toastStore.getState().toasts[0]?.message).toBe('Added 1 automaton from LaTeX');
  });

  it('Paste LaTeX… keeps the dialog open with the error when the text is no TikZ code', async () => {
    const user = userEvent.setup();
    render(<HistoryBar />);
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await user.click(screen.getByRole('menuitem', { name: 'Paste LaTeX…' }));
    const dialog = screen.getByRole('dialog', { name: 'Paste LaTeX' });
    await user.click(within(dialog).getByRole('button', { name: 'Add automata' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Paste the LaTeX code first');
    await user.type(within(dialog).getByRole('textbox'), 'hello');
    expect(within(dialog).queryByRole('alert')).toBeNull();
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(within(dialog).getByRole('alert')).toBeInTheDocument();
    expect(st().automata).toHaveLength(2);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
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
