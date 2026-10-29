import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { addState } from '../../core/edit';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import App from '../shell/App';
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

beforeEach(() => resetAppStore({ automata: [mine()] }));
afterEach(() => {
  act(() => endTutorial());
  cleanup();
});

it('is not there without a tutorial', () => {
  render(<App />);
  expect(screen.queryByTestId('tutorial-card')).toBeNull();
});

it('shows the first step with its counter and gesture', () => {
  render(<App />);
  act(() => startTutorial());
  expect(card()).toHaveAttribute('data-step', '1');
  expect(card()).toHaveAccessibleName('Tutorial');
  expect(within(card()).getByText('Tutorial · 1 of 12')).toBeInTheDocument();
  expect(within(card()).getByText(/Add a state/)).toBeInTheDocument();
  expect(within(card()).getByText('Double-click')).toBeInTheDocument();
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
  expect(within(card()).getByText('Part 1 · An even number of 0s')).toBeInTheDocument();
  act(() => tutorialStore.setState({ progress: 9, current: 9 }));
  expect(within(card()).queryByText(/Part 1/)).toBeNull();
  expect(within(card()).getByText('Part 2 · Accept every word')).toBeInTheDocument();
  const [part1, now] = within(card()).getAllByTestId('tutorial-step');
  expect(part1).toHaveTextContent('✓An even number of 0s');
  expect(now).toHaveTextContent(/Delete/);
});

it('shows words as code', () => {
  render(<App />);
  act(() => startTutorial());
  act(() => tutorialStore.setState({ progress: 7, current: 7 }));
  expect(within(card()).getByText('1010', { selector: 'code' })).toBeInTheDocument();
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
  act(() => tutorialStore.setState({ progress: 12, current: 12 }));
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
  act(() => tutorialStore.setState({ progress: 12, current: 12 }));
  await user.click(within(card()).getByRole('button', { name: 'End tutorial' }));
  expect(screen.queryByTestId('tutorial-card')).toBeNull();
  expect(app().automata.some((a) => a.id === id)).toBe(true);
});

it('the closing card has Finish, which ends it', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startTutorial());
  act(() => tutorialStore.setState({ progress: 12, current: 12 }));
  expect(card()).toHaveAttribute('data-step', '13');
  expect(within(card()).getByText('Tutorial · Done')).toBeInTheDocument();
  await user.click(within(card()).getByRole('button', { name: 'Finish' }));
  expect(screen.queryByTestId('tutorial-card')).toBeNull();
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
