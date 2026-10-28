import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nthFromEnd } from '../core/testing/fixtures';
import { appStore, resetAppStore } from './store';
import { endsAb } from './testing/fixtures';
import { startSubset } from './traceActions';

beforeEach(() => resetAppStore());

describe('startSubset', () => {
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
