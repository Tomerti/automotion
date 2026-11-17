import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addState,
  removeState,
  renameAutomaton,
  renameState,
  setStart,
  toggleAccepting,
} from '../../core/edit';
import { emptyAutomaton } from '../../core/model';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { minimize } from '../../core/minimize';
import { traceSourceId } from '../../core/trace';
import { startRun } from '../../store/traceActions';
import { endLesson, finishLesson, quitLesson, startLesson, tutorialStore } from './tutorialStore';
import { lessonSteps } from './engine';
import { BASICS } from './lessons/basics';
import { finishedLessons, LESSONS_DONE_KEY } from './lessonsDone';
import { TEST_LESSON } from './testing/testLesson';

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

beforeEach(() => {
  resetAppStore();
  localStorage.removeItem(LESSONS_DONE_KEY);
});
afterEach(() => endLesson());

describe('finished lessons', () => {
  it('finishing Basics records it; quitting records nothing', () => {
    startLesson('basics');
    quitLesson();
    expect(finishedLessons()).toEqual([]);
    startLesson('basics');
    finishLesson();
    expect(finishedLessons()).toEqual(['basics']);
    expect(tut().celebrating).toBe(BASICS);
  });

  it('a test lesson is never recorded', () => {
    startLesson(TEST_LESSON);
    finishLesson();
    expect(finishedLessons()).toEqual([]);
    expect(tut().celebrating).toBe(TEST_LESSON);
  });
});

describe('startLesson', () => {
  it('owns its automaton from the first moment, and Basics owns no more than that', () => {
    startLesson('basics');
    const id = tut().automatonId!;
    expect(tut().owned).toEqual([id]);
  });

  it('saving a conversion of the Tutorial automaton does not add to owned', () => {
    startLesson('basics');
    const id = tut().automatonId!;
    app().edit((a) => ({ ...loop(), id: a.id, name: a.name }));
    const trace = minimize(active()!);
    app().openTrace(trace);
    app().addAutomaton(trace.result);
    expect(tut().owned).toEqual([id]);
  });

  it('reuses an empty active automaton, renamed Tutorial', () => {
    const blank = emptyAutomaton('Untitled', 'NFA');
    resetAppStore({ automata: [blank] });
    startLesson('basics');
    expect(app().automata).toHaveLength(1);
    expect(active()).toMatchObject({ id: blank.id, name: 'Tutorial', kind: 'DFA' });
    expect(tut()).toMatchObject({ active: true, automatonId: blank.id, progress: 0, current: 0 });
  });

  it('replaces an untouched Untitled with a lesson copy, leaving no empty one behind', () => {
    const blank = emptyAutomaton('Untitled', 'DFA');
    resetAppStore({ automata: [blank] });
    startLesson('nfa');
    expect(app().automata).toHaveLength(1);
    expect(app().automata.some((a) => a.id === blank.id)).toBe(false);
    expect(active()?.id).toBe(tut().automatonId);
    quitLesson();
    // Quitting never leaves the canvas without an automaton.
    expect(app().automata).toHaveLength(1);
    expect(active()?.name).toBe('Untitled');
  });

  it('keeps work beside a lesson copy', () => {
    resetAppStore({ automata: [loop()] });
    startLesson('nfa');
    expect(app().automata).toHaveLength(2);
    expect(app().automata.some((a) => a.name === 'mine')).toBe(true);
  });

  it('keeps the rename out of undo', () => {
    resetAppStore({ automata: [emptyAutomaton('Untitled', 'DFA')] });
    startLesson('basics');
    app().undo();
    expect(active()?.name).toBe('Tutorial');
  });

  it('creates a new one next to non-empty work, named Tutorial 2 when Tutorial is taken', () => {
    resetAppStore({ automata: [loop(), { ...loop(), id: 'old', name: 'Tutorial' }] });
    startLesson('basics');
    expect(app().automata).toHaveLength(3);
    expect(active()?.name).toBe('Tutorial 2');
    expect(tut().automatonId).toBe(app().activeId);
  });

  it('does not reuse an empty automaton that has undo history', () => {
    resetAppStore({ automata: [emptyAutomaton('Untitled', 'DFA')] });
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    app().edit((a) => removeState(a, a.states[0]!.id));
    startLesson('basics');
    expect(app().automata).toHaveLength(2);
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    app().undo();
    app().undo();
    expect(active()?.name).toBe('Tutorial');
  });

  it('does not reuse an empty automaton the user named', () => {
    const blank = renameAutomaton(emptyAutomaton('Untitled', 'NFA'), 'HW3 NFA');
    resetAppStore({ automata: [blank] });
    startLesson('basics');
    expect(app().automata.find((a) => a.id === blank.id)).toMatchObject({
      name: 'HW3 NFA',
      kind: 'NFA',
    });
    expect(active()?.name).toBe('Tutorial');
  });

  it('closes an open run', () => {
    resetAppStore({ automata: [loop()] });
    startRun('a');
    expect(app().trace).not.toBeNull();
    startLesson('basics');
    expect(app().trace).toBeNull();
  });

  it('Finish removes the Tutorial automaton, with its run, and leaves a blank Untitled', () => {
    startLesson('basics');
    const id = tut().automatonId;
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    app().edit((a) => setStart(a, a.states[0]!.id));
    startRun('');
    expect(traceSourceId(app().trace!)).toBe(id);
    finishLesson();
    expect(tut().active).toBe(false);
    expect(app().trace).toBeNull();
    expect(app().automata.some((a) => a.id === id)).toBe(false);
    expect(app().automata).toHaveLength(1);
    expect(active()?.name).toBe('Untitled');
    expect(active()?.states).toEqual([]);
  });

  it('Finish of Basics leaves the user’s own automata, opening one of them', () => {
    resetAppStore({ automata: [loop()] });
    startLesson('basics');
    finishLesson();
    expect(app().automata.map((a) => a.id)).toEqual(['mine']);
    expect(app().activeId).toBe('mine');
  });

  it('Finish leaves a run on another automaton open', () => {
    resetAppStore({ automata: [loop()] });
    startLesson('basics');
    app().setActive('mine');
    startRun('a');
    finishLesson();
    expect(app().trace).not.toBeNull();
  });

  it('starting again starts over on a fresh automaton and removes the unfinished one', () => {
    startLesson('basics');
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    expect(tut().progress).toBe(1);
    const first = tut().automatonId;
    startLesson('basics');
    expect(tut()).toMatchObject({ progress: 0, current: 0 });
    expect(tut().automatonId).not.toBe(first);
    expect(app().automata.some((a) => a.id === first)).toBe(false);
    expect(active()?.name).toBe('Tutorial');
  });

  it('starting again from the closing card keeps the finished one', () => {
    startLesson('basics');
    const first = tut().automatonId;
    const done = lessonSteps(BASICS).length - 1;
    tutorialStore.setState({ progress: done, current: done });
    startLesson('basics');
    expect(app().automata.some((a) => a.id === first)).toBe(true);
    expect(active()?.name).toBe('Tutorial 2');
  });

  it('quitting ends it and removes its automaton', () => {
    startLesson('basics');
    const id = tut().automatonId;
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    quitLesson();
    expect(tut().active).toBe(false);
    expect(app().automata.some((a) => a.id === id)).toBe(false);
    expect(app().automata.length).toBeGreaterThan(0);
  });

  it('quitting the only automaton leaves a blank one', () => {
    resetAppStore({ automata: [] });
    startLesson('basics');
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    quitLesson();
    expect(app().automata).toHaveLength(1);
    expect(active()).toMatchObject({ name: 'Untitled', states: [] });
  });
});

