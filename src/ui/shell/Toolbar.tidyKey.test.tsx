import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore, type AppState } from '../../store/store';
import { tidyActive } from '../canvas/useCanvasEditing';
import { TEST_LESSON } from '../tutorial/testing/testLesson';
import { endLesson, startLesson, tutorialStore } from '../tutorial/tutorialStore';
import { Toolbar } from './Toolbar';

// The layout itself is Toolbar.test's and layout's business: here Tidy lands at once.
vi.mock('../canvas/useCanvasEditing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../canvas/useCanvasEditing')>();
  return { ...actual, tidyActive: vi.fn(() => Promise.resolve(true)) };
});

const dfa = () => fixture({ kind: 'DFA', alphabet: 'a', states: ['q0'], start: 'q0', name: 'd' });

/** The toolbar beside a stand-in canvas (focusable, with an inline input like a rename box). */
function renderWithCanvas(): { canvas: HTMLElement; input: HTMLElement } {
  render(
    <>
      <Toolbar />
      <div data-testid="canvas" tabIndex={0}>
        <input aria-label="rename" />
        <button type="button">menu item</button>
      </div>
      <div data-testid="elsewhere" tabIndex={0} />
    </>,
  );
  return { canvas: screen.getByTestId('canvas'), input: screen.getByLabelText('rename') };
}

beforeEach(() => {
  resetAppStore({ automata: [dfa()], activeId: 'd' });
  vi.mocked(tidyActive).mockClear();
});
afterEach(() => {
  endLesson();
  cleanup();
});

describe('T tidies from the canvas', () => {
  it('T on the canvas tidies and reports to a running lesson', async () => {
    startLesson(TEST_LESSON);
    const { canvas } = renderWithCanvas();
    fireEvent.keyDown(canvas, { key: 't', code: 'KeyT' });
    expect(tidyActive).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(tutorialStore.getState().actions.has('tidy')).toBe(true));
  });

  it('works with Caps Lock and on a Hebrew layout (the T key types א)', () => {
    const { canvas } = renderWithCanvas();
    fireEvent.keyDown(canvas, { key: 'T', code: 'KeyT' });
    fireEvent.keyDown(canvas, { key: 'א', code: 'KeyT' });
    expect(tidyActive).toHaveBeenCalledTimes(2);
  });

  it('ignores T typed in a field, on a button, off the canvas, held down or with Ctrl/Alt/⌘', () => {
    const { canvas, input } = renderWithCanvas();
    fireEvent.keyDown(input, { key: 't', code: 'KeyT' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'menu item' }), {
      key: 't',
      code: 'KeyT',
    });
    fireEvent.keyDown(screen.getByTestId('elsewhere'), { key: 't', code: 'KeyT' });
    fireEvent.keyDown(canvas, { key: 't', code: 'KeyT', repeat: true });
    fireEvent.keyDown(canvas, { key: 't', code: 'KeyT', ctrlKey: true });
    fireEvent.keyDown(canvas, { key: 't', code: 'KeyT', altKey: true });
    fireEvent.keyDown(canvas, { key: 't', code: 'KeyT', metaKey: true });
    expect(tidyActive).not.toHaveBeenCalled();
  });

  it('does nothing while a trace is open', () => {
    const { canvas } = renderWithCanvas();
    // Only whether a trace is open matters here.
    act(() => appStore.setState({ trace: {} as AppState['trace'] }));
    fireEvent.keyDown(canvas, { key: 't', code: 'KeyT' });
    expect(tidyActive).not.toHaveBeenCalled();
  });
});
