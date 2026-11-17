import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addState } from '../../core/edit';
import { emptyAutomaton } from '../../core/model';
import type { Automaton } from '../../core/model';
import { runWord } from '../../core/run';
import { subsetConstruction } from '../../core/subset';
import type { AnyTrace, SubsetTrace } from '../../core/trace';
import { appStore, resetAppStore } from '../../store/store';
import { answerConfirm, confirmStore } from '../shell/confirmStore';
import { advance, lessonSteps, pacingStep } from './engine';
import type { LessonId, TutorialContext } from './engine';
import { BASICS } from './lessons/basics';
import { CONVERT_LESSON } from './lessons/convert';
import { NFA_LESSON } from './lessons/nfa';
import {
  CONTAINS_01,
  IDEA_LESSON as IDEA,
  PAUSING_LESSON as PAUSING,
  TEST_LESSON,
} from './testing/testLesson';
import {
  endLesson,
  finishLesson,
  lessonOpensPaused,
  lessonStopAt,
  noteLessonAction,
  pressNext,
  quitLesson,
  requestLesson,
  startLesson,
  tutorialContext,
  tutorialStore,
} from './tutorialStore';

const app = () => appStore.getState();
const tut = () => tutorialStore.getState();
const active = () => app().automata.find((a) => a.id === app().activeId)!;
const steps = lessonSteps(TEST_LESSON);
const idx = (id: string): number => steps.findIndex((s) => s.id === id);
const other = () => ({ ...emptyAutomaton('Mine', 'DFA'), id: 'mine' });

/** Open the conversion of the active automaton (laid out or not, the engine doesn't care). */
const convert = (): SubsetTrace => {
  const trace = subsetConstruction(active());
  app().openTrace(trace);
  return trace;
};

beforeEach(() => resetAppStore({ automata: [other()] }));
afterEach(() => {
  answerConfirm(false);
  endLesson();
});

