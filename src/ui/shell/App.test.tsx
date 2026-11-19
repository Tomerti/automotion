import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { subsetConstruction } from '../../core/subset';
import { startMinimize, startRun, startSubset } from '../../store/traceActions';
import { CONVERT_LESSON } from '../tutorial/lessons/convert';
import { IDEA_LESSON, PAUSING_LESSON } from '../tutorial/testing/testLesson';
import { endLesson, startLesson, tutorialStore } from '../tutorial/tutorialStore';
import App from './App';
import { HISTORY_BAR_KEY } from './historyPrefs';
import { toastStore } from './toastStore';

const loop = () =>
  fixture({
    kind: 'DFA',
    alphabet: 'a',
    states: ['q0'],
    start: 'q0',
    accepting: ['q0'],
    edges: [['q0', 'a', 'q0']],
    name: 'd',
  });

beforeEach(() => resetAppStore());
afterEach(cleanup);

it('renders the app title in the top bar', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'AutoMotion' })).toBeInTheDocument();
  expect(screen.getByRole('banner')).toContainElement(
    screen.getByRole('toolbar', { name: 'Automaton tools' }),
  );
});

it('the history bar sits beside the canvas; the canvas and the dock fill the rest', () => {
  resetAppStore({ automata: [loop()], activeId: 'd' });
  render(<App />);
  expect(screen.queryByTestId('right-panel')).toBeNull();
  const history = screen.getByRole('navigation', { name: 'History' });
  expect(history).not.toContainElement(screen.getByRole('main'));
  const main = screen.getByRole('main');
  expect(within(main).getByTestId('diagram')).toBeInTheDocument();
  expect(within(main).getByTestId('dock')).toContainElement(screen.getByLabelText('Word'));
});

it('the History button hides and shows the history bar, and the choice is remembered', async () => {
  const user = userEvent.setup();
  localStorage.removeItem(HISTORY_BAR_KEY);
  const { unmount } = render(<App />);
  const toggle = screen.getByRole('button', { name: 'History' });
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('navigation', { name: 'History' })).toBeNull();
  unmount();
  render(<App />);
  expect(screen.queryByRole('navigation', { name: 'History' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'History' }));
  expect(screen.getByRole('navigation', { name: 'History' })).toBeInTheDocument();
  localStorage.removeItem(HISTORY_BAR_KEY);
});

it('the dock swaps the run pill for the trace player while a trace is open', async () => {
  const user = userEvent.setup();
  resetAppStore({ automata: [loop()], activeId: 'd' });
  render(<App />);
  const dock = screen.getByTestId('dock');
  expect(dock).toHaveAttribute('data-mode', 'run');
  act(() => startRun('aa'));
  expect(dock).toHaveAttribute('data-mode', 'trace');
  expect(screen.getByLabelText('Word')).not.toBeVisible();
  expect(within(dock).getByRole('button', { name: 'Next' })).toBeInTheDocument();
  await user.click(within(dock).getByRole('button', { name: 'Close' }));
  expect(dock).toHaveAttribute('data-mode', 'run');
  expect(screen.getByLabelText('Word')).toBeVisible();
});

it('→ right after Enter in the word box steps the run: the hidden box lets go of the focus', async () => {
  const user = userEvent.setup();
  resetAppStore({ automata: [loop()], activeId: 'd' });
  render(<App />);
  await user.type(screen.getByLabelText('Word'), 'aa{Enter}');
  expect(screen.getByLabelText('Word')).not.toHaveFocus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByTestId('step-counter')).toHaveTextContent(/^Step 2 \/ /);
});

