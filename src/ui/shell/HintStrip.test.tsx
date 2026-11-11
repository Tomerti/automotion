import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { tutorialStore } from '../tutorial/tutorialStore';
import { HintStrip } from './HintStrip';
import { reloadLearned } from './hintsLearned';

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
});

const strip = (): HTMLElement => screen.getByTestId('hint-strip');

beforeEach(() => {
  window.localStorage.clear();
  reloadLearned();
  resetAppStore({ automata: [parity], activeId: parity.id });
});
afterEach(() => {
  cleanup();
  tutorialStore.setState({ active: false });
});

describe('HintStrip', () => {
  it('follows the selection', () => {
    render(<HintStrip />);
    expect(strip()).toHaveAttribute('data-hint', 'minimize');
    act(() => appStore.getState().select({ states: ['q0'], transitions: [] }));
    expect(strip()).toHaveAttribute('data-hint', 'one-selected');
    expect(strip()).toHaveTextContent('Sstart state');
    act(() => appStore.getState().select({ states: ['q0', 'q1'], transitions: [] }));
    expect(strip()).toHaveAttribute('data-hint', 'many-selected');
  });

  it('opens the suggested walkthrough from its button', async () => {
    const user = userEvent.setup();
    render(<HintStrip />);
    await user.click(within(strip()).getByRole('button', { name: 'Minimize' }));
    expect(appStore.getState().trace?.kind).toBe('minimize');
  });

  it('× hides the tip for good', async () => {
    const user = userEvent.setup();
    render(<HintStrip />);
    await user.click(screen.getByRole('button', { name: 'Hide this tip' }));
    expect(screen.queryByTestId('hint-strip')).toBeNull();
    cleanup();
    reloadLearned();
    render(<HintStrip />);
    expect(screen.queryByTestId('hint-strip')).toBeNull();
  });

  it('stays out of the way during the tutorial, which has its own card', () => {
    tutorialStore.setState({ active: true });
    render(<HintStrip />);
    expect(screen.queryByTestId('hint-strip')).toBeNull();
  });
});
