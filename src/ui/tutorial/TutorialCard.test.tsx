import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addState, renameState } from '../../core/edit';
import { fixture } from '../../core/testing/fixtures';
import { runWord } from '../../core/run';
import { subsetConstruction } from '../../core/subset';
import { appStore, resetAppStore } from '../../store/store';
import { startRun } from '../../store/traceActions';
import App from '../shell/App';
import { CHEERS } from './cheers';
import { lessonSteps } from './engine';
import type { Lesson } from './engine';
import { FinishedCard } from './FinishedCard';
import { BASICS } from './lessons/basics';
import { LESSONS } from './lessons';
import { CONVERT_LESSON } from './lessons/convert';
import { NFA_LESSON } from './lessons/nfa';
import { SHARE_LESSON } from './lessons/share';
import { LESSONS_DONE_KEY, markLessonFinished } from './lessonsDone';
import { IDEA_LESSON, TEST_LESSON } from './testing/testLesson';
import {
  endLesson,
  finishLesson,
  noteLessonAction,
  pressNext,
  startLesson,
  tutorialContext,
  tutorialStore,
} from './tutorialStore';

const card = () => screen.getByTestId('tutorial-card');
const app = () => appStore.getState();
const addAt = (x: number) => act(() => app().edit((a) => addState(a, { x, y: 0 })));
/** Name the first state, as the step after adding it asks. */
const nameFirst = (label: string) =>
  act(() => app().edit((a) => renameState(a, a.states[0]!.id, label)));

const mine = () =>
  fixture({
    kind: 'DFA',
    alphabet: 'a',
    states: ['q0'],
    start: 'q0',
    accepting: ['q0'],
    edges: [['q0', 'a', 'q0']],
    name: 'Mine',
  });

/** The finished part 1: an even number of zeros, its states named as the steps ask. */
const evenZeros = () =>
  fixture({
    kind: 'DFA',
    alphabet: '01',
    states: ['even', 'odd'],
    start: 'even',
    accepting: ['even'],
    edges: [
      ['even', '0', 'odd'],
      ['odd', '0', 'even'],
      ['even', '1', 'even'],
      ['odd', '1', 'odd'],
    ],
  });

const idx = (id: string) => lessonSteps(BASICS).findIndex((s) => s.id === id);
/** Show the card at step `id`, as if reached. */
const at = (id: string) =>
  act(() => tutorialStore.setState({ progress: idx(id), current: idx(id) }));

beforeEach(() => resetAppStore({ automata: [mine()] }));
afterEach(() => {
  act(() => endLesson());
  cleanup();
  vi.restoreAllMocks();
  localStorage.removeItem(LESSONS_DONE_KEY);
});

it('is not there without a tutorial', () => {
  render(<App />);
  expect(screen.queryByTestId('tutorial-card')).toBeNull();
});

it('shows the first step with its counter', () => {
  render(<App />);
  act(() => startLesson('basics'));
  expect(card()).toHaveAttribute('data-step', '1');
  expect(card()).toHaveAccessibleName('Tutorial');
  expect(within(card()).getByText('Part 1 of 2 · Step 1 of 11')).toBeInTheDocument();
  expect(within(card()).getByTestId('tutorial-instruction')).toHaveTextContent(
    'Double-click the canvas to add a state.',
  );
});

