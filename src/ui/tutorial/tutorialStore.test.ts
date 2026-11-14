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
import { subsetConstruction } from '../../core/subset';
import { appStore, resetAppStore } from '../../store/store';
import { startMinimize, startRun } from '../../store/traceActions';
import {
  endTutorial,
  finishTutorial,
  quitTutorial,
  startTutorial,
  tutorialContext,
  tutorialStore,
} from './tutorialStore';
import { PART3_NFA, STEPS } from './steps';

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

  it('does not reuse an empty automaton that has undo history', () => {
    resetAppStore({ automata: [emptyAutomaton('Untitled', 'DFA')] });
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    app().edit((a) => removeState(a, a.states[0]!.id));
    startTutorial();
    expect(app().automata).toHaveLength(2);
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    app().undo();
    app().undo();
    expect(active()?.name).toBe('Tutorial');
  });

  it('does not reuse an empty automaton the user named', () => {
    const blank = renameAutomaton(emptyAutomaton('Untitled', 'NFA'), 'HW3 NFA');
    resetAppStore({ automata: [blank] });
    startTutorial();
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
    startTutorial();
    expect(app().trace).toBeNull();
  });

  it('Finish keeps the automaton and closes the run that ended the tutorial', () => {
    startTutorial();
    const id = tut().automatonId;
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    app().edit((a) => setStart(a, a.states[0]!.id));
    startRun('');
    expect(app().trace?.source.id).toBe(id);
    finishTutorial();
    expect(tut().active).toBe(false);
    expect(app().trace).toBeNull();
    expect(app().automata.some((a) => a.id === id)).toBe(true);
  });

  it('Finish leaves a run on another automaton open', () => {
    resetAppStore({ automata: [loop()] });
    startTutorial();
    app().setActive('mine');
    startRun('a');
    finishTutorial();
    expect(app().trace).not.toBeNull();
  });

  it('starting again starts over on a fresh automaton and removes the unfinished one', () => {
    startTutorial();
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    expect(tut().progress).toBe(1);
    const first = tut().automatonId;
    startTutorial();
    expect(tut()).toMatchObject({ progress: 0, current: 0 });
    expect(tut().automatonId).not.toBe(first);
    expect(app().automata.some((a) => a.id === first)).toBe(false);
    expect(active()?.name).toBe('Tutorial');
  });

  it('starting again from the closing card keeps the finished one', () => {
    startTutorial();
    const first = tut().automatonId;
    const done = STEPS.length - 1;
    tutorialStore.setState({ progress: done, current: done });
    startTutorial();
    expect(app().automata.some((a) => a.id === first)).toBe(true);
    expect(active()?.name).toBe('Tutorial 2');
  });

  it('quitting ends it and removes its automaton', () => {
    startTutorial();
    const id = tut().automatonId;
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    quitTutorial();
    expect(tut().active).toBe(false);
    expect(app().automata.some((a) => a.id === id)).toBe(false);
    expect(app().automata.length).toBeGreaterThan(0);
  });

  it('quitting the only automaton leaves a blank one', () => {
    resetAppStore({ automata: [] });
    startTutorial();
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    quitTutorial();
    expect(app().automata).toHaveLength(1);
    expect(active()).toMatchObject({ name: 'Untitled', states: [] });
  });
});

