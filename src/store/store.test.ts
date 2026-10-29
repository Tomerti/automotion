import { beforeEach, describe, expect, it } from 'vitest';
import type { StoreApi } from 'zustand/vanilla';
import { moveState, renameAutomaton } from '../core/edit';
import { runWord } from '../core/run';
import { fixture } from '../core/testing/fixtures';
import { appStore, createAppStore, resetAppStore } from './store';
import type { AppState } from './store';
import type { Automaton } from '../core/model';

const dfa = (id: string) => ({
  ...fixture({
    kind: 'DFA',
    alphabet: 'ab',
    states: ['q0', 'q1'],
    start: 'q0',
    accepting: ['q1'],
    edges: [
      ['q0', 'a', 'q1'],
      ['q0', 'b', 'q0'],
      ['q1', 'a,b', 'q1'],
    ],
  }),
  id,
  name: id,
});

function setup(): {
  s: StoreApi<AppState>;
  st: () => AppState;
  active: () => AppState['automata'][number];
} {
  const s = createAppStore({ automata: [dfa('a1')], activeId: 'a1' });
  const st = () => s.getState();
  return { s, st, active: () => st().automata.find((a) => a.id === st().activeId)! };
}
const hist = (s: AppState, id: string): { past: Automaton[]; future: Automaton[] } =>
  s.history[id] ?? { past: [], future: [] };
const x0 = (a: { states: { id: string; x: number }[] }) => a.states.find((q) => q.id === 'q0')!.x;

