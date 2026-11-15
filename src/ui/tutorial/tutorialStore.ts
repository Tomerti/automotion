import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { renameAutomaton } from '../../core/edit';
import { emptyAutomaton } from '../../core/model';
import type { Automaton } from '../../core/model';
import { appStore, freeName } from '../../store/store';
import type { AppState } from '../../store/store';
import { fitActive } from '../canvas/useCanvasEditing';
import { playFanfareSound } from '../player/sound';
import { advance, lessonSteps } from './engine';
import type { LessonAction, LessonId, TutorialContext } from './engine';
import { lessonById } from './lessons';

export interface TutorialState {
  active: boolean;
  /** The lesson running. */
  lessonId: LessonId | null;
  automatonId: string | null;
  /** The furthest step reached (index into `lessonSteps`). */
  progress: number;
  /** The step on the card. */
  current: number;
  /** Run steps that reached their verdict. */
  latched: ReadonlySet<string>;
  /** The lesson finished just now: the congratulations popup is open. */
  celebrating: LessonId | null;
}

const NOTHING: ReadonlySet<string> = new Set();
const NO_ACTIONS: ReadonlySet<LessonAction> = new Set();

const OFF: TutorialState = {
  active: false,
  lessonId: null,
  automatonId: null,
  progress: 0,
  current: 0,
  latched: NOTHING,
  celebrating: null,
};

export const tutorialStore: StoreApi<TutorialState> = createStore<TutorialState>()(() => OFF);

/** Same rule as `useAppStore`: selectors must return stable references. */
export const useTutorial = <T>(selector: (s: TutorialState) => T): T =>
  useStore(tutorialStore, selector);

export function tutorialContext(app: AppState, automatonId: string | null): TutorialContext {
  return {
    automaton: app.automata.find((a) => a.id === automatonId),
    isActive: automatonId !== null && app.activeId === automatonId,
    trace: app.trace,
    stepIndex: app.stepIndex,
    selected: app.selection.states,
    owned: automatonId === null ? [] : [automatonId],
    actions: NO_ACTIONS,
  };
}

let unsubscribe: (() => void) | null = null;

function follow(app: AppState): void {
  const t = tutorialStore.getState();
  if (!t.active || t.lessonId === null) return;
  const ctx = tutorialContext(app, t.automatonId);
  if (!ctx.automaton) {
    endLesson();
    return;
  }
  const next = advance(lessonById(t.lessonId), t.progress, t.latched, ctx, t.current);
  if (next.progress !== t.progress || next.current !== t.current || next.latched !== t.latched) {
    tutorialStore.setState({
      progress: next.progress,
      current: next.current,
      latched: next.latched,
    });
  }
}

/**
 * A blank automaton as Create made it: no states, a default name and nothing to undo or redo
 * (undo would otherwise bring the user's old content back into the tutorial).
 */
function untouched(app: AppState, a: Automaton): boolean {
  const h = app.history[a.id];
  return (
    a.states.length === 0 &&
    /^Untitled( \d+)?$/.test(a.name) &&
    !h?.past.length &&
    !h?.future.length
  );
}

/** The running lesson is on its closing card. */
function onClosingCard(t: TutorialState): boolean {
  if (t.lessonId === null) return false;
  const lesson = lessonById(t.lessonId);
  return (lessonSteps(lesson)[t.current]?.part ?? 0) > lesson.parts.length;
}

/**
 * Start (or restart) a lesson. Basics opens on a DFA named "Tutorial": the active automaton if it
 * is untouched (so a first visit leaves no empty "Untitled" behind), else a new one. Starting
 * removes an unfinished lesson's automaton, as quitting does.
 */
export function startLesson(id: LessonId): void {
  // A finished one stays, as with Finish.
  if (onClosingCard(tutorialStore.getState())) endLesson();
  else quitLesson();
  const app = appStore.getState();
  app.closeTrace();
  const current = app.automata.find((a) => a.id === app.activeId);
  const reuse = current !== undefined && untouched(app, current);
  const automatonId = reuse ? current.id : app.createAutomaton('DFA');
  const others = appStore.getState().automata.filter((a) => a.id !== automatonId);
  const name = freeName(others, 'Tutorial');
  appStore
    .getState()
    .edit((a) => ({ ...renameAutomaton(a, name), kind: 'DFA' }), { record: false });
  tutorialStore.setState({ ...OFF, active: true, lessonId: id, automatonId });
  unsubscribe = appStore.subscribe(follow);
  follow(appStore.getState());
}

/**
 * Quit midway: end the lesson and remove its automaton from the history. The canvas is never
 * left without an automaton.
 */
export function quitLesson(): void {
  const id = tutorialStore.getState().automatonId;
  endLesson();
  if (id === null) return;
  const app = appStore.getState();
  app.deleteAutomaton(id);
  if (appStore.getState().automata.length === 0)
    app.addAutomaton(emptyAutomaton('Untitled', 'DFA'));
}

/**
 * Finish from the closing card: the lesson's automaton stays, the run that ended the lesson
 * closes, back to editing, the view fits what is left (one state, wherever q0 was drawn), and
 * the congratulations popup opens.
 */
export function finishLesson(): void {
  const { automatonId: id, lessonId } = tutorialStore.getState();
  endLesson();
  const app = appStore.getState();
  if (app.trace && app.trace.source.id === id) app.closeTrace();
  tutorialStore.setState({ celebrating: lessonId });
  playFanfareSound();
  // Once the editing canvas is back on screen, so the fit has its size.
  requestAnimationFrame(() => {
    if (appStore.getState().activeId === id) fitActive();
  });
}

export function closeCelebration(): void {
  tutorialStore.setState({ celebrating: null });
}

/** Stop following the app. The lesson's automaton stays like any other (Finish keeps it). */
export function endLesson(): void {
  unsubscribe?.();
  unsubscribe = null;
  tutorialStore.setState(OFF);
}
