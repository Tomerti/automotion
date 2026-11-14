import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { addState, renameState } from '../../core/edit';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { startRun } from '../../store/traceActions';
import App from '../shell/App';
import { CHEERS } from './cheers';
import { STEPS } from './steps';
import { endTutorial, startTutorial, tutorialContext, tutorialStore } from './tutorialStore';

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

const idx = (id: string) => STEPS.findIndex((s) => s.id === id);
/** Show the card at step `id`, as if reached. */
const at = (id: string) =>
  act(() => tutorialStore.setState({ progress: idx(id), current: idx(id) }));

beforeEach(() => resetAppStore({ automata: [mine()] }));
afterEach(() => {
  act(() => endTutorial());
  cleanup();
});

it('is not there without a tutorial', () => {
  render(<App />);
  expect(screen.queryByTestId('tutorial-card')).toBeNull();
});

it('shows the first step with its counter', () => {
  render(<App />);
  act(() => startTutorial());
  expect(card()).toHaveAttribute('data-step', '1');
  expect(card()).toHaveAccessibleName('Tutorial');
  expect(within(card()).getByText('Part 1 of 2 · Step 1 of 11')).toBeInTheDocument();
  expect(within(card()).getByTestId('tutorial-instruction')).toHaveTextContent(
    'Double-click the canvas to add a state.',
  );
});

it('shows the goal: a picture, a few words, and words it accepts and rejects', () => {
  render(<App />);
  act(() => startTutorial());
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
  act(() => startTutorial());
  const bar = within(card()).getByRole('progressbar', { name: 'Tutorial progress' });
  expect(bar).toHaveAttribute('aria-valuenow', '0');
  expect(bar).toHaveAttribute('aria-valuemax', '19');
  expect(bar.children).toHaveLength(19);
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
  act(() => startTutorial());
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
  act(() => startTutorial());
  at('q0-q1');
  const kbds = [...card().querySelectorAll('.av-tutorial-now kbd')];
  expect(kbds.map((k) => k.textContent)).toEqual(['Shift', '0', 'Enter']);
  expect(kbds.map((k) => k.hasAttribute('data-symbol'))).toEqual([false, true, false]);
  expect(within(card()).getByTestId('tutorial-why')).toContainHTML('<code>0</code>');
});

it('shows words as code', () => {
  render(<App />);
  act(() => startTutorial());
  at('run-1010');
  expect(
    within(within(card()).getByTestId('tutorial-instruction')).getByText('1010', {
      selector: 'code',
    }),
  ).toBeInTheDocument();
});

it('asks to leave a run before an editing step first, in plain ink, not as a mistake', () => {
  render(<App />);
  act(() => startTutorial());
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
  act(() => startTutorial());
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
  act(() => startTutorial());
  expect(area.style.getPropertyValue('--av-tutorial-pad')).toMatch(/^\d+(\.\d+)?px$/);
  act(() => endTutorial());
  expect(area.style.getPropertyValue('--av-tutorial-pad')).toBe('');
});

it('says when another automaton is open and goes back to the tutorial', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startTutorial());
  const id = tutorialStore.getState().automatonId;
  act(() => app().setActive('Mine'));
  expect(within(card()).getByText(/You’re on/)).toHaveTextContent('You’re on Mine.');
  await user.click(within(card()).getByRole('button', { name: 'Back to Tutorial' }));
  expect(app().activeId).toBe(id);
});

it('the close button asks first; Keep going carries on', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startTutorial());
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
  act(() => startTutorial());
  const close = within(card()).getByRole('button', { name: 'End tutorial' });
  await user.click(close);
  expect(within(card()).getByRole('button', { name: 'Keep going' })).toHaveFocus();
  await user.click(within(card()).getByRole('button', { name: 'Keep going' }));
  expect(close).toHaveFocus();
});

it('drops the question once the tutorial is finished behind it', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startTutorial());
  await user.click(within(card()).getByRole('button', { name: 'End tutorial' }));
  at('done');
  expect(within(card()).queryByRole('group', { name: 'Quit the tutorial?' })).toBeNull();
  expect(within(card()).getByRole('button', { name: 'Finish' })).toBeInTheDocument();
});

it('Quit ends it and removes its automaton from the history', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startTutorial());
  const id = tutorialStore.getState().automatonId;
  await user.click(within(card()).getByRole('button', { name: 'End tutorial' }));
  await user.click(within(card()).getByRole('button', { name: 'Quit' }));
  expect(screen.queryByTestId('tutorial-card')).toBeNull();
  expect(app().automata.some((a) => a.id === id)).toBe(false);
  expect(app().activeId).toBe('Mine');
});

it('once done, the close button ends it without asking and keeps the automaton', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startTutorial());
  const id = tutorialStore.getState().automatonId;
  at('done');
  await user.click(within(card()).getByRole('button', { name: 'End tutorial' }));
  expect(screen.queryByTestId('tutorial-card')).toBeNull();
  expect(app().automata.some((a) => a.id === id)).toBe(true);
});

it('the closing card has Finish, which ends it', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startTutorial());
  at('done');
  expect(card()).toHaveAttribute('data-step', '20');
  expect(within(card()).getByText('Tutorial · Done')).toBeInTheDocument();
  await user.click(within(card()).getByRole('button', { name: 'Finish' }));
  expect(screen.queryByTestId('tutorial-card')).toBeNull();
});

it('Finish opens a congratulations popup with a joke, which closes', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startTutorial());
  at('done');
  await user.click(within(card()).getByRole('button', { name: 'Finish' }));
  const popup = screen.getByRole('dialog', { name: 'Tutorial complete' });
  expect(CHEERS).toContain(within(popup).getByTestId('tutorial-cheer').textContent);
  await user.click(within(popup).getByRole('button', { name: 'Back to building' }));
  expect(screen.queryByRole('dialog', { name: 'Tutorial complete' })).toBeNull();
});

it('quitting midway opens no popup', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startTutorial());
  await user.click(within(card()).getByRole('button', { name: 'End tutorial' }));
  await user.click(within(card()).getByRole('button', { name: 'Quit' }));
  expect(screen.queryByRole('dialog', { name: 'Tutorial complete' })).toBeNull();
});

it('points at the state to use, outside the card', () => {
  render(<App />);
  act(() => startTutorial());
  expect(screen.queryByTestId('tutorial-pointer')).toBeNull();
  addAt(100);
  const pointer = screen.getByTestId('tutorial-pointer');
  expect(card()).not.toContainElement(pointer);
  expect(pointer).toHaveAttribute('aria-hidden', 'true');
});

it('keeps keys for the canvas: S still makes the selected state the start state', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startTutorial());
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
  act(() => startTutorial());
  addAt(100);
  const state = app().automata.find((a) => a.id === app().activeId)!.states[0]!;
  act(() => app().edit((a) => ({ ...a, starts: [state.id] })));
  expect(screen.getByTestId('start-arrow')).toBeInTheDocument();
  const ctx = tutorialContext(app(), tutorialStore.getState().automatonId);
  const target = document.querySelector(STEPS[idx('start')]!.target(ctx)!);
  expect(screen.getByTestId('state-q_0')).toContainElement(target as HTMLElement);
});

it('announces each step from one live region that stays mounted', () => {
  render(<App />);
  act(() => startTutorial());
  const live = card().querySelector('[aria-live="polite"]');
  expect(live).toHaveTextContent('Double-click the canvas to add a state.');
  addAt(100);
  expect(card().querySelector('[aria-live="polite"]')).toBe(live);
  expect(live).toHaveTextContent(/an even number of zeros so far/);
});
