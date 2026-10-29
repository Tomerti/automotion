import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addState } from '../../core/edit';
import { emptyAutomaton } from '../../core/model';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { startRun } from '../../store/traceActions';
import { endTutorial, startTutorial, tutorialStore } from './tutorialStore';

const app = () => appStore.getState();
const tut = () => tutorialStore.getState();
const active = () => app().automata.find((a) => a.id === app().activeId);

const loop = () =>
  fixture({
    kind: 'DFA',
    alphabet: 'a',
    states: ['q0'],
    start: 'q0',
    accepting: ['q0'],
    edges: [['q0', 'a', 'q0']],
    name: 'mine',
  });

beforeEach(() => resetAppStore());
afterEach(() => endTutorial());

describe('startTutorial', () => {
  it('reuses an empty active automaton, renamed Tutorial', () => {
    const blank = emptyAutomaton('Untitled', 'NFA');
    resetAppStore({ automata: [blank] });
    startTutorial();
    expect(app().automata).toHaveLength(1);
    expect(active()).toMatchObject({ id: blank.id, name: 'Tutorial', kind: 'DFA' });
    expect(tut()).toMatchObject({ active: true, automatonId: blank.id, progress: 0, current: 0 });
  });

  it('keeps the rename out of undo', () => {
    resetAppStore({ automata: [emptyAutomaton('Untitled', 'DFA')] });
    startTutorial();
    app().undo();
    expect(active()?.name).toBe('Tutorial');
  });

  it('creates a new one next to non-empty work, named Tutorial 2 when Tutorial is taken', () => {
    resetAppStore({ automata: [loop(), { ...loop(), id: 'old', name: 'Tutorial' }] });
    startTutorial();
    expect(app().automata).toHaveLength(3);
    expect(active()?.name).toBe('Tutorial 2');
    expect(tut().automatonId).toBe(app().activeId);
  });

  it('closes an open run', () => {
    resetAppStore({ automata: [loop()] });
    startRun('a');
    expect(app().trace).not.toBeNull();
    startTutorial();
    expect(app().trace).toBeNull();
  });

  it('starting again starts over on a fresh automaton', () => {
    startTutorial();
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    expect(tut().progress).toBe(1);
    const first = tut().automatonId;
    startTutorial();
    expect(tut()).toMatchObject({ progress: 0, current: 0, confirmation: null });
    expect(tut().automatonId).not.toBe(first);
    expect(active()?.name).toBe('Tutorial 2');
  });
});

describe('following the app', () => {
  it('moves on when a step is done and keeps its confirmation', () => {
    startTutorial();
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    expect(tut().current).toBe(1);
    expect(tut().confirmation).toBe('Added q_0');
  });

  it('does not move on from edits to another automaton', () => {
    resetAppStore({ automata: [loop()] });
    startTutorial();
    app().setActive('mine');
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    expect(tut().current).toBe(0);
  });

  it('ends when its automaton is deleted, leaving other work alone', () => {
    resetAppStore({ automata: [loop()] });
    startTutorial();
    app().deleteAutomaton(tut().automatonId!);
    expect(tut().active).toBe(false);
    expect(app().automata.map((a) => a.id)).toEqual(['mine']);
  });

  it('stops following once ended; the automaton stays', () => {
    startTutorial();
    const id = tut().automatonId;
    endTutorial();
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    expect(tut()).toMatchObject({ active: false, progress: 0 });
    expect(app().automata.some((a) => a.id === id)).toBe(true);
  });
});
