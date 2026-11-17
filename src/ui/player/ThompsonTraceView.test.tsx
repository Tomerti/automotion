import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { thompson } from '../../core/thompson';
import { appStore, resetAppStore } from '../../store/store';
import App from '../shell/App';
import { CONVERT_LESSON } from '../tutorial/lessons/convert';
import { endLesson, startLesson } from '../tutorial/tutorialStore';
import { TraceExtraActions } from './traceExtraActions';

beforeEach(() => resetAppStore());
afterEach(() => {
  endLesson();
  cleanup();
});

function open(regex: string, stepIndex: number): void {
  appStore.getState().openTrace(thompson(regex));
  appStore.getState().setStep(stepIndex);
  render(<App />);
}

/** Index of the build step whose node is the text `node`. */
function buildStepOf(regex: string, node: string): number {
  const trace = thompson(regex);
  return trace.steps.findIndex(
    (s) => s.phase === 'build' && s.span && trace.regex.slice(s.span.start, s.span.end) === node,
  );
}

describe('ThompsonTraceView', () => {
  it('shows the regex with the current node highlighted', () => {
    const i = buildStepOf('a|b', 'b');
    expect(i).toBeGreaterThan(0);
    open('a|b', i);
    expect(screen.getByTestId('regex-current')).toHaveTextContent('b');
  });

  it('reveals only the states built so far, and marks the piece start and accept', () => {
    open('a|b', buildStepOf('a|b', 'a'));
    expect(screen.getAllByTestId(/^state-/)).toHaveLength(2);
    expect(screen.getByTestId('state-q_0')).toHaveAttribute('data-start', 'true');
    expect(screen.getByTestId('state-q_1')).toHaveAttribute('data-accepting', 'true');
  });

  it('draws a frame around the current piece on build steps, not on intro', () => {
    open('a|b', 0);
    expect(screen.queryByTestId('piece-frame')).toBeNull();
    act(() => appStore.getState().setStep(buildStepOf('a|b', 'a')));
    expect(screen.getByTestId('piece-frame')).toBeInTheDocument();
  });

  it('last step offers Save as new automaton and Save and convert to DFA', async () => {
    const user = userEvent.setup();
    open('a|b', thompson('a|b').steps.length - 1);
    expect(screen.getByTestId('save-trace-result')).toBeInTheDocument();
    await user.click(screen.getByTestId('save-and-convert'));
    expect(appStore.getState().automata.map((a) => a.name)).toContain('a|b');
    await vi.waitFor(() => expect(appStore.getState().trace?.kind).toBe('subset'));
  });

  it('no Save and convert to DFA in a lesson', () => {
    startLesson(CONVERT_LESSON);
    const trace = thompson('a|b');
    render(<TraceExtraActions trace={trace} stepIndex={trace.steps.length - 1} />);
    expect(screen.getByTestId('save-trace-result')).toBeInTheDocument();
    expect(screen.queryByTestId('save-and-convert')).toBeNull();
  });
});
