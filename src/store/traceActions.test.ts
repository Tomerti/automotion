import { beforeEach, describe, expect, it } from 'vitest';
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

  it('is a no-op for a DFA', async () => {
    appStore.getState().addAutomaton({ ...endsAb, kind: 'DFA', transitions: [] });
    await startSubset();
    expect(appStore.getState().trace).toBeNull();
  });
});
