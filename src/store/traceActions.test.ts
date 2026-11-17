import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moveState } from '../core/edit';
import { eliminate, GNFA_ACCEPT, GNFA_START } from '../core/eliminate';
import type { Automaton } from '../core/model';
import { fixture, nthFromEnd } from '../core/testing/fixtures';
import type { EliminateTrace } from '../core/trace';
import { layoutAutomaton } from '../layout/layout';
import { appStore, resetAppStore } from './store';
import { endsAb } from './testing/fixtures';
import {
  pickEliminate,
  startEliminate,
  startRun,
  startSubset,
  startThompson,
} from './traceActions';

// The real layout by default; individual tests make it fail or hold it at the await.
vi.mock('../layout/layout', async (importOriginal) => {
  const real = await importOriginal<typeof import('../layout/layout')>();
  return { ...real, layoutAutomaton: vi.fn(real.layoutAutomaton) };
});
const layoutMock = vi.mocked(layoutAutomaton);

// The real elimination by default; one test makes a pick throw.
vi.mock('../core/eliminate', async (importOriginal) => {
  const real = await importOriginal<typeof import('../core/eliminate')>();
  return { ...real, eliminate: vi.fn(real.eliminate) };
});
const eliminateMock = vi.mocked(eliminate);

/** Hold the next layout call until `release()`; it then resolves with its input. */
function holdLayout(): { release: () => void } {
  let release = (): void => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  layoutMock.mockImplementationOnce(async (a: Automaton) => {
    await gate;
    return a;
  });
  return { release: () => release() };
}

beforeEach(() => {
  resetAppStore();
  layoutMock.mockClear();
  eliminateMock.mockClear();
});

