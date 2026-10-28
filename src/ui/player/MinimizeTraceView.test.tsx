import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { minimize } from '../../core/minimize';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { startMinimize } from '../../store/traceActions';
import App from '../shell/App';
import { MinimizeTraceView } from './MinimizeTraceView';

const redundant = fixture({
  kind: 'DFA',
  alphabet: 'a',
  states: ['q0', 'q1', 'q2'],
  start: 'q0',
  accepting: ['q1', 'q2'],
  edges: [
    ['q0', 'a', 'q1'],
    ['q1', 'a', 'q2'],
    ['q2', 'a', 'q1'],
  ],
  name: 'D',
});
const withUnreachable = fixture({
  kind: 'DFA',
  alphabet: 'ab',
  states: ['q0', 'q1', 'q2', 'q3'],
  start: 'q0',
  accepting: ['q1'],
  edges: [
    ['q0', 'a', 'q1'],
    ['q1', 'b', 'q0'],
    ['q3', 'a', 'q0'],
  ],
  name: 'pu',
});

beforeEach(() => resetAppStore());
afterEach(cleanup);

describe('MinimizeTraceView', () => {
  it('tints states by block', () => {
    const trace = minimize(redundant);
    const i = trace.steps.findIndex((s) => s.phase === 'partition');
    render(<MinimizeTraceView trace={trace} stepIndex={i} />);
    const blocks = trace.steps[i]!.blocks;
    blocks.forEach((b, bi) => {
      for (const id of b) {
        expect(screen.getByTestId(`state-${id}`)).toHaveAttribute('data-tint', String(bi % 8));
      }
    });
  });

  it('tints the done step result to match the legend (result state i ↔ block i)', () => {
    const trace = minimize(redundant);
    const i = trace.steps.length - 1;
    expect(trace.steps[i]?.phase).toBe('done');
    render(<MinimizeTraceView trace={trace} stepIndex={i} />);
    const legend = within(screen.getByTestId('block-legend')).getAllByRole('listitem');
    trace.result.states.forEach((s, bi) => {
      expect(screen.getByTestId(`state-${s.label}`)).toHaveAttribute('data-tint', String(bi % 8));
      const swatch = legend[bi]?.querySelector('[data-tint]');
      expect(swatch).toHaveAttribute('data-tint', String(bi % 8));
    });
  });

  it('fades removed states on the trim step', () => {
    const trace = minimize(withUnreachable);
    const i = trace.steps.findIndex((s) => s.phase === 'trim');
    expect(i).toBeGreaterThanOrEqual(0);
    render(<MinimizeTraceView trace={trace} stepIndex={i} />);
    for (const id of trace.steps[i]!.removed ?? []) {
      expect(screen.getByTestId(`state-${id}`)).toHaveAttribute('data-faded', 'true');
    }
    expect(screen.queryByTestId('block-legend')?.children.length ?? 0).toBe(0);
  });

  it('shows the block legend', () => {
    const trace = minimize(redundant);
    const i = trace.steps.findIndex((s) => s.phase === 'partition');
    render(<MinimizeTraceView trace={trace} stepIndex={i} />);
    const items = within(screen.getByTestId('block-legend')).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent(/^A: {q1, q2}$/);
    expect(items.length).toBe(trace.steps[i]!.blocks.length);
  });

  it('done step shows the minimized automaton and Save adds "D (min)"', async () => {
    resetAppStore({ automata: [redundant], activeId: redundant.id });
    startMinimize();
    const trace = appStore.getState().trace;
    expect(trace?.kind).toBe('minimize');
    appStore.getState().setStep(trace!.steps.length - 1);
    render(<App />);
    expect(screen.queryByTestId('state-q2')).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save as new automaton' }));
    const s = appStore.getState();
    expect(s.automata.map((a) => a.name)).toContain('D (min)');
    expect(s.trace).toBeNull();
  });

  it('an already minimal DFA shows a note instead of Save', () => {
    const minimal = { ...minimize(redundant).result, id: 'm' };
    resetAppStore({ automata: [minimal], activeId: 'm' });
    startMinimize();
    const trace = appStore.getState().trace;
    appStore.getState().setStep(trace!.steps.length - 1);
    render(<App />);
    expect(screen.getByTestId('already-minimal')).toHaveTextContent('Already minimal');
    expect(screen.queryByRole('button', { name: 'Save as new automaton' })).toBeNull();
  });

  it('startMinimize is a no-op when not minimizable', () => {
    startMinimize();
    expect(appStore.getState().trace).toBeNull();
  });
});
