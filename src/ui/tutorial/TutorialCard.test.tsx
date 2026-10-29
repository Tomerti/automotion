import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { addState } from '../../core/edit';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import App from '../shell/App';
import { endTutorial, startTutorial, tutorialStore } from './tutorialStore';

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

it('moves on when the step is done and confirms it, with subscripts', () => {
  render(<App />);
  act(() => startTutorial());
  addAt(100);
  expect(card()).toHaveAttribute('data-step', '2');
  const done = within(card()).getByTestId('tutorial-confirmation');
  expect(done).toHaveTextContent('✓ Added q0');
  expect(done.querySelector('sub')).toHaveTextContent('0');
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

it('the close button ends it and keeps the automaton', async () => {
  const user = userEvent.setup();
  render(<App />);
  act(() => startTutorial());
  const id = tutorialStore.getState().automatonId;
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
