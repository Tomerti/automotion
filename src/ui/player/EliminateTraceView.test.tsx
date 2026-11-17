import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eliminate, GNFA_START } from '../../core/eliminate';
import type { EliminateTrace } from '../../core/trace';
import { appStore, resetAppStore } from '../../store/store';
import { endsAb } from '../../store/testing/fixtures';
import App from '../shell/App';
import { toastStore } from '../shell/toastStore';
import { EliminateTraceView, shortLabel } from './EliminateTraceView';
import { usePlaying } from './playingStore';

beforeEach(() => {
  resetAppStore({ automata: [endsAb], activeId: endsAb.id });
  toastStore.setState({ toasts: [] });
  usePlaying.setState({ playing: false });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Open To regex on endsAb (states q0, q1, q2) at `stepIndex` and render the app. */
function open(stepIndex: number): EliminateTrace {
  const trace = eliminate(endsAb);
  appStore.getState().openTrace(trace);
  appStore.getState().setStep(stepIndex);
  render(<App />);
  return trace;
}

const current = (): EliminateTrace => {
  const t = appStore.getState().trace;
  if (t?.kind !== 'eliminate') throw new Error('expected an eliminate trace');
  return t;
};

const edge = (id: string): Element => {
  const el = document.querySelector(`[data-transition-id="${id}"]`);
  if (!el) throw new Error(`no edge ${id}`);
  return el;
};

describe('EliminateTraceView', () => {
  it('highlights the state being removed and its arrows on a pick step', () => {
    const trace = open(1);
    const step = trace.steps[1]!;
    const q = step.removing!;
    expect(screen.getByTestId(`state-${q}`)).toHaveAttribute('data-active', 'true');
    for (const s of step.automaton.states.filter((s) => s.id !== q)) {
      expect(screen.getByTestId(`state-${s.label}`)).toHaveAttribute('data-active', 'false');
    }
    for (const t of step.automaton.transitions) {
      const incident = t.from === q || t.to === q;
      expect(edge(t.id)).toHaveAttribute('data-taken', String(incident));
    }
  });

  it('highlights the new or changed arrows on a remove step', () => {
    const trace = open(2);
    const step = trace.steps[2]!;
    expect(step.phase).toBe('remove');
    expect(step.changed!.length).toBeGreaterThan(0);
    for (const t of step.automaton.transitions) {
      expect(edge(t.id)).toHaveAttribute('data-taken', String(step.changed!.includes(t.id)));
    }
  });

  it('long labels are cut short with … and keep the full text as a tooltip', () => {
    expect(shortLabel('x'.repeat(41))).toBe('x'.repeat(39) + '…');
    expect(shortLabel('x'.repeat(40))).toBe('x'.repeat(40));
    // Code points, not UTF-16 units: an emoji is one character.
    expect(shortLabel('😀'.repeat(41))).toBe('😀'.repeat(39) + '…');

    const trace = eliminate(endsAb);
    const first = trace.steps[0]!;
    const long = 'ab'.repeat(25);
    const [cut, ...rest] = first.automaton.transitions;
    const step = {
      ...first,
      automaton: {
        ...first.automaton,
        transitions: [{ ...cut!, symbols: [long] }, ...rest],
      },
    };
    render(<EliminateTraceView trace={{ ...trace, steps: [step] }} stepIndex={0} />);
    const label = edge(cut!.id).querySelector('[data-testid="edge-label"]');
    expect(Array.from(label?.textContent ?? '')).toHaveLength(40);
    expect(label?.textContent).toBe(long.slice(0, 39) + '…');
    const title = edge(cut!.id).querySelector('title');
    expect(title?.textContent).toBe(long);
    expect(title?.textContent).toHaveLength(50);
    // Short labels get no tooltip.
    for (const t of rest) expect(edge(t.id).querySelector('title')).toBeNull();
  });

  it('done step shows the regex large with a Copy button', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const trace = open(eliminate(endsAb).steps.length - 1);
    expect(screen.getByTestId('regex-result')).toHaveTextContent(trace.regex);
    await user.click(screen.getByTestId('regex-copy'));
    expect(writeText).toHaveBeenCalledWith(trace.regex);
    expect(toastStore.getState().toasts.map((t) => t.message)).toEqual(['Regex copied']);
  });

  it('a failed copy says so', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    open(eliminate(endsAb).steps.length - 1);
    await user.click(screen.getByTestId('regex-copy'));
    expect(toastStore.getState().toasts).toMatchObject([
      { message: 'Could not copy the regex', kind: 'error' },
    ]);
  });

  it('no regex result before the done step', () => {
    open(1);
    expect(screen.queryByTestId('regex-result')).toBeNull();
  });

  it('clicking a state picks it only while paused', () => {
    const trace = open(1);
    const clicked = trace.order[1]!;
    act(() => usePlaying.setState({ playing: true }));
    fireEvent.click(screen.getByTestId(`state-${clicked}`));
    expect(appStore.getState().trace).toBe(trace);

    act(() => usePlaying.setState({ playing: false }));
    fireEvent.click(screen.getByTestId(`state-${clicked}`));
    expect(current().order[0]).toBe(clicked);
    expect(appStore.getState().stepIndex).toBe(1);
    expect(screen.getByTestId(`state-${clicked}`)).toHaveAttribute('data-active', 'true');
    // The player stays where it was: the same step, still paused.
    expect(screen.getByTestId('step-counter')).toHaveTextContent(
      `Step 2 / ${current().steps.length}`,
    );
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('a drag (a pan) does not pick, and s does nothing', () => {
    const trace = open(1);
    const target = screen.getByTestId(`state-${trace.order[1]}`);
    fireEvent.pointerDown(target, { clientX: 10, clientY: 10, pointerId: 1, button: 0 });
    fireEvent.pointerMove(window, { clientX: 30, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 30, clientY: 10, pointerId: 1 });
    fireEvent.click(target, { clientX: 30, clientY: 10 });
    expect(appStore.getState().trace).toBe(trace);

    const s = document.querySelector(`.av-state[data-state-id="${GNFA_START}"]`);
    fireEvent.click(s!);
    expect(appStore.getState().trace).toBe(trace);
  });

  it('a pick keeps the player mounted, so its speed survives', async () => {
    const user = userEvent.setup();
    const trace = open(1);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Speed' }), '2');
    fireEvent.click(screen.getByTestId(`state-${trace.order[1]}`));
    expect(appStore.getState().trace).not.toBe(trace);
    expect(screen.getByRole('combobox', { name: 'Speed' })).toHaveValue('2');
  });
});
