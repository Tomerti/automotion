import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moveState } from '../core/edit';
import type { Automaton } from '../core/model';
import { nthFromEnd } from '../core/testing/fixtures';
import { layoutAutomaton } from '../layout/layout';
import { appStore, resetAppStore } from './store';
import { endsAb } from './testing/fixtures';
import { fixture } from '../core/testing/fixtures';
import { recordEvents } from '../test/goatcounter';
import { startMinimize, startRun, startSubset } from './traceActions';

// The real layout by default; individual tests make it fail or hold it at the await.
vi.mock('../layout/layout', async (importOriginal) => {
  const real = await importOriginal<typeof import('../layout/layout')>();
  return { ...real, layoutAutomaton: vi.fn(real.layoutAutomaton) };
});
const layoutMock = vi.mocked(layoutAutomaton);

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

describe('counting', () => {
  const dfa = fixture({
    name: 'Even a',
    kind: 'DFA',
    alphabet: 'a',
    states: ['p', 'q'],
    start: 'p',
    accepting: ['p'],
    edges: [
      ['p', 'a', 'q'],
      ['q', 'a', 'p'],
    ],
  });

  it('counts every run, on a DFA or an NFA', () => {
    const events = recordEvents();
    appStore.getState().addAutomaton(dfa);
    startRun('aa');
    appStore.getState().closeTrace();
    appStore.getState().addAutomaton(endsAb);
    startRun('ab');
    expect(events).toEqual(['run', 'run']);
  });

  it('counts no run that is refused', () => {
    const events = recordEvents();
    appStore.getState().addAutomaton(dfa);
    startRun('b');
    expect(appStore.getState().trace).toBeNull();
    expect(events).toEqual([]);
  });

  it('counts a conversion once its walkthrough opens, and not a failed one', async () => {
    const events = recordEvents();
    appStore.getState().addAutomaton(endsAb);
    layoutMock.mockRejectedValueOnce(new Error('elk exploded'));
    await startSubset();
    expect(events).toEqual([]);
    await startSubset();
    expect(events).toEqual(['convert']);
  });

  it('counts a minimization', () => {
    const events = recordEvents();
    appStore.getState().addAutomaton(dfa);
    startMinimize();
    expect(appStore.getState().trace).not.toBeNull();
    expect(events).toEqual(['minimize']);
  });
});