it('shows the goal: a picture, a few words, and words it accepts and rejects', () => {
  render(<App />);
  act(() => startLesson('basics'));
  const goal = within(card()).getByTestId('tutorial-goal');
  expect(goal).toHaveTextContent('Part 1 goal: Accept the words with an even number of zeros');
  const examples = within(goal).getByRole('list', { name: 'For example' });
  expect(
    within(examples)
      .getAllByRole('listitem')
      .map((li) => li.textContent),
  ).toEqual(['1010✓', '11✓', '10✗', '000✗']);
  expect(within(examples).getAllByRole('img', { name: 'rejected' })).toHaveLength(2);
  expect(within(goal).getByRole('img', { name: /^The goal: two states, even/ })).toBe(
    within(goal).getByTestId('tutorial-goal-picture'),
  );
  // Its own picture: none of the canvas's test ids, which the user's states carry.
  expect(within(goal).queryByTestId('diagram')).toBeNull();
  expect(goal.querySelector('[data-testid^="state-"]')).toBeNull();
  // The goal stays while the steps go by, and changes with the part.
  at('loop-q1');
  expect(within(card()).getByTestId('tutorial-goal')).toHaveTextContent('even number of zeros');
  at('delete-q1');
  expect(within(card()).getByTestId('tutorial-goal')).toHaveTextContent(
    'Part 2 goal: Accept every word',
  );
  expect(within(card()).getByText('Part 2 of 2 · Step 1 of 4')).toBeInTheDocument();
  at('done');
  expect(within(card()).queryByTestId('tutorial-goal')).toBeNull();
});

it('shows one step at a time, with a few words of why, and fills a progress bar', () => {
  render(<App />);
  act(() => startLesson('basics'));
  const bar = within(card()).getByRole('progressbar', { name: 'Tutorial progress' });
  expect(bar).toHaveAttribute('aria-valuenow', '0');
  expect(bar).toHaveAttribute('aria-valuemax', '15');
  expect(bar.children).toHaveLength(15);
  expect(within(card()).queryByTestId('tutorial-why')).toBeNull();
  addAt(100);
  expect(card()).toHaveAttribute('data-step', '2');
  expect(within(card()).getAllByTestId('tutorial-step')).toHaveLength(1);
  expect(within(card()).getByTestId('tutorial-instruction')).toHaveTextContent(
    'Double-click q0 and rename it even.',
  );
  // The label keeps its subscript.
  expect(within(card()).getByTestId('tutorial-instruction').querySelector('sub')).toHaveTextContent(
    '0',
  );
  expect(within(card()).getByTestId('tutorial-why')).toHaveTextContent(
    'It will mean: an even number of zeros so far.',
  );
  const filled = within(card()).getByRole('progressbar');
  expect(filled).toHaveAttribute('aria-valuenow', '1');
  expect(filled.querySelectorAll('[data-done="true"]')).toHaveLength(1);
});

it('shows states named in a step as small states, with their punctuation kept on the line', () => {
  render(<App />);
  act(() => startLesson('basics'));
  const id = tutorialStore.getState().automatonId!;
  act(() => app().edit(() => ({ ...evenZeros(), id, name: 'Tutorial' })));
  at('q0-q1');
  const chips = [...card().querySelectorAll('.av-tutorial-now .av-tutorial-state')];
  expect(chips.map((c) => c.textContent)).toEqual(['even', 'odd']);
  const enter = [...card().querySelectorAll('.av-tutorial-now kbd')].at(-1)!;
  expect(enter.parentElement).toHaveClass('av-tutorial-nowrap');
  expect(enter.parentElement).toHaveTextContent(/^Enter\.$/);
});

it('shows keys inline as <kbd>, a digit key in the symbol font', () => {
  render(<App />);
  act(() => startLesson('basics'));
  at('q0-q1');
  const kbds = [...card().querySelectorAll('.av-tutorial-now kbd')];
  expect(kbds.map((k) => k.textContent)).toEqual(['Shift', '0', 'Enter']);
  expect(kbds.map((k) => k.hasAttribute('data-symbol'))).toEqual([false, true, false]);
  expect(within(card()).getByTestId('tutorial-why')).toContainHTML('<code>0</code>');
});

it('shows words as code', () => {
  render(<App />);
  act(() => startLesson('basics'));
  at('run-1010');
  expect(
    within(within(card()).getByTestId('tutorial-instruction')).getByText('1010', {
      selector: 'code',
    }),
  ).toBeInTheDocument();
});

it('asks to leave a run before an editing step first, in plain ink, not as a mistake', () => {
  render(<App />);
  act(() => startLesson('basics'));
  addAt(100);
  const id = app().activeId!;
  act(() => app().edit((a) => ({ ...a, starts: [a.states[0]!.id] })));
  at('delete-q1');
  act(() => startRun(''));
  const first = within(card()).getByTestId('tutorial-first');
  expect(first).toHaveTextContent('First, press Esc to get back to editing.');
  expect(first.querySelector('kbd')).toHaveTextContent('Esc');
  expect(card().querySelector('.av-tutorial-hint')).toBeNull();
  expect(app().trace?.source.id).toBe(id);
});