it('Create from the history bar shows its diagram, and the kind pill switches it to an NFA', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Create' }));
  expect(screen.getByTestId('diagram')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Untitled' })).toBeInTheDocument();
  const pill = screen.getByRole('group', { name: 'Kind' });
  expect(within(pill).getByRole('button', { name: 'DFA' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(within(pill).getByRole('button', { name: 'NFA' }));
  expect(appStore.getState().automata[0]?.kind).toBe('NFA');
});

it('Ctrl+C on a history entry copies that automaton and Ctrl+V adds a copy of it', async () => {
  const user = userEvent.setup();
  localStorage.removeItem(HISTORY_BAR_KEY);
  toastStore.setState({ toasts: [] });
  const other = { ...loop(), id: 'e', name: 'e' };
  resetAppStore({ automata: [loop(), other], activeId: 'd' });
  // Selected states would take Ctrl+C on the canvas; on a history entry the entry wins.
  appStore.getState().select({ states: ['q0'], transitions: [] });
  const write = vi.fn();
  Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });
  render(<App />);
  const entry = within(screen.getByRole('navigation', { name: 'History' }))
    .getAllByTestId('history-item')
    .find((el) => el.textContent?.startsWith('e'))!;
  await user.click(entry);
  await user.keyboard('{Control>}c{/Control}');
  expect(write).not.toHaveBeenCalled();
  expect(appStore.getState().clipboard).toMatchObject({ kind: 'automaton' });
  expect(toastStore.getState().toasts).toMatchObject([
    { message: 'Copied "e": Ctrl+V adds a copy of it' },
  ]);
  await user.keyboard('{Control>}v{/Control}');
  expect(appStore.getState().automata.map((a) => a.name)).toEqual(['e copy', 'd', 'e']);
  expect(appStore.getState().activeId).toBe(appStore.getState().automata[0]!.id);
});

it('Ctrl+A in the history bar picks automata, not the canvas’s states; elsewhere it selects the states', async () => {
  const user = userEvent.setup();
  localStorage.removeItem(HISTORY_BAR_KEY);
  const other = { ...loop(), id: 'e', name: 'e' };
  resetAppStore({ automata: [loop(), other], activeId: 'd' });
  render(<App />);
  const nav = screen.getByRole('navigation', { name: 'History' });
  const entries = within(nav).getAllByTestId('history-item');
  await user.click(entries[0]!);
  await user.keyboard('{Control>}a{/Control}');
  expect(entries.map((el) => el.dataset.selected)).toEqual(['true', 'true']);
  expect(appStore.getState().selection.states).toEqual([]);
  await user.keyboard('{Escape}');
  await user.click(screen.getByTestId('diagram'));
  await user.keyboard('{Control>}a{/Control}');
  expect(appStore.getState().selection.states).toEqual(['q0']);
});

it('a failed autosave shows an error toast', async () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('full');
  });
  toastStore.setState({ toasts: [] });
  render(<App />);
  act(() => {
    appStore.getState().createAutomaton('DFA');
  });
  await waitFor(() =>
    expect(toastStore.getState().toasts).toEqual([
      expect.objectContaining({ message: "Changes won't persist — export to save", kind: 'error' }),
    ]),
  );
  setItem.mockRestore();
});

it('a run plays at once, and a new run starts again at 1× speed', async () => {
  const user = userEvent.setup();
  resetAppStore({ automata: [loop()], activeId: 'd' });
  render(<App />);
  act(() => startRun('aaaaaa'));
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Speed' }), '2');
  act(() => startRun('aaa'));
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Speed' })).toHaveValue('1');
});

it('a conversion to DFA plays at once', async () => {
  const nfa = fixture({
    kind: 'NFA',
    alphabet: 'a',
    states: ['q0', 'q1'],
    start: 'q0',
    accepting: ['q1'],
    edges: [
      ['q0', 'a', 'q0'],
      ['q0', 'a', 'q1'],
    ],
    name: 'n',
  });
  resetAppStore({ automata: [nfa], activeId: 'n' });
  render(<App />);
  await act(() => startSubset());
  expect(appStore.getState().trace?.kind).toBe('subset');
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
});

it('a minimization walkthrough opens paused', () => {
  resetAppStore({ automata: [loop()], activeId: 'd' });
  render(<App />);
  act(() => startMinimize());
  expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
});

it('a lesson pauses playback at the moment its step explains, even once that step is done', () => {
  vi.useFakeTimers();
  try {
    startLesson(PAUSING_LESSON);
    render(<App />);
    const state = appStore.getState();
    const lesson = state.automata.find((a) => a.id === state.activeId)!;
    act(() => appStore.getState().openTrace(subsetConstruction(lesson)));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(800));
    act(() => void vi.advanceTimersByTime(800));
    const total = appStore.getState().trace!.steps.length;
    expect(screen.getByTestId('step-counter')).toHaveTextContent(`Step 3 / ${total}`);
    // Reaching step 3 latched the pausing step: the card is on the next one, the player paused.
    expect(tutorialStore.getState().current).toBe(2);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(2400));
    expect(screen.getByTestId('step-counter')).toHaveTextContent(`Step 3 / ${total}`);
    act(() => screen.getByRole('button', { name: 'Play' }).click());
    for (let i = 3; i < total; i++) act(() => void vi.advanceTimersByTime(800));
    expect(screen.getByTestId('step-counter')).toHaveTextContent(`Step ${total} / ${total}`);
  } finally {
    endLesson();
    vi.useRealTimers();
  }
});

it('opens the Convert lesson’s walkthrough paused on its first step', async () => {
  try {
    startLesson(CONVERT_LESSON);
    render(<App />);
    act(() => screen.getByTestId('tutorial-next').click());
    await act(() => startSubset());
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByTestId('step-counter')).toHaveTextContent(/^Step 1 \/ /);
    expect(screen.getByTestId('tutorial-card')).toHaveTextContent('The DFA starts in');
  } finally {
    endLesson();
  }
});

it('opens a run paused for a word the lesson steps by hand', () => {
  try {
    startLesson(IDEA_LESSON);
    render(<App />);
    act(() => screen.getByTestId('tutorial-next').click());
    act(() => startRun('1'));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    act(() => appStore.getState().closeTrace());
    act(() => startRun('01'));
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByTestId('step-counter')).toHaveTextContent(/^Step 1 \/ /);
  } finally {
    endLesson();
  }
});
