import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moveState } from '../../core/edit';
import { runWord } from '../../core/run';
import { thompson } from '../../core/thompson';
import { fixture, nthFromEnd } from '../../core/testing/fixtures';
import { decodeShare, readShareHash, sameAutomaton } from '../../persistence/shareLink';
import { appStore, resetAppStore } from '../../store/store';
import { Toolbar } from './Toolbar';
import { TEST_LESSON } from '../tutorial/testing/testLesson';
import { endLesson, startLesson, tutorialStore } from '../tutorial/tutorialStore';
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
      'To regex',
      'Share, copy or export',
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
    expect(btn('Share, copy or export')).toHaveAttribute(
      'title',
      'Share a link, or copy or export the picture or its LaTeX',
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

  it('To regex opens the walkthrough; disabled with the reason', async () => {
    const user = userEvent.setup();
    resetAppStore({ automata: [{ ...nfa(), states: [], starts: [] }], activeId: 'n' });
    const { unmount } = render(<Toolbar />);
    expect(btn('To regex')).toBeDisabled();
    expect(btn('To regex')).toHaveAttribute('title', 'Nothing to convert: add a state first');
    unmount();

    resetAppStore({ automata: [nfa()], activeId: 'n' });
    render(<Toolbar />);
    expect(btn('To regex')).toBeEnabled();
    expect(btn('To regex')).toHaveAttribute(
      'title',
      'To regex: remove states one at a time, step by step',
    );
    await user.click(btn('To regex'));
    expect(appStore.getState().trace?.kind).toBe('eliminate');
    expect(appStore.getState().stepIndex).toBe(0);
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
    await user.click(btn('Share, copy or export'));
    expect(btn('Share, copy or export')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Share link' })).toHaveFocus();
    // Share, then the copies, then the downloads, each group set off by a separator.
    const ownText = (el: Element): string =>
      [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join('');
    const groups = [...screen.getByRole('menu').children].map((el) =>
      el.getAttribute('role') === 'separator' ? '---' : ownText(el),
    );
    expect(groups).toEqual([
      'Share link',
      '---',
      'Copy image',
      'Copy LaTeX',
      '---',
      'Export SVG',
      'Export PNG',
      'Export LaTeX',
    ]);
    expect(screen.getByRole('menuitem', { name: 'Copy image' })).toHaveAttribute(
      'aria-keyshortcuts',
      'Control+C',
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(btn('Share, copy or export')).toHaveFocus();

    await user.click(btn('Share, copy or export'));
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
      await user.click(btn('Share, copy or export'));
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
      await user.click(btn('Share, copy or export'));
      await user.click(screen.getByRole('menuitem', { name: 'Copy LaTeX' }));
      expect(texts).toHaveLength(1);
      expect(texts[0]).toMatch(/^% AutoMotion NFA: .*\n% Needs \\usepackage\{tikz\}/);
      expect(texts[0]).toContain('\\begin{tikzpicture}');
      await waitFor(() =>
        expect(toastStore.getState().toasts).toMatchObject([{ message: 'LaTeX copied' }]),
      );
    });

    it('Share link puts a link to the automaton on the clipboard', async () => {
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
      await user.click(btn('Share, copy or export'));
      await user.click(screen.getByRole('menuitem', { name: 'Share link' }));
      await waitFor(() => expect(texts).toHaveLength(1));
      const base = location.origin + location.pathname;
      expect(texts[0]!.startsWith(base + '#a=')).toBe(true);
      const payload = readShareHash(texts[0]!.slice(base.length));
      expect(payload).not.toBeNull();
      const result = await decodeShare(payload!, new Set());
      expect(result.ok).toBe(true);
      if (result.ok) expect(sameAutomaton(result.automata[0]!, nfa())).toBe(true);
      await waitFor(() =>
        expect(toastStore.getState().toasts).toMatchObject([{ message: 'Link copied' }]),
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

    it('Ctrl+C copies the image on a Hebrew layout (the key types ב)', () => {
      stubClipboard();
      renderWithDiagram();
      fireEvent.keyDown(window, { key: 'ב', code: 'KeyC', ctrlKey: true });
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

  describe('lesson actions', () => {
    const reported = () => [...tutorialStore.getState().actions];
    const renderWithDiagram = (): void => {
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
    };
    const urlFns = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => 'blob:x');
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    });
    afterEach(() => {
      URL.createObjectURL = urlFns.create;
      URL.revokeObjectURL = urlFns.revoke;
      act(() => endLesson());
    });

    /** A lesson running on the open automaton (the TEST_LESSON's own copy is the active one). */
    const runLesson = (): void => {
      resetAppStore({ automata: [] });
      act(() => startLesson(TEST_LESSON));
    };

    it.each([
      ['Share link', 'share-link'],
      ['Copy image', 'copy-image'],
      ['Copy LaTeX', 'copy-latex'],
      ['Export SVG', 'export-svg'],
      ['Export PNG', 'export-png'],
      ['Export LaTeX', 'export-latex'],
    ])('%s reports %s while a lesson runs', async (name, action) => {
      const user = userEvent.setup();
      runLesson();
      renderWithDiagram();
      await user.click(btn('Share, copy or export'));
      await user.click(screen.getByRole('menuitem', { name }));
      // Even though the clipboard or the picture then fails.
      expect(reported()).toEqual([action]);
    });

    it('Ctrl+C with nothing selected reports copy-image', async () => {
      const user = userEvent.setup();
      runLesson();
      renderWithDiagram();
      await user.keyboard('{Control>}c{/Control}');
      expect(reported()).toEqual(['copy-image']);
    });

    it('Ctrl+C with states selected reports nothing: the canvas copies the states', async () => {
      const user = userEvent.setup();
      runLesson();
      renderWithDiagram();
      const id = appStore.getState().activeId!;
      const state = appStore.getState().automata.find((x) => x.id === id)!.states[0]!;
      act(() => appStore.getState().select({ states: [state.id], transitions: [] }));
      await user.keyboard('{Control>}c{/Control}');
      expect(reported()).toEqual([]);
    });

    it('records nothing without a lesson', async () => {
      const user = userEvent.setup();
      resetAppStore({ automata: [nfa()], activeId: 'n' });
      renderWithDiagram();
      await user.click(btn('Share, copy or export'));
      await user.click(screen.getByRole('menuitem', { name: 'Copy LaTeX' }));
      await user.keyboard('{Control>}c{/Control}');
      expect(reported()).toEqual([]);
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
    for (const n of ['Undo', 'Redo', 'Share, copy or export']) expect(btn(n)).toBeDisabled();
  });

  it('Convert, Minimize and To regex are disabled during a Thompson walkthrough', () => {
    const d = fixture({
      kind: 'DFA',
      alphabet: 'a',
      states: ['q0'],
      start: 'q0',
      edges: [['q0', 'a', 'q0']],
      name: 'd',
    });
    resetAppStore({ automata: [d, { ...nfa(), id: 'n2' }], activeId: 'd' });
    appStore.getState().openTrace(thompson('(a|b)*abb'));
    const { unmount } = render(<Toolbar />);
    for (const n of ['Convert to DFA', 'Minimize', 'To regex']) {
      expect(btn(n)).toBeDisabled();
      expect(btn(n)).toHaveAttribute('title', 'Save the NFA first');
    }
    unmount();

    // Another walkthrough doesn't disable them: the active automaton is on screen.
    appStore.getState().closeTrace();
    appStore.getState().openTrace(runWord(appStore.getState().automata[0]!, 'a'));
    render(<Toolbar />);
    expect(btn('Minimize')).toBeEnabled();
    expect(btn('To regex')).toBeEnabled();
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