describe('a lesson with a start automaton', () => {
  it('opens a named copy of the start automaton', () => {
    resetAppStore({ automata: [{ ...CONTAINS_01, id: 'taken' }] });
    startLesson(TEST_LESSON);
    expect(active().name).toBe('Contains 01 2');
    expect(active().id).not.toBe(CONTAINS_01.id);
    expect(active().id).not.toBe('taken');
    expect(active().states).toEqual(CONTAINS_01.states);
    expect(tut()).toMatchObject({ active: true, lessonId: 'test', automatonId: active().id });
    expect(tut().owned).toEqual([active().id]);
  });

  it('checks the lesson before changing anything', () => {
    startLesson(TEST_LESSON);
    const id = tut().automatonId;
    expect(() => startLesson('nope' as LessonId)).toThrow();
    expect(tut()).toMatchObject({ active: true, automatonId: id });
    expect(app().automata.some((a) => a.id === id)).toBe(true);
  });

  it('latches a walkthrough step and keeps it after the walkthrough closes', () => {
    startLesson(TEST_LESSON);
    expect(tut().current).toBe(idx('test/open'));
    convert();
    expect(tut().current).toBe(idx('test/share'));
    app().closeTrace();
    expect(tut().current).toBe(idx('test/share'));
    expect(tut().latched.has('test/open')).toBe(true);
  });

  it('counts an action only while a lesson runs, on an owned automaton', () => {
    noteLessonAction('share-link');
    startLesson(TEST_LESSON);
    expect(tut().actions.size).toBe(0);
    convert();
    app().closeTrace();
    const own = app().activeId!;
    app().setActive('mine');
    noteLessonAction('share-link');
    expect(tut().actions.size).toBe(0);
    app().setActive(own);
    noteLessonAction('share-link');
    expect(tut().actions.has('share-link')).toBe(true);
    expect(tut().current).toBe(idx('test/save'));
  });

  it('owns a DFA saved from its walkthrough, and is not elsewhere on it', () => {
    startLesson(TEST_LESSON);
    const trace = convert();
    app().addAutomaton(trace.result);
    expect(tut().owned).toHaveLength(2);
    expect(tut().owned).toContain(trace.result.id);
    expect(app().lessonIds).toEqual(tut().owned);
    expect(steps[tut().current]!.hint(tutorialContext(app(), tut().automatonId))).toBeNull();
  });

  it('does not own other automata added while its walkthrough is open', () => {
    startLesson(TEST_LESSON);
    convert();
    app().addAutomaton({ ...emptyAutomaton('Imported', 'DFA'), id: 'imported' });
    expect(tut().owned).toHaveLength(1);
    expect(app().readOnly).not.toContain('imported');
  });

  it('drops a deleted saved automaton from owned and unlocks it', () => {
    startLesson(TEST_LESSON);
    const trace = convert();
    app().addAutomaton(trace.result);
    expect(app().readOnly).toContain(trace.result.id);
    app().deleteAutomaton(trace.result.id);
    expect(tut().owned).toEqual([tut().automatonId]);
    expect(app().readOnly).toEqual(tut().owned);
    expect(app().lessonIds).toEqual(tut().owned);
    expect(tut().active).toBe(true);
  });

  it('ends when its own automaton is deleted', () => {
    startLesson(TEST_LESSON);
    app().deleteAutomaton(tut().automatonId!);
    expect(tut().active).toBe(false);
  });

  it('removes its other automata too when its own is deleted', () => {
    startLesson(TEST_LESSON);
    const own = tut().automatonId!;
    const saved = convert().result;
    app().addAutomaton(saved);
    expect(tut().owned).toEqual([own, saved.id]);
    app().deleteAutomaton(own);
    expect(tut().active).toBe(false);
    expect(app().automata.some((a) => a.id === saved.id)).toBe(false);
    expect(app().lessonIds).toEqual([]);
    expect(app().readOnly).toEqual([]);
  });

  it('locks owned automata and unlocks them when it ends', () => {
    startLesson(TEST_LESSON);
    expect(app().readOnly).toEqual(tut().owned);
    app().edit((a) => addState(a, { x: 0, y: 0 }));
    expect(active().states).toHaveLength(3);
    endLesson();
    expect(app().readOnly).toEqual([]);
  });

  it('leaves an editable lesson unlocked', () => {
    startLesson('basics');
    expect(app().readOnly).toEqual([]);
  });

  it('quit and finish both remove every owned automaton', () => {
    startLesson(TEST_LESSON);
    app().addAutomaton(convert().result);
    expect(tut().owned).toHaveLength(2);
    quitLesson();
    expect(app().automata.map((a) => a.id)).toEqual(['mine']);

    startLesson(TEST_LESSON);
    app().addAutomaton(convert().result);
    const own = tut().owned;
    expect(own).toHaveLength(2);
    finishLesson();
    for (const id of own) expect(app().automata.some((a) => a.id === id)).toBe(false);
    expect(app().automata.map((a) => a.id)).toEqual(['mine']);
    expect(app().readOnly).toEqual([]);
  });

  it('asks before replacing a lesson midway; Cancel keeps it', async () => {
    startLesson(TEST_LESSON);
    const id = tut().automatonId;
    const cancelled = requestLesson('basics');
    expect(confirmStore.getState().request).toMatchObject({
      title: 'Quit Test lesson?',
      note: 'Its automata will be removed from your history.',
      confirmLabel: 'Quit',
      danger: true,
    });
    answerConfirm(false);
    await cancelled;
    expect(tut()).toMatchObject({ lessonId: 'test', automatonId: id });

    const confirmed = requestLesson('basics');
    answerConfirm(true);
    await confirmed;
    expect(tut().lessonId).toBe('basics');
    expect(app().automata.some((a) => a.id === id)).toBe(false);
  });

  it('starts without asking from the closing card or with nothing running', async () => {
    await requestLesson('basics');
    expect(tut().lessonId).toBe('basics');
    startLesson(TEST_LESSON);
    const done = steps.length - 1;
    tutorialStore.setState({ progress: done, current: done });
    await requestLesson('basics');
    expect(confirmStore.getState().request).toBeNull();
    expect(tut().lessonId).toBe('basics');
  });

  it('pauses owned runs and walkthroughs where the step on the card says, others nowhere', () => {
    // A run trace, as if of `a`.
    const runOf = (a: Automaton): AnyTrace => ({ ...runWord(CONTAINS_01, '01'), source: a });
    const elsewhere = runOf(other());
    expect(lessonStopAt(elsewhere)).toBeNull();
    startLesson(PAUSING);
    // The step on the card has no pause point.
    expect(lessonStopAt(subsetConstruction(active()))).toBeNull();
    const trace = convert();
    expect(tut().current).toBe(1);
    expect(lessonStopAt(trace)).toBe(2);
    expect(lessonStopAt(runOf(active()))).toBeNull();
    expect(lessonStopAt(elsewhere)).toBeNull();
    app().setStep(2);
    expect(tut().current).toBe(2);
    expect(lessonStopAt(trace)).toBeNull();
    endLesson();
    expect(lessonStopAt(trace)).toBeNull();
  });

  it('Next latches the idea step and moves on', () => {
    startLesson(IDEA);
    expect(tut().current).toBe(0);
    pressNext();
    expect(tut().current).toBe(1);
    pressNext();
    expect(tut().current).toBe(1);
  });

  it("pauses a walkthrough opened during the idea step at the next step's stop", () => {
    startLesson(IDEA);
    const trace = convert();
    expect(tut().current).toBe(0);
    expect(lessonStopAt(trace)).toBe(2);
    app().setStep(2);
    pressNext();
    expect(lessonSteps(IDEA)[tut().current]!.id).toBe('idea/end');
  });

  it('opens a run paused only for a word in pausedRuns, on an owned automaton', () => {
    expect(lessonOpensPaused(runWord(CONTAINS_01, '01'))).toBe(false);
    startLesson(IDEA);
    const own = active();
    expect(lessonOpensPaused(runWord(own, '01'))).toBe(true);
    expect(lessonOpensPaused(runWord(own, '1'))).toBe(false);
    expect(lessonOpensPaused({ ...runWord(own, '01'), source: other() })).toBe(false);
    expect(lessonOpensPaused(subsetConstruction(own))).toBe(false);
  });

  it('opens a Convert to DFA walkthrough paused only in a lesson that asks, on an owned automaton', () => {
    startLesson(CONVERT_LESSON);
    expect(lessonOpensPaused(subsetConstruction(active()))).toBe(true);
    expect(lessonOpensPaused(subsetConstruction({ ...active(), id: 'someone-else' }))).toBe(false);
  });
});