it('says a part is done while the run that ended it is open, until Esc closes it', () => {
  render(<App />);
  act(() => startLesson('basics'));
  const id = tutorialStore.getState().automatonId!;
  act(() => app().edit(() => ({ ...evenZeros(), id, name: 'Tutorial' })));
  act(() =>
    tutorialStore.setState({
      progress: idx('run-10'),
      current: idx('run-10'),
      latched: new Set(['run-1010']),
    }),
  );
  act(() => startRun('10'));
  act(() => app().setStep(app().trace!.steps.length - 1));
  expect(card()).toHaveAttribute('data-step', String(idx('delete-q1') + 1));
  // Part 1 is done, said in green, with what part 2 is; the goal makes way for it.
  expect(within(card()).getByText('Part 1 of 2 · Complete')).toBeInTheDocument();
  const done = within(card()).getByTestId('tutorial-part-done');
  expect(done).toHaveTextContent('Part 1 complete!');
  expect(done).toHaveTextContent('Next: Part 2 · Accept every word');
  expect(within(card()).queryByTestId('tutorial-goal')).toBeNull();
  expect(within(card()).getByTestId('tutorial-instruction')).toHaveTextContent(
    'Press Esc to start part 2.',
  );
  expect(within(card()).queryByTestId('tutorial-why')).toBeNull();
  act(() => app().closeTrace());
  expect(within(card()).queryByTestId('tutorial-part-done')).toBeNull();
  expect(within(card()).getByTestId('tutorial-goal')).toHaveAttribute('data-part', '2');
  expect(within(card()).getByTestId('tutorial-goal')).toHaveTextContent('Accept every word');
  expect(within(card()).getByTestId('tutorial-instruction')).toHaveTextContent(
    'Click odd and press Delete.',
  );
});

it('tells the canvas area how far down it reaches, so a run starts below it', () => {
  render(<App />);
  const area = document.querySelector<HTMLElement>('.av-canvas-area')!;
  expect(area.style.getPropertyValue('--av-tutorial-pad')).toBe('');
  act(() => startLesson('basics'));
  expect(area.style.getPropertyValue('--av-tutorial-pad')).toMatch(/^\d+(\.\d+)?px$/);
  act(() => endLesson());
  expect(area.style.getPropertyValue('--av-tutorial-pad')).toBe('');
});

it('hides while another automaton is open, and comes back on the tutorial’s', () => {
  render(<App />);
  act(() => startLesson('basics'));
  const id = tutorialStore.getState().automatonId!;
  const area = document.querySelector<HTMLElement>('.av-canvas-area')!;
  act(() => app().setActive('Mine'));
  expect(screen.queryByTestId('tutorial-card')).toBeNull();
  expect(screen.queryByTestId('tutorial-pointer')).toBeNull();
  expect(area.style.getPropertyValue('--av-tutorial-pad')).toBe('');
  expect(tutorialStore.getState().active).toBe(true);
  act(() => app().setActive(id));
  expect(card()).toBeInTheDocument();
});

it('the close button asks first; Keep going carries on', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startLesson('basics'));
  await user.click(within(card()).getByRole('button', { name: 'End tutorial' }));
  const ask = within(card()).getByRole('group', { name: 'Quit the tutorial?' });
  expect(ask).toHaveTextContent('Tutorial will be removed from your history');
  expect(screen.queryByTestId('tutorial-pointer')).toBeNull();
  await user.click(within(ask).getByRole('button', { name: 'Keep going' }));
  expect(within(card()).queryByRole('group', { name: 'Quit the tutorial?' })).toBeNull();
  expect(card()).toHaveAttribute('data-step', '1');
});

