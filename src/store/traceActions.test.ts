import { beforeEach, describe, expect, it } from 'vitest';
import type { Automaton } from '../core/model';
import { appStore, resetAppStore } from './store';
import { startSubset } from './traceActions';

/** NFA over {a,b} accepting words that end in "ab". */
export const endsAb: Automaton = {
  id: 'n1',
  name: 'ends ab',
  kind: 'NFA',
  alphabet: ['a', 'b'],
  states: [
    { id: 'q0', label: 'q0', x: 0, y: 0 },
    { id: 'q1', label: 'q1', x: 0, y: 0 },
    { id: 'q2', label: 'q2', x: 0, y: 0 },
  ],
  start: 'q0',
  accepting: ['q2'],
  transitions: [
    { id: 't1', from: 'q0', to: 'q0', symbols: ['a', 'b'] },
    { id: 't2', from: 'q0', to: 'q1', symbols: ['a'] },
    { id: 't3', from: 'q1', to: 'q2', symbols: ['b'] },
  ],
};

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