describe('startSubset', () => {
  it('reports a layout failure through onError and opens no trace', async () => {
    appStore.getState().addAutomaton(endsAb);
    layoutMock.mockRejectedValueOnce(new Error('elk exploded'));
    const onError = vi.fn();
    await startSubset(onError);
    expect(onError).toHaveBeenCalledWith('Could not lay out the automaton');
    expect(appStore.getState().trace).toBeNull();
  });

  it('drops the result when the automaton changes during the layout', async () => {
    appStore.getState().addAutomaton(endsAb);
    const { release } = holdLayout();
    const onError = vi.fn();
    const pending = startSubset(onError);
    await vi.waitFor(() => expect(layoutMock).toHaveBeenCalled());
    appStore.getState().edit((a) => moveState(a, 'q0', { x: 9, y: 9 }));
    release();
    await pending;
    expect(appStore.getState().trace).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('drops the result when another automaton becomes active during the layout', async () => {
    appStore.getState().addAutomaton({ ...endsAb, id: 'other', name: 'other' });
    appStore.getState().addAutomaton(endsAb);
    const { release } = holdLayout();
    const pending = startSubset();
    await vi.waitFor(() => expect(layoutMock).toHaveBeenCalled());
    appStore.getState().setActive('other');
    release();
    await pending;
    expect(appStore.getState().trace).toBeNull();
  });

  it('ignores a second Convert while one is in flight', async () => {
    appStore.getState().addAutomaton(endsAb);
    const { release } = holdLayout();
    const first = startSubset();
    await vi.waitFor(() => expect(layoutMock).toHaveBeenCalled());
    const second = startSubset();
    release();
    await Promise.all([first, second]);
    expect(layoutMock).toHaveBeenCalledTimes(1);
    expect(appStore.getState().trace?.kind).toBe('subset');
    // Once settled, Convert works again.
    appStore.getState().closeTrace();
    await startSubset();
    expect(layoutMock).toHaveBeenCalledTimes(2);
  });

  it('opens a subset trace with laid-out, distinct positions', async () => {
    appStore.getState().addAutomaton(endsAb);
    await startSubset();
    const trace = appStore.getState().trace;
    expect(trace?.kind).toBe('subset');
    if (trace?.kind !== 'subset') return;
    const pts = new Set(trace.result.states.map((s) => `${s.x},${s.y}`));
    expect(pts.size).toBe(trace.result.states.length);
    expect(trace.result.states.length).toBeGreaterThan(1);
  });

  it('reports the state cap through onError and opens no trace', async () => {
    appStore.getState().addAutomaton(nthFromEnd(7));
    const onError = vi.fn();
    await startSubset(onError);
    expect(onError).toHaveBeenCalledWith(
      'Conversion stopped: the DFA would have more than 64 states',
    );
    expect(appStore.getState().trace).toBeNull();
  });

  it('is a no-op for a DFA', async () => {
    appStore.getState().addAutomaton({ ...endsAb, kind: 'DFA', transitions: [] });
    await startSubset();
    expect(appStore.getState().trace).toBeNull();
  });
});

describe('startThompson', () => {
  it('replaces an open trace and keeps the active automaton', () => {
    appStore.getState().addAutomaton(endsAb);
    const seededId = appStore.getState().activeId;
    startRun('ab');
    expect(appStore.getState().trace?.kind).toBe('run');
    startThompson('a|b');
    expect(appStore.getState().trace?.kind).toBe('thompson');
    expect(appStore.getState().activeId).toBe(seededId);
    const x = (): number | undefined =>
      appStore.getState().automata.find((a) => a.id === seededId)?.states[0]?.x;
    // locked while the trace is open
    appStore.getState().edit((a) => moveState(a, 'q0', { x: 7, y: 7 }));
    expect(x()).not.toBe(7);
    appStore.getState().closeTrace();
    appStore.getState().edit((a) => moveState(a, 'q0', { x: 7, y: 7 }));
    expect(x()).toBe(7);
  });

  it('does nothing for an invalid regex', () => {
    startThompson('a|');
    expect(appStore.getState().trace).toBeNull();
  });
});

const TOO_LONG = 'The regex grows past 2000 characters: try a smaller automaton';

/** A 9-state DFA whose regex grows past the 2000-character cap. */
function dense(): Automaton {
  const ids = Array.from({ length: 9 }, (_, i) => `q${i}`);
  const edges: [string, string, string][] = [];
  ids.forEach((from, i) => {
    edges.push([from, 'a', ids[(i + 1) % 9]!]);
    edges.push([from, 'b', ids[(i * 2 + 1) % 9]!]);
    edges.push([from, 'c', ids[(i * 4 + 3) % 9]!]);
  });
  return fixture({
    kind: 'DFA',
    alphabet: 'abc',
    states: ids,
    start: 'q0',
    accepting: ['q8'],
    edges,
    name: 'dense',
  });
}

describe('startEliminate and pickEliminate', () => {
  const trace = (): EliminateTrace => {
    const t = appStore.getState().trace;
    if (t?.kind !== 'eliminate') throw new Error(`expected an eliminate trace, got ${t?.kind}`);
    return t;
  };

  /** Open To regex on endsAb (states q0, q1, q2) at step `i`. */
  function openAt(i: number): EliminateTrace {
    appStore.getState().addAutomaton(endsAb);
    startEliminate();
    appStore.getState().setStep(i);
    return trace();
  }

  it('startEliminate opens a paused-by-default eliminate trace; errors go to onError', () => {
    appStore.getState().addAutomaton(endsAb);
    const onError = vi.fn();
    startEliminate(onError);
    expect(trace().kind).toBe('eliminate');
    expect(trace().source.id).toBe(endsAb.id);
    expect(appStore.getState().stepIndex).toBe(0);
    expect(onError).not.toHaveBeenCalled();

    appStore.getState().closeTrace();
    appStore.getState().addAutomaton(dense());
    startEliminate(onError);
    expect(onError).toHaveBeenCalledWith(TOO_LONG);
    expect(appStore.getState().trace).toBeNull();
  });

  it('startEliminate does nothing when canEliminate refuses', () => {
    appStore.getState().addAutomaton({ ...endsAb, starts: [] });
    const onError = vi.fn();
    startEliminate(onError);
    expect(appStore.getState().trace).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('pickEliminate on a pick step replaces that pick', () => {
    const old = openAt(1);
    expect(old.steps[1]?.phase).toBe('pick');
    const clicked = old.order[1]!;
    pickEliminate(clicked);
    expect(trace().order[0]).toBe(clicked);
    expect(appStore.getState().stepIndex).toBe(1);
    expect(trace().steps[1]?.removing).toBe(clicked);
  });

  it('picking while paused on an earlier step', () => {
    // On the gnfa step: the new pick is step 1.
    const old = openAt(0);
    const last = old.order[old.order.length - 1]!;
    pickEliminate(last);
    expect(appStore.getState().stepIndex).toBe(1);
    expect(trace().steps[1]?.phase).toBe('pick');
    expect(trace().steps[1]?.removing).toBe(last);
    expect(trace().steps[0]).toEqual(old.steps[0]);

    // On a remove step i: steps 0..i stay, the clicked state is picked at i + 1.
    appStore.getState().closeTrace();
    const before = (() => {
      startEliminate();
      appStore.getState().setStep(2);
      return trace();
    })();
    expect(before.steps[2]?.phase).toBe('remove');
    const clicked = before.order[2]!; // not the automatic next pick (order[1])
    pickEliminate(clicked);
    expect(appStore.getState().stepIndex).toBe(3);
    expect(trace().steps.slice(0, 3)).toEqual(before.steps.slice(0, 3));
    expect(trace().steps[3]?.removing).toBe(clicked);
    expect(trace().order).toEqual([before.order[0], clicked, before.order[1]]);
  });

  it('pickEliminate ignores s, f, removed states and the done step', () => {
    const t = openAt(2);
    for (const id of [GNFA_START, GNFA_ACCEPT, t.order[0]!, 'no-such-state']) {
      pickEliminate(id);
      expect(appStore.getState().trace).toBe(t);
      expect(appStore.getState().stepIndex).toBe(2);
    }
    appStore.getState().setStep(t.steps.length - 1);
    pickEliminate(t.order[2]!);
    expect(appStore.getState().trace).toBe(t);
    expect(appStore.getState().stepIndex).toBe(t.steps.length - 1);
  });

  it('pickEliminate keeps the trace and step when the recomputed regex grows too long', () => {
    const t = openAt(1);
    eliminateMock.mockImplementationOnce(() => {
      throw new Error(TOO_LONG);
    });
    const onError = vi.fn();
    pickEliminate(t.order[1]!, onError);
    expect(onError).toHaveBeenCalledWith(TOO_LONG);
    expect(appStore.getState().trace).toBe(t);
    expect(appStore.getState().stepIndex).toBe(1);
  });

  it('pickEliminate does nothing for other traces', () => {
    appStore.getState().addAutomaton(endsAb);
    startRun('ab');
    const t = appStore.getState().trace;
    pickEliminate('q1');
    expect(appStore.getState().trace).toBe(t);
  });
});