it('the question moves focus to Keep going, which hands it back to the close button', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startLesson('basics'));
  const close = within(card()).getByRole('button', { name: 'End tutorial' });
  await user.click(close);
  expect(within(card()).getByRole('button', { name: 'Keep going' })).toHaveFocus();
  await user.click(within(card()).getByRole('button', { name: 'Keep going' }));
  expect(close).toHaveFocus();
});

it('drops the question once the tutorial is finished behind it', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startLesson('basics'));
  await user.click(within(card()).getByRole('button', { name: 'End tutorial' }));
  at('done');
  expect(within(card()).queryByRole('group', { name: 'Quit the tutorial?' })).toBeNull();
  expect(within(card()).getByRole('button', { name: 'Finish' })).toBeInTheDocument();
});

it('Quit ends it and removes its automaton from the history', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startLesson('basics'));
  const id = tutorialStore.getState().automatonId;
  await user.click(within(card()).getByRole('button', { name: 'End tutorial' }));
  await user.click(within(card()).getByRole('button', { name: 'Quit' }));
  expect(screen.queryByTestId('tutorial-card')).toBeNull();
  expect(app().automata.some((a) => a.id === id)).toBe(false);
  expect(app().activeId).toBe('Mine');
});

it('once done, the close button finishes it without asking, removing the practice automaton', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startLesson('basics'));
  const id = tutorialStore.getState().automatonId;
  at('done');
  await user.click(within(card()).getByRole('button', { name: 'End tutorial' }));
  expect(screen.queryByTestId('tutorial-card')).toBeNull();
  expect(app().automata.some((a) => a.id === id)).toBe(false);
});

it('the closing card has Finish, which ends it', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startLesson('basics'));
  at('done');
  expect(card()).toHaveAttribute('data-step', '16');
  expect(within(card()).getByText('Tutorial · Done')).toBeInTheDocument();
  await user.click(within(card()).getByRole('button', { name: 'Finish' }));
  expect(screen.queryByTestId('tutorial-card')).toBeNull();
});

it('Finish opens a congratulations popup with a joke, which closes', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startLesson('basics'));
  at('done');
  await user.click(within(card()).getByRole('button', { name: 'Finish' }));
  const popup = screen.getByRole('dialog', { name: 'Tutorial complete' });
  expect(CHEERS).toContain(within(popup).getByTestId('tutorial-cheer').textContent);
  await user.click(within(popup).getByRole('button', { name: 'Start building' }));
  expect(screen.queryByRole('dialog', { name: 'Tutorial complete' })).toBeNull();
});

it('quitting midway opens no popup', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startLesson('basics'));
  await user.click(within(card()).getByRole('button', { name: 'End tutorial' }));
  await user.click(within(card()).getByRole('button', { name: 'Quit' }));
  expect(screen.queryByRole('dialog', { name: 'Tutorial complete' })).toBeNull();
});

it('points at the state to use, outside the card', () => {
  render(<App />);
  act(() => startLesson('basics'));
  expect(screen.queryByTestId('tutorial-pointer')).toBeNull();
  addAt(100);
  const pointer = screen.getByTestId('tutorial-pointer');
  expect(card()).not.toContainElement(pointer);
  expect(pointer).toHaveAttribute('aria-hidden', 'true');
});

it('keeps keys for the canvas: S still makes the selected state the start state', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startLesson('basics'));
  addAt(100);
  nameFirst('even');
  expect(card()).toHaveAttribute('data-step', '3');
  const state = app().automata.find((a) => a.id === app().activeId)!.states[0]!;
  act(() => app().select({ states: [state.id], transitions: [] }));
  // As clicking the state would: the canvas takes focus and handles the key.
  act(() => screen.getByTestId('canvas').focus());
  await user.keyboard('s');
  expect(card()).toHaveAttribute('data-step', '4');
  await user.keyboard('a');
  expect(card()).toHaveAttribute('data-step', '5');
});

