import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toggleAccepting } from '../../core/edit';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { startMinimize } from '../../store/traceActions';
import { RETIRE_AFTER } from './hints';
import {
  HINTS_KEY,
  dismiss,
  hintsStore,
  learn,
  reloadLearned,
  startHintLearning,
} from './hintsLearned';

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

let stop: () => void = () => {};
beforeEach(() => {
  window.localStorage.clear();
  reloadLearned();
  resetAppStore({ automata: [parity], activeId: parity.id });
  stop = startHintLearning();
});
afterEach(() => stop());

const count = (k: string): number => (hintsStore.getState() as Record<string, number>)[k] ?? 0;

describe('hint learning', () => {
  it('counts uses up to RETIRE_AFTER and remembers them', () => {
    for (let i = 0; i < RETIRE_AFTER + 2; i++) learn('copy');
    expect(count('copy')).toBe(RETIRE_AFTER);
    expect(JSON.parse(window.localStorage.getItem(HINTS_KEY) ?? '{}')).toEqual({
      copy: RETIRE_AFTER,
    });
    hintsStore.setState({}, true);
    reloadLearned();
    expect(count('copy')).toBe(RETIRE_AFTER);
  });

  it('dismiss retires keys at once', () => {
    dismiss(['start', 'accept']);
    expect(count('start')).toBe(RETIRE_AFTER);
    expect(count('accept')).toBe(RETIRE_AFTER);
  });

  it('ignores corrupt stored counts', () => {
    window.localStorage.setItem(HINTS_KEY, '[1,2]');
    reloadLearned();
    expect(hintsStore.getState()).toEqual({});
    window.localStorage.setItem(HINTS_KEY, '{"copy":"x","menu":2}');
    reloadLearned();
    expect(hintsStore.getState()).toEqual({ menu: 2 });
  });

  it('learns from edits: accepting, start, transitions, deleting', () => {
    const st = appStore.getState();
    st.edit((a) => toggleAccepting(a, 'q0'));
    expect(count('accept')).toBe(1);
    st.edit((a) => ({ ...a, starts: ['q1'] }));
    expect(count('start')).toBe(1);
    st.edit((a) => ({
      ...a,
      transitions: a.transitions.map((t, i) =>
        i === 0 ? { ...t, symbols: [...t.symbols, 'b'] } : t,
      ),
    }));
    expect(count('transition')).toBe(1);
    st.edit((a) => ({ ...a, states: a.states.slice(1) }));
    expect(count('delete')).toBe(1);
  });

  it('counts a group move once per drag, not once per pointer move', () => {
    const st = appStore.getState();
    const nudge = (d: number): void =>
      st.edit((a) => ({ ...a, states: a.states.map((q) => ({ ...q, x: q.x + d })) }), {
        record: false,
      });
    st.checkpoint();
    nudge(1);
    nudge(1);
    nudge(1);
    expect(count('group')).toBe(1);
    st.checkpoint();
    nudge(1);
    expect(count('group')).toBe(2);
  });

  it('learns copying, multi-selection and opening a walkthrough', () => {
    const st = appStore.getState();
    st.select({ states: ['q0', 'q1'], transitions: [] });
    expect(count('multi')).toBe(1);
    st.copySelection();
    expect(count('copy')).toBe(1);
    st.select({ states: [], transitions: [] });
    startMinimize();
    expect(count('minimize')).toBe(1);
  });
});
