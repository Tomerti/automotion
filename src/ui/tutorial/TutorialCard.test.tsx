import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { addState } from '../../core/edit';
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

/** The finished part 1: an even number of zeros. */
const evenZeros = () =>
  fixture({
    kind: 'DFA',
    alphabet: '01',
    states: ['q_0', 'q_1'],
    start: 'q_0',
    accepting: ['q_0'],
    edges: [
      ['q_0', '0', 'q_1'],
      ['q_1', '0', 'q_0'],
      ['q_0', '1', 'q_0'],
      ['q_1', '1', 'q_1'],
    ],
  });

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
  expect(within(card()).getByText('Tutorial · 1 of 13')).toBeInTheDocument();
  expect(within(card()).getByText(/Add a state: double-click/)).toBeInTheDocument();
});

it('shows keys inline as <kbd>, a digit key in the symbol font', () => {
  render(<App />);
  act(() => startTutorial());
  act(() => tutorialStore.setState({ progress: 4, current: 4 }));
  const kbds = [...card().querySelectorAll('.av-tutorial-now kbd')];
  expect(kbds.map((k) => k.textContent)).toEqual(['Shift', '0', 'Enter']);
  expect(kbds.map((k) => k.hasAttribute('data-symbol'))).toEqual([false, true, false]);
  expect(within(card()).getByText('0', { selector: 'code' })).toBeInTheDocument();
});

it('ticks off each step done and shows the next one on a new line, with subscripts', () => {
  render(<App />);
  act(() => startTutorial());
  expect(within(card()).getAllByTestId('tutorial-step')).toHaveLength(1);
  addAt(100);
  expect(card()).toHaveAttribute('data-step', '2');
  const [done, now] = within(card()).getAllByTestId('tutorial-step');
  expect(done).toHaveAttribute('data-done', 'true');
  expect(done).toHaveTextContent('✓Added q0');
  expect(done!.querySelector('sub')).toHaveTextContent('0');
  expect(now).toHaveAttribute('data-done', 'false');
  expect(now).toHaveTextContent(/start state/);
});

it('heads the list with the part, and folds a finished part into one ticked line', () => {
  render(<App />);
  act(() => startTutorial());
  expect(within(card()).getByText('Part 1 · An even number of zeros')).toBeInTheDocument();
  act(() => tutorialStore.setState({ progress: 9, current: 9 }));
  expect(within(card()).queryByText(/Part 1/)).toBeNull();
  expect(within(card()).getByText('Part 2 · Accept every word')).toBeInTheDocument();
  const [part1, now] = within(card()).getAllByTestId('tutorial-step');
  expect(part1).toHaveTextContent('✓An even number of zeros');
  expect(now).toHaveTextContent(/Delete/);
});

it('shows words as code', () => {
  render(<App />);
  act(() => startTutorial());
  act(() => tutorialStore.setState({ progress: 7, current: 7 }));
  expect(within(card()).getByText('1010', { selector: 'code' })).toBeInTheDocument();
});

it('asks to leave a run before an editing step first, in plain ink, not as a mistake', () => {
  render(<App />);
  act(() => startTutorial());
  addAt(100);
  const id = app().activeId!;
  act(() => app().edit((a) => ({ ...a, starts: [a.states[0]!.id] })));
  act(() => tutorialStore.setState({ progress: 9, current: 9 }));
  act(() => startRun(''));
  const first = within(card()).getByTestId('tutorial-first');
  expect(first).toHaveTextContent('First, press Esc to get back to editing.');
  expect(first.querySelector('kbd')).toHaveTextContent('Esc');
  expect(card().querySelector('.av-tutorial-hint')).toBeNull();
  expect(app().trace?.source.id).toBe(id);
});

it('keeps part 1 on show, its last ✓ included, until Esc closes the run that ended it', () => {
  render(<App />);
  act(() => startTutorial());
  const id = tutorialStore.getState().automatonId!;
  act(() => app().edit(() => ({ ...evenZeros(), id, name: 'Tutorial' })));
  act(() => tutorialStore.setState({ progress: 8, current: 8, latched: new Set(['run-1010']) }));
  act(() => startRun('10'));
  act(() => app().setStep(app().trace!.steps.length - 1));
  expect(card()).toHaveAttribute('data-step', '10');
  expect(within(card()).getByText('Part 1 · An even number of zeros')).toBeInTheDocument();
  expect(card()).toHaveTextContent('✓10 is rejected, as it should be');
  expect(card()).toHaveTextContent(
    'Part 1 done! Press Esc to get back to editing and start Part 2.',
  );
  act(() => app().closeTrace());
  expect(within(card()).getByText('Part 2 · Accept every word')).toBeInTheDocument();
  expect(card()).toHaveTextContent(/Delete q1/);
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
  act(() => tutorialStore.setState({ progress: 13, current: 13 }));
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
  act(() => tutorialStore.setState({ progress: 13, current: 13 }));
  await user.click(within(card()).getByRole('button', { name: 'End tutorial' }));
  expect(screen.queryByTestId('tutorial-card')).toBeNull();
  expect(app().automata.some((a) => a.id === id)).toBe(true);
});

it('the closing card has Finish, which ends it', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startTutorial());
  act(() => tutorialStore.setState({ progress: 13, current: 13 }));
  expect(card()).toHaveAttribute('data-step', '14');
  expect(within(card()).getByText('Tutorial · Done')).toBeInTheDocument();
  await user.click(within(card()).getByRole('button', { name: 'Finish' }));
  expect(screen.queryByTestId('tutorial-card')).toBeNull();
});

it('Finish opens a congratulations popup with a joke, which closes', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startTutorial());
  act(() => tutorialStore.setState({ progress: 13, current: 13 }));
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
  const state = app().automata.find((a) => a.id === app().activeId)!.states[0]!;
  act(() => app().select({ states: [state.id], transitions: [] }));
  // As clicking the state would: the canvas takes focus and handles the key.
  act(() => screen.getByTestId('canvas').focus());
  await user.keyboard('s');
  expect(card()).toHaveAttribute('data-step', '3');
});

it('points at the state itself, not its start arrow', () => {
  render(<App />);
  act(() => startTutorial());
  addAt(100);
  const state = app().automata.find((a) => a.id === app().activeId)!.states[0]!;
  act(() => app().edit((a) => ({ ...a, starts: [state.id] })));
  expect(screen.getByTestId('start-arrow')).toBeInTheDocument();
  const ctx = tutorialContext(app(), tutorialStore.getState().automatonId);
  const target = document.querySelector(STEPS[2]!.target(ctx)!);
  expect(screen.getByTestId('state-q_0')).toContainElement(target as HTMLElement);
});

it('announces each step from one live region that stays mounted', () => {
  render(<App />);
  act(() => startTutorial());
  const live = card().querySelector('[aria-live="polite"]');
  expect(live).toHaveTextContent('Add a state');
  addAt(100);
  expect(card().querySelector('[aria-live="polite"]')).toBe(live);
  expect(live).toHaveTextContent(/start state/);
  expect(live).toHaveTextContent('✓Added q0');
});