it('points at the state itself, not its start arrow', () => {
  render(<App />);
  act(() => startLesson('basics'));
  addAt(100);
  const state = app().automata.find((a) => a.id === app().activeId)!.states[0]!;
  act(() => app().edit((a) => ({ ...a, starts: [state.id] })));
  expect(screen.getByTestId('start-arrow')).toBeInTheDocument();
  const ctx = tutorialContext(app(), tutorialStore.getState().automatonId);
  const target = document.querySelector(lessonSteps(BASICS)[idx('start')]!.target(ctx)!);
  expect(screen.getByTestId('state-q_0')).toContainElement(target as HTMLElement);
});

it('announces each step from one live region that stays mounted', () => {
  render(<App />);
  act(() => startLesson('basics'));
  const live = card().querySelector('[aria-live="polite"]');
  expect(live).toHaveTextContent('Double-click the canvas to add a state.');
  addAt(100);
  expect(card().querySelector('[aria-live="polite"]')).toBe(live);
  expect(live).toHaveTextContent(/an even number of zeros so far/);
});

describe('a lesson other than Basics', () => {
  const active = () => app().automata.find((a) => a.id === app().activeId)!;

  it('uses lesson wording', async () => {
    const user = userEvent.setup();
    render(<App />);
    act(() => startLesson(TEST_LESSON));
    expect(card()).toHaveAccessibleName('Lesson');
    expect(within(card()).getByText('Test lesson · Step 1 of 3')).toBeInTheDocument();
    const goal = within(card()).getByTestId('tutorial-goal');
    expect(goal).toHaveTextContent('Goal: Turn it into a DFA');
    // No words to show: no list.
    expect(within(goal).queryByRole('list')).toBeNull();

    const own = app().activeId!;
    act(() => app().setActive('Mine'));
    expect(screen.queryByTestId('tutorial-card')).toBeNull();
    act(() => app().setActive(own));
    expect(active().name).toBe('Contains 01');

    const trace = subsetConstruction(active());
    act(() => app().openTrace(trace));
    act(() => app().addAutomaton(trace.result));
    await user.click(within(card()).getByRole('button', { name: 'End lesson' }));
    const ask = within(card()).getByRole('group', { name: 'Quit the lesson?' });
    expect(ask).toHaveTextContent(
      `Quit the lesson? Contains 01 and ${trace.result.name} will be removed from your history.`,
    );
    await user.click(within(ask).getByRole('button', { name: 'Keep going' }));

    const done = lessonSteps(TEST_LESSON).length - 1;
    act(() => tutorialStore.setState({ progress: done, current: done }));
    expect(within(card()).getByText('Test lesson · Done')).toBeInTheDocument();
  });

  it('shows the idea step with a Next button and no goal row', async () => {
    const user = userEvent.setup();
    render(<App />);
    act(() => startLesson(IDEA_LESSON));
    expect(within(card()).getByTestId('tutorial-instruction')).toHaveTextContent('An idea.');
    expect(within(card()).getByTestId('tutorial-next')).toHaveAccessibleName('Next');
    expect(within(card()).queryByTestId('tutorial-goal')).toBeNull();
    expect(within(card()).queryByTestId('tutorial-why')).toBeNull();
    await user.click(within(card()).getByTestId('tutorial-next'));
    expect(card()).toHaveAttribute('data-step', '2');
    expect(within(card()).getByTestId('tutorial-goal')).toBeInTheDocument();
    expect(within(card()).queryByTestId('tutorial-next')).toBeNull();
    // The card never keeps focus: it falls to the body, so canvas shortcuts keep working.
    expect(card().contains(document.activeElement)).toBe(false);
  });

  it('hides the whole card, Next and all, while another automaton is open', () => {
    render(<App />);
    act(() => startLesson(IDEA_LESSON));
    expect(within(card()).getByTestId('tutorial-next')).toBeInTheDocument();
    act(() => app().setActive('Mine'));
    expect(screen.queryByTestId('tutorial-card')).toBeNull();
  });

  it('leads with the explanation, then the instruction', () => {
    const part = TEST_LESSON.parts[0]!;
    const explained: Lesson = {
      ...TEST_LESSON,
      parts: [
        {
          ...part,
          steps: [
            {
              id: 'ex/one',
              explain: () => 'Because it helps.',
              instruction: () => 'Do the thing.',
              why: () => 'Not shown.',
              done: () => false,
            },
          ],
        },
      ],
    };
    render(<App />);
    act(() => startLesson(explained));
    const explain = within(card()).getByTestId('tutorial-explain');
    const instruction = within(card()).getByTestId('tutorial-instruction');
    expect(explain).toHaveTextContent('Because it helps.');
    expect(
      explain.compareDocumentPosition(instruction) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(card()).queryByTestId('tutorial-why')).toBeNull();
  });

  it('follows the run back with ←, and shows no explanation beside a hint to rerun it', () => {
    render(<App />);
    act(() => startLesson(NFA_LESSON));
    const own = app().automata.find((x) => x.id === tutorialStore.getState().automatonId)!;
    act(() => pressNext());
    act(() => app().openTrace(runWord(own, '001')));
    act(() => app().setStep(3));
    expect(tutorialStore.getState().current).toBe(5);
    expect(within(card()).getByTestId('tutorial-explain')).toBeInTheDocument();
    act(() => app().setStep(1));
    expect(tutorialStore.getState().current).toBe(3);
    expect(within(card()).getByTestId('tutorial-explain')).toHaveTextContent('follows both');
    act(() => app().closeTrace());
    expect(within(card()).getByTestId('tutorial-first')).toHaveTextContent('run 001 again');
    expect(within(card()).queryByTestId('tutorial-explain')).toBeNull();
  });

  it('marks itself as tracing while a lesson run is open', () => {
    render(<App />);
    act(() => startLesson(NFA_LESSON));
    const own = app().automata.find((x) => x.id === tutorialStore.getState().automatonId)!;
    act(() => pressNext());
    expect(card()).not.toHaveAttribute('data-tracing');
    act(() => app().openTrace(runWord(own, '001')));
    expect(card()).toHaveAttribute('data-tracing');
    act(() => app().closeTrace());
    expect(card()).not.toHaveAttribute('data-tracing');
  });

  it('never marks Basics as tracing', () => {
    render(<App />);
    act(() => startLesson('basics'));
    const own = app().automata.find((x) => x.id === tutorialStore.getState().automatonId)!;
    const one = { ...own, states: [{ id: 's', label: 's', x: 0, y: 0 }], starts: ['s'] };
    act(() => app().openTrace(runWord(one, '')));
    expect(app().trace).not.toBeNull();
    expect(card()).not.toHaveAttribute('data-tracing');
  });

  it('lets the trace below it only move down while one run stays open', () => {
    let height = 200;
    const spy = vi
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockImplementation(() => height);
    try {
      render(<App />);
      const area = document.querySelector<HTMLElement>('.av-canvas-area')!;
      const pad = () => area.style.getPropertyValue('--av-tutorial-pad');
      act(() => startLesson(NFA_LESSON));
      const own = app().automata.find((x) => x.id === tutorialStore.getState().automatonId)!;
      act(() => pressNext());
      act(() => app().openTrace(runWord(own, '001')));
      expect(pad()).toBe('204px');
      height = 150;
      act(() => app().setStep(1));
      expect(pad()).toBe('204px');
      act(() => app().closeTrace());
      expect(pad()).toBe('154px');
    } finally {
      spy.mockRestore();
    }
  });

  it('keeps room for a taller card below a short one while a lesson trace is open', () => {
    // The card fits its text (no empty space under Finish); the trace still starts where a
    // two-line explanation would end, so it doesn't move as the card grows.
    const spy = vi
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockImplementation(() => 100);
    try {
      render(<App />);
      const area = document.querySelector<HTMLElement>('.av-canvas-area')!;
      const pad = () => area.style.getPropertyValue('--av-tutorial-pad');
      act(() => startLesson(NFA_LESSON));
      expect(pad()).toBe('104px');
      const own = app().automata.find((x) => x.id === tutorialStore.getState().automatonId)!;
      act(() => pressNext());
      act(() => app().openTrace(runWord(own, '001')));
      expect(pad()).toBe('194px');
      act(() => app().closeTrace());
      expect(pad()).toBe('104px');
    } finally {
      spy.mockRestore();
    }
  });

  it('keeps Next out of the live region', () => {
    render(<App />);
    act(() => startLesson(IDEA_LESSON));
    const next = within(card()).getByTestId('tutorial-next');
    expect(within(card()).getByTestId('tutorial-step').contains(next)).toBe(false);
  });

  it('shows a goal without a picture as text and examples only', () => {
    const part = TEST_LESSON.parts[0]!;
    const plain: Lesson = {
      ...TEST_LESSON,
      parts: [
        {
          ...part,
          goal: { text: 'Turn it into a DFA', examples: [{ word: '01', accepted: true }] },
        },
      ],
    };
    render(<App />);
    act(() => startLesson(plain));
    const goal = within(card()).getByTestId('tutorial-goal');
    expect(within(goal).queryByTestId('tutorial-goal-picture')).toBeNull();
    expect(goal).toHaveTextContent('Goal: Turn it into a DFA');
    expect(goal).toHaveTextContent('01✓');
  });

  it('lifts the pointer over the top bar and frames a toolbar button tightly', async () => {
    const user = userEvent.setup();
    render(<App />);
    act(() => startLesson(CONVERT_LESSON));
    await user.click(within(card()).getByTestId('tutorial-next'));
    const button = screen.getByRole('button', { name: 'Convert to DFA' });
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 100, y: 10, width: 120, height: 28 }),
    );
    // The pointer follows its target on the next frame; wait for it.
    return vi.waitFor(() => {
      const pointer = screen.getByTestId('tutorial-pointer');
      expect(pointer).toHaveAttribute('data-over-bar');
      expect(pointer).toHaveAttribute('data-tight');
      // Nudged 2 px right: the icon's thin left end reads as extra space.
      expect(pointer.style).toMatchObject({
        left: '99px',
        top: '7px',
        width: '126px',
        height: '34px',
      });
    });
  });

  it('says the automaton is read-only after a refused edit', () => {
    render(<App />);
    act(() => startLesson(TEST_LESSON));
    expect(screen.queryByTestId('tutorial-read-only')).toBeNull();
    addAt(100);
    expect(active().states).toHaveLength(3);
    expect(within(card()).getByTestId('tutorial-read-only')).toHaveTextContent(
      'This lesson’s automaton is read-only: quit the lesson to change it.',
    );
    // The step changes: the line goes.
    act(() => app().openTrace(subsetConstruction(active())));
    expect(card()).toHaveAttribute('data-step', '2');
    expect(screen.queryByTestId('tutorial-read-only')).toBeNull();
  });

  it('hands over between parts without a text when the part has none', () => {
    const part = TEST_LESSON.parts[0]!;
    const twoParts: Lesson = {
      ...TEST_LESSON,
      parts: [
        {
          ...part,
          steps: [
            { id: 'two/run', instruction: () => 'Run `01`.', run: { word: '01', accepted: true } },
          ],
        },
        {
          ...part,
          title: 'Second',
          steps: [{ id: 'two/edit', instruction: () => 'Edit it.', done: () => false }],
        },
      ],
    };
    render(<App />);
    act(() => startLesson(twoParts));
    act(() => startRun('01'));
    act(() => app().setStep(app().trace!.steps.length - 1));
    const done = within(card()).getByTestId('tutorial-part-done');
    expect(done).toHaveTextContent('Part 1 complete!');
    expect(done).toHaveTextContent('Next: Part 2 · Second');
    expect(done.querySelector('.av-tutorial-part-done-text')).toBeNull();
  });

  it('moves on when its action is reported, with no change in the app', () => {
    const part = TEST_LESSON.parts[0]!;
    const withAction: Lesson = {
      ...TEST_LESSON,
      parts: [
        {
          ...part,
          steps: [
            { id: 'act/share', instruction: () => 'Share it.', action: ['share-link'] },
            { id: 'act/other', instruction: () => 'Edit it.', done: () => false },
          ],
        },
      ],
    };
    render(<App />);
    act(() => startLesson(withAction));
    expect(card()).toHaveAttribute('data-step', '1');
    act(() => noteLessonAction('share-link'));
    expect(card()).toHaveAttribute('data-step', '2');
  });

  it('finishes with lesson wording', () => {
    render(<FinishedCard lesson={TEST_LESSON} onClose={() => {}} />);
    const popup = screen.getByRole('dialog', { name: 'Lesson complete' });
    expect(within(popup).getByRole('heading')).toHaveTextContent('Lesson complete!');
    expect(popup).toHaveTextContent('Its automata stay in your history.');
  });

  it('offers the first unfinished lesson after Basics as Next, and starts it', async () => {
    localStorage.removeItem(LESSONS_DONE_KEY);
    const onClose = vi.fn();
    render(<FinishedCard lesson={TEST_LESSON} onClose={onClose} />);
    // Basics, skipped, is the tutorial: it is never offered as Next.
    const next = screen.getByTestId('next-lesson');
    expect(next).toHaveTextContent('Next: NFAs');
    expect(screen.getByRole('button', { name: 'Back to building' })).not.toHaveClass('av-go');
    expect(screen.queryByRole('button', { name: 'See the lessons' })).toBeNull();
    await userEvent.setup().click(next);
    expect(onClose).toHaveBeenCalled();
    expect(tutorialStore.getState().lessonId).toBe('nfa');
  });

  it('never offers the lesson just finished, even when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    render(<FinishedCard lesson={NFA_LESSON} onClose={() => {}} />);
    expect(screen.getByTestId('next-lesson')).toHaveTextContent('Next: ε-moves');
  });

  it('after the tutorial, offers Start building and See the lessons instead of starting a lesson', async () => {
    localStorage.removeItem(LESSONS_DONE_KEY);
    const onClose = vi.fn();
    const onSeeLessons = vi.fn();
    render(<FinishedCard lesson={BASICS} onClose={onClose} onSeeLessons={onSeeLessons} />);
    const popup = screen.getByRole('dialog', { name: 'Tutorial complete' });
    expect(screen.queryByTestId('next-lesson')).toBeNull();
    expect(popup).not.toHaveTextContent('history');
    expect(within(popup).queryByRole('button', { name: 'Back to building' })).toBeNull();
    const build = within(popup).getByRole('button', { name: 'Start building' });
    expect(build).toHaveClass('av-go');
    const user = userEvent.setup();
    await user.click(within(popup).getByRole('button', { name: 'See the lessons' }));
    expect(onSeeLessons).toHaveBeenCalledTimes(1);
    await user.click(build);
    expect(onClose).toHaveBeenCalled();
  });

  it('See the lessons opens the Controls on the Lessons tab', async () => {
    render(<App />);
    act(() => startLesson('basics'));
    act(() => finishLesson());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'See the lessons' }));
    expect(screen.queryByRole('dialog', { name: 'Tutorial complete' })).toBeNull();
    const guide = screen.getByRole('dialog', { name: 'Controls' });
    expect(within(guide).getByRole('tab', { name: 'Lessons' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('has no Next once every lesson is finished, and offers See the lessons', async () => {
    for (const l of LESSONS) markLessonFinished(l.id);
    const onClose = vi.fn();
    const onSeeLessons = vi.fn();
    render(<FinishedCard lesson={TEST_LESSON} onClose={onClose} onSeeLessons={onSeeLessons} />);
    expect(screen.queryByTestId('next-lesson')).toBeNull();
    expect(screen.getByRole('button', { name: 'Back to building' })).toHaveClass('av-go');
    await userEvent.setup().click(screen.getByRole('button', { name: 'See the lessons' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSeeLessons).toHaveBeenCalledTimes(1);
  });

  it('offers See the lessons, not Basics, when only Basics is left', () => {
    for (const l of LESSONS) if (l.id !== 'basics') markLessonFinished(l.id);
    render(<FinishedCard lesson={SHARE_LESSON} onClose={() => {}} onSeeLessons={() => {}} />);
    expect(screen.queryByTestId('next-lesson')).toBeNull();
    expect(screen.getByRole('button', { name: 'See the lessons' })).toBeInTheDocument();
  });
});