/** A hand-made context on `CONTAINS_01`, owned and open. */
function ctx(more: Partial<TutorialContext> = {}): TutorialContext {
  const s = tut();
  const automaton = app().automata.find((a) => a.id === s.automatonId) ?? CONTAINS_01;
  return {
    automaton,
    isActive: true,
    trace: app().trace,
    stepIndex: app().stepIndex,
    selected: [],
    owned: s.active ? s.owned : [automaton.id],
    actions: s.actions,
    ...more,
  };
}

describe('the engine', () => {
  const none: ReadonlySet<string> = new Set();

  it('an idea step is done only once latched', () => {
    const c = ctx({ automaton: CONTAINS_01, owned: [CONTAINS_01.id] });
    expect(advance(IDEA, 0, none, c).current).toBe(0);
    expect(advance(IDEA, 0, new Set(['idea/idea']), c).current).toBe(1);
  });

  it('an idea step never asks to press Esc first', () => {
    const trace = subsetConstruction(CONTAINS_01);
    const c = ctx({ automaton: CONTAINS_01, trace, owned: [CONTAINS_01.id] });
    expect(lessonSteps(IDEA)[0]!.hint(c)).toBeNull();
  });

  it('an idea step looks ahead to the next step for pacing', () => {
    const at = (current: number) => ({ progress: current, current, latched: none });
    const c = ctx({ automaton: CONTAINS_01, owned: [CONTAINS_01.id] });
    expect(pacingStep(IDEA, at(0), c)!.id).toBe('idea/open');
    expect(pacingStep(IDEA, at(1), c)!.id).toBe('idea/open');
    expect(pacingStep(PAUSING, at(0), c)!.id).toBe('pause/open');
  });

  it('the look-ahead of an idea step lands on the step after what is on screen', () => {
    // The NFA lesson: a run of 001 opened during the idea has the first moment's pause.
    startLesson(NFA_LESSON);
    const run = runWord(active(), '001');
    app().openTrace(run);
    expect(tut().current).toBe(0);
    expect(lessonStopAt(run)).toBe(1);
    pressNext();
    expect(lessonSteps(NFA_LESSON)[tut().current]!.id).toBe('nfa/read-0');
    expect(lessonStopAt(run)).toBe(1);
  });

  it('passes explain through, null when unset', () => {
    const lesson = {
      ...TEST_LESSON,
      parts: [
        {
          ...TEST_LESSON.parts[0]!,
          steps: [{ id: 'x', instruction: () => 'Do.', explain: () => 'Look.' }],
        },
      ],
    };
    const c = ctx();
    expect(lessonSteps(lesson)[0]!.explain(c)).toBe('Look.');
    expect(lessonSteps(BASICS)[0]!.explain(c)).toBeNull();
  });

  it('is not elsewhere while a walkthrough of an owned automaton is open', () => {
    const trace = subsetConstruction(CONTAINS_01);
    const c = ctx({ automaton: CONTAINS_01, isActive: false, trace, owned: [CONTAINS_01.id] });
    expect(steps[idx('test/share')]!.hint(c)).toBeNull();
    expect(advance(TEST_LESSON, 0, none, c).current).toBe(idx('test/share'));
  });

  it('is elsewhere on an automaton it does not own', () => {
    const c = ctx({ automaton: CONTAINS_01, isActive: false, owned: [CONTAINS_01.id] });
    expect(steps[0]!.hint(c)).toEqual({ kind: 'elsewhere' });
    expect(advance(TEST_LESSON, 0, none, c)).toMatchObject({ progress: 0, current: 0 });
  });

  it('asks for Esc only before check steps, not latch or action steps', () => {
    const trace = subsetConstruction(CONTAINS_01);
    const c = ctx({ automaton: CONTAINS_01, trace, owned: [CONTAINS_01.id] });
    expect(steps[idx('test/share')]!.hint(c)).toBeNull();
    expect(steps[idx('test/save')]!.hint(c)).toBeNull();
  });

  it('latches an action once reported, and keeps it', () => {
    const c = ctx({ automaton: CONTAINS_01, owned: [CONTAINS_01.id] });
    const p = advance(TEST_LESSON, 1, new Set(['test/open']), {
      ...c,
      actions: new Set(['share-link']),
    });
    expect(p.current).toBe(idx('test/save'));
    expect(advance(TEST_LESSON, p.progress, p.latched, c).current).toBe(idx('test/save'));
  });
});
