import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moveState } from '../../core/edit';
import { runWord } from '../../core/run';
import { fixture, nthFromEnd } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { Toolbar } from './Toolbar';
import { toastStore } from './toastStore';

const nfa = () => fixture({ kind: 'NFA', alphabet: 'a', states: ['q0'], start: 'q0', name: 'n' });

beforeEach(() => {
  resetAppStore();
  toastStore.setState({ toasts: [] });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const btn = (name: string) => screen.getByRole('button', { name });

describe('Toolbar', () => {
  it('disables everything without an active automaton', () => {
    render(<Toolbar />);
    for (const n of [
      'Undo',
      'Redo',
      'Fit',
      'Tidy',
      'Convert to DFA',
      'Minimize',
      'Copy or export',
    ]) {
      expect(btn(n)).toBeDisabled();
    }
  });

  it('icon buttons have tooltips', () => {
    resetAppStore({ automata: [nfa()], activeId: 'n' });
    render(<Toolbar />);
    expect(btn('Undo')).toHaveAttribute('title', 'Undo (Ctrl+Z)');
    expect(btn('Fit')).toHaveAttribute('title', 'Fit to view');
    expect(btn('Tidy')).toHaveAttribute('title', 'Tidy the layout');
    expect(btn('Copy or export')).toHaveAttribute(
      'title',
      'Copy or export the picture or its LaTeX',
    );
  });

  it('Minimize is disabled with a reason on an NFA', () => {
    resetAppStore({ automata: [nfa()], activeId: 'n' });
    render(<Toolbar />);
    expect(btn('Minimize')).toBeDisabled();
    expect(btn('Minimize')).toHaveAttribute(
      'title',
      'Minimization needs a DFA: use Convert to DFA first',
    );
  });

  it('Convert to DFA is disabled with a reason on a DFA', () => {
    resetAppStore({ automata: [{ ...nfa(), kind: 'DFA' }], activeId: 'n' });
    render(<Toolbar />);
    expect(btn('Convert to DFA')).toBeDisabled();
    expect(btn('Convert to DFA')).toHaveAttribute(
      'title',
      'Already a DFA: Convert to DFA turns an NFA into one',
    );
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

  it('the export menu downloads SVG and closes; Escape closes it too', async () => {
    const user = userEvent.setup();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    resetAppStore({ automata: [{ ...nfa(), name: 'My Auto' }], activeId: 'n' });
    render(
      <>
        <Toolbar />
        <div data-testid="canvas">
          <svg data-testid="diagram">
            <g />
          </svg>
        </div>
      </>,
    );
    await user.click(btn('Copy or export'));
    expect(btn('Copy or export')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Copy image' })).toHaveFocus();
    expect(screen.getByRole('menuitem', { name: 'Export SVG' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Export PNG' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy image' })).toHaveAttribute(
      'aria-keyshortcuts',
      'Control+C',
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(btn('Copy or export')).toHaveFocus();

    await user.click(btn('Copy or export'));
    await user.click(screen.getByRole('menuitem', { name: 'Export SVG' }));
    expect(screen.queryByRole('menu')).toBeNull();
    await waitFor(() => expect(names).toEqual(['my-auto.svg']));
  });

  describe('copy image', () => {
    /** Stand-in for the browser's ClipboardItem: keeps what was put on it. */
    class FakeClipboardItem {
      readonly items: Record<string, Promise<Blob>>;
      constructor(items: Record<string, Promise<Blob>>) {
        this.items = items;
        // jsdom never renders the PNG; don't let a stray rejection fail the run.
        for (const blob of Object.values(items)) blob.catch(() => undefined);
      }
    }
    let written: FakeClipboardItem[][];

    /** Call after userEvent.setup(), which installs a clipboard of its own. */
    function stubClipboard(
      write: (items: FakeClipboardItem[]) => Promise<void> = async (items) => {
        written.push(items);
      },
    ): void {
      vi.stubGlobal('ClipboardItem', FakeClipboardItem);
      Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });
    }

    const renderWithDiagram = (): void => {
      render(
        <>
          <Toolbar />
          <input aria-label="Some field" />
          <div data-testid="canvas">
            <svg data-testid="diagram">
              <g />
            </svg>
          </div>
        </>,
      );
    };

    beforeEach(() => {
      written = [];
      resetAppStore({ automata: [nfa()], activeId: 'n' });
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('Copy image puts one PNG on the clipboard', async () => {
      const user = userEvent.setup();
      stubClipboard();
      renderWithDiagram();
      await user.click(btn('Copy or export'));
      await user.click(screen.getByRole('menuitem', { name: 'Copy image' }));
      expect(screen.queryByRole('menu')).toBeNull();
      expect(written).toHaveLength(1);
      expect(Object.keys(written[0]![0]!.items)).toEqual(['image/png']);
      await waitFor(() =>
        expect(toastStore.getState().toasts).toMatchObject([{ message: 'Image copied' }]),
      );
    });

    it('Copy LaTeX puts the TikZ picture on the clipboard as text', async () => {
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
      renderWithDiagram();
      await user.click(btn('Copy or export'));
      await user.click(screen.getByRole('menuitem', { name: 'Copy LaTeX' }));
      expect(texts).toHaveLength(1);
      expect(texts[0]).toMatch(/^% AutoMotion NFA: .*\n% Needs \\usepackage\{tikz\}/);
      expect(texts[0]).toContain('\\begin{tikzpicture}');
      await waitFor(() =>
        expect(toastStore.getState().toasts).toMatchObject([{ message: 'LaTeX copied' }]),
      );
    });

    it('Ctrl+C copies the image, but not while typing in a field', async () => {
      const user = userEvent.setup();
      stubClipboard();
      renderWithDiagram();
      await user.keyboard('{Control>}c{/Control}');
      expect(written).toHaveLength(1);
      await user.click(screen.getByLabelText('Some field'));
      await user.keyboard('{Control>}c{/Control}');
      expect(written).toHaveLength(1);
    });

    it('Ctrl+C leaves the image alone while states are selected (it copies them instead)', async () => {
      const user = userEvent.setup();
      stubClipboard();
      const active = appStore.getState().automata[0]!;
      appStore.getState().select({ states: [active.states[0]!.id], transitions: [] });
      renderWithDiagram();
      await user.keyboard('{Control>}c{/Control}');
      expect(written).toHaveLength(0);
      // A selection that undo left pointing at no state does not count.
      appStore.getState().select({ states: ['gone'], transitions: [] });
      await user.keyboard('{Control>}c{/Control}');
      expect(written).toHaveLength(1);
    });

    it('Ctrl+C does nothing while a trace is open', async () => {
      const user = userEvent.setup();
      stubClipboard();
      const active = appStore.getState().automata[0]!;
      appStore.getState().openTrace(runWord(active, 'a'));
      renderWithDiagram();
      await user.keyboard('{Control>}c{/Control}');
      expect(written).toHaveLength(0);
    });

    it('says why when the clipboard refuses or the browser can’t copy images', async () => {
      const user = userEvent.setup();
      stubClipboard(() => Promise.reject(new Error('denied')));
      renderWithDiagram();
      await user.keyboard('{Control>}c{/Control}');
      await waitFor(() =>
        expect(toastStore.getState().toasts).toMatchObject([
          { message: 'Could not copy the image: use Export PNG instead', kind: 'error' },
        ]),
      );

      toastStore.setState({ toasts: [] });
      vi.stubGlobal('ClipboardItem', undefined);
      await user.keyboard('{Control>}c{/Control}');
      expect(toastStore.getState().toasts).toMatchObject([
        { message: 'This browser can’t copy images: use Export PNG instead', kind: 'error' },
      ]);
    });
  });

  it('Undo/Redo and export are disabled while a trace is open', () => {
    const d = fixture({
      kind: 'DFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      start: 'q0',
      edges: [
        ['q0', 'a', 'q1'],
        ['q1', 'a', 'q1'],
      ],
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
    for (const n of ['Undo', 'Redo', 'Copy or export']) expect(btn(n)).toBeDisabled();
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