describe('following the app', () => {
  it('falls back when a step comes undone', () => {
    startTutorial();
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
    startTutorial();
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    expect(tut().current).toBe(1);
  });

  it('does not move on from edits to another automaton', () => {
    resetAppStore({ automata: [loop()] });
    startTutorial();
    app().setActive('mine');
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    expect(tut().current).toBe(0);
  });

  it('keeps showing the step it fell back to while another automaton is open', () => {
    resetAppStore({ automata: [loop()] });
    startTutorial();
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

describe('part 3', () => {
  const idx = (id: string) => STEPS.findIndex((s) => s.id === id);
  /** The finished part 2: one state, any, looping on 0 and 1. */
  const any = () =>
    fixture({
      kind: 'DFA',
      alphabet: '01',
      states: ['any'],
      start: 'any',
      accepting: ['any'],
      edges: [['any', '0,1', 'any']],
    });

  /** Reach part 2's last run at its verdict: the hand-over to part 3, with the run still open. */
  function toHandOver(): string {
    startTutorial();
    const id = tut().automatonId!;
    app().edit(() => ({ ...any(), id, name: 'Tutorial' }));
    tutorialStore.setState({
      progress: idx('run-10-again'),
      current: idx('run-10-again'),
      latched: new Set(['run-1010', 'run-10']),
    });
    startRun('10');
    app().setStep(app().trace!.steps.length - 1);
    return id;
  }

  const tutorialAutomaton = () => app().automata.find((a) => a.id === tut().automatonId)!;

  /** Close the hand-over run (loading the NFA) and open the tutorial's conversion. */
  function converting() {
    app().closeTrace();
    const trace = subsetConstruction(tutorialAutomaton());
    app().openTrace(trace);
    return trace;
  }

  it('loads the NFA when part 3 starts', () => {
    const id = toHandOver();
    expect(tut().current).toBe(idx('convert'));
    // Not while the run that ended part 2 is still open.
    expect(tut().nfaLoaded).toBe(false);
    expect(tutorialAutomaton().kind).toBe('DFA');
    app().closeTrace();
    expect(tutorialAutomaton()).toMatchObject({
      id,
      name: 'Tutorial',
      kind: PART3_NFA.kind,
      states: PART3_NFA.states,
      transitions: PART3_NFA.transitions,
      starts: PART3_NFA.starts,
      accepting: PART3_NFA.accepting,
    });
    expect(tut().nfaLoaded).toBe(true);
    expect(tut().current).toBe(idx('convert'));
    // One undo step brings part 2's automaton back, and the NFA isn't loaded over it again.
    app().undo();
    expect(tutorialAutomaton()).toMatchObject({ kind: 'DFA', name: 'Tutorial' });
    expect(tutorialAutomaton().states.map((s) => s.label)).toEqual(['any']);
  });

  it('after an undo of the NFA, asks for a redo, which brings it back', () => {
    toHandOver();
    app().closeTrace();
    app().undo();
    const ctx = tutorialContext(app(), tut().automatonId, tut().derivedId);
    expect(STEPS[tut().current]!.hint(ctx)).toEqual({
      kind: 'first',
      text: 'First, press [Ctrl] + [Y] to bring the NFA back.',
    });
    app().redo();
    expect(tutorialAutomaton().kind).toBe('NFA');
    expect(STEPS[tut().current]!.hint(tutorialContext(app(), tut().automatonId, null))).toBeNull();
    // Only one checkpoint: one undo goes back to part 2's automaton.
    app().undo();
    expect(tutorialAutomaton().states.map((s) => s.label)).toEqual(['any']);
  });

  it('does not load the NFA while another automaton is open', () => {
    resetAppStore({ automata: [loop()] });
    toHandOver();
    app().setActive('mine');
    expect(tut().nfaLoaded).toBe(false);
    expect(tutorialAutomaton().kind).toBe('DFA');
    app().setActive(tut().automatonId!);
    expect(tut().nfaLoaded).toBe(true);
    expect(tutorialAutomaton().kind).toBe('NFA');
  });

  it('remembers the converted DFA, and follows Save and minimize onto it', () => {
    toHandOver();
    const trace = converting();
    expect(tut().derivedId).toBe(trace.result.id);
    expect(tut().current).toBe(idx('convert-end'));
    app().setStep(trace.steps.length - 1);
    expect(tut().current).toBe(idx('save-minimize'));
    // Save and minimize: the saved DFA keeps the result's id.
    app().addAutomaton(trace.result);
    startMinimize();
    expect(app().trace?.source.id).toBe(trace.result.id);
    expect(tut().current).toBe(idx('minimize-end'));
    app().setStep(app().trace!.steps.length - 1);
    expect(tut().current).toBe(idx('done'));
  });

  it('forgets the converted DFA once it is deleted', () => {
    toHandOver();
    const trace = converting();
    app().addAutomaton(trace.result);
    expect(tut().derivedId).toBe(trace.result.id);
    app().deleteAutomaton(trace.result.id);
    expect(tut().derivedId).toBeNull();
  });

  it('finish closes the walkthrough', () => {
    toHandOver();
    const trace = converting();
    app().setStep(trace.steps.length - 1);
    app().addAutomaton(trace.result);
    startMinimize();
    app().setStep(app().trace!.steps.length - 1);
    expect(STEPS[tut().current]!.part).toBe(4);
    expect(app().trace?.kind).toBe('minimize');
    finishTutorial();
    expect(app().trace).toBeNull();
    expect(app().automata.some((a) => a.id === trace.result.id)).toBe(true);
  });
});