describe('following the app', () => {
  it('falls back when a step comes undone', () => {
    startLesson('basics');
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    const id = active()!.states[0]!.id;
    app().edit((a) => renameState(a, id, 'even'));
    app().edit((a) => setStart(a, id));
    app().edit((a) => toggleAccepting(a, id));
    expect(tut()).toMatchObject({ current: 4, progress: 4 });
    app().undo();
    expect(tut()).toMatchObject({ current: 3, progress: 4 });
  });

  it('moves on when a step is done', () => {
    startLesson('basics');
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    expect(tut().current).toBe(1);
  });

  it('does not move on from edits to another automaton', () => {
    resetAppStore({ automata: [loop()] });
    startLesson('basics');
    app().setActive('mine');
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    expect(tut().current).toBe(0);
  });

  it('keeps showing the step it fell back to while another automaton is open', () => {
    resetAppStore({ automata: [loop()] });
    startLesson('basics');
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    const id = active()!.states[0]!.id;
    app().edit((a) => renameState(a, id, 'even'));
    app().edit((a) => setStart(a, id));
    app().edit((a) => toggleAccepting(a, id));
    app().edit((a) => addState(a, { x: 100, y: 0 }));
    expect(tut()).toMatchObject({ progress: 4, current: 4 });
    app().edit((a) => toggleAccepting(a, id));
    expect(tut()).toMatchObject({ progress: 4, current: 3 });
    app().setActive('mine');
    expect(tut().current).toBe(3);
  });

  it('ends when its automaton is deleted, leaving other work alone', () => {
    resetAppStore({ automata: [loop()] });
    startLesson('basics');
    app().deleteAutomaton(tut().automatonId!);
    expect(tut().active).toBe(false);
    expect(app().automata.map((a) => a.id)).toEqual(['mine']);
  });

  it('stops following once ended; the automaton stays', () => {
    startLesson('basics');
    const id = tut().automatonId;
    endLesson();
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    expect(tut()).toMatchObject({ active: false, progress: 0 });
    expect(app().automata.some((a) => a.id === id)).toBe(true);
  });
});