describe('store', () => {
  it('edit then undo then redo', () => {
    const { st, active } = setup();
    st().edit((a) => moveState(a, 'q0', { x: 50, y: 0 }));
    expect(x0(active())).toBe(50);
    st().undo();
    expect(x0(active())).toBe(0);
    st().redo();
    expect(x0(active())).toBe(50);
  });

  it('a new edit clears redo', () => {
    const { st } = setup();
    st().edit((a) => moveState(a, 'q0', { x: 1, y: 0 }));
    st().undo();
    expect(hist(st(), 'a1').future).toHaveLength(1);
    st().edit((a) => moveState(a, 'q0', { x: 2, y: 0 }));
    expect(hist(st(), 'a1').future).toHaveLength(0);
  });

  it('caps history at 100', () => {
    const { st } = setup();
    for (let i = 0; i < 105; i++) st().edit((a) => moveState(a, 'q0', { x: i, y: 0 }));
    expect(hist(st(), 'a1').past).toHaveLength(100);
  });

  it('checkpoint + unrecorded edits undo as one step', () => {
    const { st, active } = setup();
    st().checkpoint();
    for (let i = 1; i <= 5; i++)
      st().edit((a) => moveState(a, 'q0', { x: i * 10, y: 0 }), { record: false });
    expect(x0(active())).toBe(50);
    expect(hist(st(), 'a1').past).toHaveLength(1);
    st().undo();
    expect(x0(active())).toBe(0);
  });

  it('edits are ignored while a trace is open', () => {
    const { st, active } = setup();
    st().openTrace(runWord(active(), 'a'));
    st().edit((a) => renameAutomaton(a, 'x'));
    expect(active().name).not.toBe('x');
    expect(hist(st(), 'a1').past).toHaveLength(0);
  });

  it('undo, redo and checkpoint are no-ops while a trace is open', () => {
    const { st, active } = setup();
    st().edit((a) => moveState(a, 'q0', { x: 7, y: 0 }));
    st().openTrace(runWord(active(), 'a'));
    st().undo();
    st().checkpoint();
    expect(x0(active())).toBe(7);
    expect(hist(st(), 'a1').past).toHaveLength(1);
    st().closeTrace();
    st().redo();
    expect(x0(active())).toBe(7);
    st().undo();
    expect(x0(active())).toBe(0);
  });

  it('undo and redo with empty stacks do nothing; edit without active does nothing', () => {
    const { st } = setup();
    const before = st().automata;
    st().undo();
    st().redo();
    expect(st().automata).toBe(before);
    const empty = createAppStore();
    empty.getState().edit((a) => renameAutomaton(a, 'x'));
    expect(empty.getState().automata).toEqual([]);
  });

  it('setStep clamps and openTrace resets step and selection', () => {
    const { st, active } = setup();
    st().select({ states: ['q0'], transitions: [] });
    const trace = runWord(active(), 'a');
    st().openTrace(trace);
    expect(st().stepIndex).toBe(0);
    expect(st().selection).toEqual({ states: [], transitions: [] });
    st().setStep(999);
    expect(st().stepIndex).toBe(trace.steps.length - 1);
    st().setStep(-3);
    expect(st().stepIndex).toBe(0);
    st().closeTrace();
    expect(st().trace).toBeNull();
  });

  it('createAutomaton picks a free name, returns id, becomes active, goes first', () => {
    const s = createAppStore();
    const id1 = s.getState().createAutomaton();
    const id2 = s.getState().createAutomaton('DFA');
    s.getState().createAutomaton('NFA');
    expect(s.getState().automata.map((a) => a.name)).toEqual([
      'Untitled 3',
      'Untitled 2',
      'Untitled',
    ]);
    expect(s.getState().automata.map((a) => a.kind)).toEqual(['NFA', 'DFA', 'DFA']);
    expect(id1).not.toBe(id2);
    expect(s.getState().automata[1]?.id).toBe(id2);
    expect(s.getState().activeId).toBe(s.getState().automata[0]?.id);
  });

  it('keeps automata most recently edited first; switching alone does not reorder', () => {
    const s = createAppStore({ automata: [dfa('a1'), dfa('a2'), dfa('a3')], activeId: 'a1' });
    const st = () => s.getState();
    const order = () => st().automata.map((a) => a.id);
    st().setActive('a3');
    expect(order()).toEqual(['a1', 'a2', 'a3']);
    st().edit((a) => moveState(a, 'q0', { x: 1, y: 0 }));
    expect(order()).toEqual(['a3', 'a1', 'a2']);
    st().setActive('a2');
    st().checkpoint();
    expect(order()).toEqual(['a3', 'a1', 'a2']);
    st().setActive('a3');
    st().undo();
    st().setActive('a1');
    st().edit((a) => moveState(a, 'q0', { x: 2, y: 0 }), { record: false });
    st().setActive('a3');
    st().redo();
    expect(order()).toEqual(['a3', 'a1', 'a2']);
    st().addAutomaton(dfa('a4'));
    expect(order()).toEqual(['a4', 'a3', 'a1', 'a2']);
  });

  it('addAutomaton activates; setActive clears selection', () => {
    const { st } = setup();
    st().select({ states: ['q0'], transitions: [] });
    st().addAutomaton(dfa('a2'));
    expect(st().activeId).toBe('a2');
    st().select({ states: ['q0'], transitions: [] });
    st().setActive('a1');
    expect(st().activeId).toBe('a1');
    expect(st().selection.states).toEqual([]);
  });

  it('deleteAutomaton picks next, else previous, else null, and drops history/viewport', () => {
    const s = createAppStore({ automata: [dfa('a1'), dfa('a2'), dfa('a3')], activeId: 'a2' });
    const st = () => s.getState();
    st().edit((a) => moveState(a, 'q0', { x: 1, y: 0 }));
    st().setViewport('a2', { x: 1, y: 2, zoom: 1 });
    // The edit moved a2 to the front: a2, a1, a3.
    st().deleteAutomaton('a2');
    expect(st().activeId).toBe('a1');
    expect(st().history['a2']).toBeUndefined();
    expect(st().viewports['a2']).toBeUndefined();
    st().setActive('a3');
    st().deleteAutomaton('a3');
    expect(st().activeId).toBe('a1');
    st().deleteAutomaton('a1');
    expect(st().activeId).toBeNull();
  });

  it('deleting a non-active automaton keeps the active one', () => {
    const s = createAppStore({ automata: [dfa('a1'), dfa('a2')], activeId: 'a1' });
    s.getState().deleteAutomaton('a2');
    expect(s.getState().activeId).toBe('a1');
  });

  it('replaceAll loads, activates first, clears history, trace and selection', () => {
    const { st, active } = setup();
    st().edit((a) => moveState(a, 'q0', { x: 1, y: 0 }));
    st().openTrace(runWord(active(), 'a'));
    st().replaceAll([dfa('b1'), dfa('b2')]);
    expect(st().activeId).toBe('b1');
    expect(st().history).toEqual({});
    expect(st().trace).toBeNull();
    st().replaceAll([]);
    expect(st().activeId).toBeNull();
  });

  it('history snapshots survive later edits unchanged', () => {
    const { st, active } = setup();
    st().edit((a) => moveState(a, 'q0', { x: 10, y: 0 }));
    st().edit((a) => moveState(a, 'q0', { x: 20, y: 0 }));
    expect(hist(st(), 'a1').past.map(x0)).toEqual([0, 10]);
    st().undo();
    expect(x0(active())).toBe(10);
    expect(hist(st(), 'a1').future.map(x0)).toEqual([20]);
  });

  it('setActive, createAutomaton and addAutomaton close an open trace', () => {
    const open = (st: () => AppState, active: () => Automaton): void => {
      st().openTrace(runWord(active(), 'a'));
      st().setStep(1);
    };
    const { st, active } = setup();
    st().addAutomaton(dfa('a2'));
    open(st, active);
    st().setActive('a1');
    expect(st().trace).toBeNull();
    expect(st().stepIndex).toBe(0);
    open(st, active);
    st().createAutomaton('NFA');
    expect(st().trace).toBeNull();
    expect(st().stepIndex).toBe(0);
    st().setActive('a1');
    open(st, active);
    st().addAutomaton(dfa('a2'));
    expect(st().trace).toBeNull();
    expect(st().stepIndex).toBe(0);
  });

  it('setActive on the already-active automaton keeps an open trace', () => {
    const { st, active } = setup();
    st().openTrace(runWord(active(), 'a'));
    st().setStep(1);
    const trace = st().trace;
    st().setActive('a1');
    expect(st().trace).toBe(trace);
    expect(st().stepIndex).toBe(1);
  });

  describe('module store', () => {
    beforeEach(() => resetAppStore());
    it('resetAppStore gives fresh state', () => {
      appStore.getState().createAutomaton('DFA');
      resetAppStore();
      expect(appStore.getState().automata).toEqual([]);
      resetAppStore({ automata: [dfa('z')], activeId: 'z' });
      expect(appStore.getState().activeId).toBe('z');
      appStore.getState().deleteAutomaton('z');
      expect(appStore.getState().automata).toEqual([]);
    });
  });
});
