import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { renameAutomaton } from '../../core/edit';
import { newId } from '../../core/id';
import { emptyAutomaton } from '../../core/model';
import type { Automaton } from '../../core/model';
import type { AnyTrace } from '../../core/trace';
import { appStore, freeName } from '../../store/store';
import type { AppState } from '../../store/store';
import { fitActive } from '../canvas/useCanvasEditing';
import { playFanfareSound } from '../player/sound';
import { askConfirm } from '../shell/confirmStore';
import { advance, lessonSteps, ownsId, pacingStep } from './engine';
import type { Lesson, LessonAction, LessonId, TutorialContext } from './engine';
import { lessonById } from './lessons';
import { isLessonId, markLessonFinished } from './lessonsDone';

export interface TutorialState {
  active: boolean;
  /** The lesson running. */
  lessonId: Lesson['id'] | null;
  /** The lesson running, as passed to `startLesson` (tests run lessons that aren't listed). */
  lesson: Lesson | null;
  /** The lesson's own automaton: the lesson ends if it is deleted. */
  automatonId: string | null;
  /**
   * The automata the lesson owns: its own, then any saved from a walkthrough of an owned one.
   * Read-only while a lesson that isn't `editable` runs. Quit and Finish both remove them, as does
   * deleting the lesson's own automaton midway. Mirrored to the app store's `lessonIds`, so they
   * are never autosaved.
   */
  owned: string[];
  /** The furthest step reached (index into `lessonSteps`). */
  progress: number;
  /** The step on the card. */
  current: number;
  /** Run, latch and action steps that happened. */
  latched: ReadonlySet<string>;
  /** Actions reported on an owned automaton since the lesson started. */
  actions: ReadonlySet<LessonAction>;
  /**
   * The lesson's own automaton right after its last Tidy, undefined before one; the Arrange
   * lesson's checks compare against it (see `noteTidied`).
   */
  tidied: Automaton | undefined;
  /**
   * The app's `blockedEdits` when the step on the card last changed: the card says the
   * automaton is read-only while more edits than this have been refused.
   */
  blockedSeen: number;
  /** The lesson finished just now: the congratulations popup is open. */
  celebrating: Lesson | null;
}

const NOTHING: ReadonlySet<string> = new Set();
const NO_ACTIONS: ReadonlySet<LessonAction> = new Set();

const OFF: TutorialState = {
  active: false,
  lessonId: null,
  lesson: null,
  automatonId: null,
  owned: [],
  progress: 0,
  current: 0,
  latched: NOTHING,
  actions: NO_ACTIONS,
  tidied: undefined,
  blockedSeen: 0,
  celebrating: null,
};

export const tutorialStore: StoreApi<TutorialState> = createStore<TutorialState>()(() => OFF);

/** Same rule as `useAppStore`: selectors must return stable references. */
export const useTutorial = <T>(selector: (s: TutorialState) => T): T =>
  useStore(tutorialStore, selector);

export function tutorialContext(
  app: AppState,
  automatonId: string | null,
  t: Pick<TutorialState, 'owned' | 'actions' | 'tidied'> = tutorialStore.getState(),
): TutorialContext {
  return {
    automaton: app.automata.find((a) => a.id === automatonId),
    isActive: app.activeId !== null && t.owned.includes(app.activeId),
    trace: app.trace,
    stepIndex: app.stepIndex,
    selected: app.selection.states,
    owned: t.owned,
    actions: t.actions,
    tidied: t.tidied,
  };
}

let unsubscribe: (() => void) | null = null;

/**
 * `owned` after the change from `prev` to `app`: plus what was saved from a walkthrough of an
 * owned automaton (the walkthrough's result, added as it closes) when `grows`, less what is gone.
 * Only a lesson that opens on a `start` automaton grows: Basics owns just its own.
 */
function nextOwned(owned: string[], app: AppState, prev: AppState, grows: boolean): string[] {
  const t = prev.trace;
  let next = owned;
  if (grows && t && t.kind !== 'run' && ownsId(owned, t)) {
    const saved = t.result.id;
    const isNew = !prev.automata.some((a) => a.id === saved);
    if (isNew && !owned.includes(saved) && app.automata.some((a) => a.id === saved)) {
      next = [...owned, saved];
    }
  }
  const kept = next.filter((id) => app.automata.some((a) => a.id === id));
  return kept.length === next.length ? next : kept;
}

/**
 * Set `owned`, mirrored to the app's `lessonIds` (so autosave leaves them out), and locking
 * exactly those automata while a lesson that isn't editable runs.
 */
function setOwned(owned: string[]): void {
  tutorialStore.setState({ owned });
  appStore.getState().setLessonIds(owned);
  if (tutorialStore.getState().lesson?.editable === false) appStore.getState().setReadOnly(owned);
}

function follow(app: AppState, prev: AppState): void {
  const t = tutorialStore.getState();
  if (!t.active || !t.lesson) return;
  if (!app.automata.some((a) => a.id === t.automatonId)) {
    // Its other automata would become ordinary, autosaved ones: remove them, as Quit does.
    // `endLesson` unsubscribes first, so removing them doesn't come back in here.
    const rest = t.owned.filter((id) => id !== t.automatonId);
    endLesson();
    removeAutomata(rest);
    return;
  }
  const owned = nextOwned(t.owned, app, prev, t.lesson.start !== null);
  // Locking them calls back in here first, with `owned` up to date; moving on again is a no-op.
  if (owned !== t.owned) setOwned(owned);
  moveOn(appStore.getState());
}

/** Move through the steps done in `app`. */
function moveOn(app: AppState): void {
  const t = tutorialStore.getState();
  if (!t.active || !t.lesson) return;
  const ctx = tutorialContext(app, t.automatonId, t);
  const next = advance(t.lesson, t.progress, t.latched, ctx, t.current);
  if (next.progress !== t.progress || next.current !== t.current || next.latched !== t.latched) {
    tutorialStore.setState({
      progress: next.progress,
      current: next.current,
      latched: next.latched,
      ...(next.current !== t.current ? { blockedSeen: app.blockedEdits } : {}),
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
  if (!t.lesson) return false;
  return (lessonSteps(t.lesson)[t.current]?.part ?? 0) > t.lesson.parts.length;
}

/** Basics' automaton: a DFA named "Tutorial", reusing an untouched active automaton. */
function openBlank(): string {
  const app = appStore.getState();
  const current = app.automata.find((a) => a.id === app.activeId);
  const reuse = current !== undefined && untouched(app, current);
  const automatonId = reuse ? current.id : app.createAutomaton('DFA');
  const others = appStore.getState().automata.filter((a) => a.id !== automatonId);
  const name = freeName(others, 'Tutorial');
  appStore
    .getState()
    .edit((a) => ({ ...renameAutomaton(a, name), kind: 'DFA' }), { record: false });
  return automatonId;
}

/** A copy of `start` under a free name made from its own, opened and fitted below the card. */
function openCopy(start: Automaton): string {
  const app = appStore.getState();
  // An untouched "Untitled" is replaced, as Basics reuses it, so none is left behind.
  const current = app.automata.find((a) => a.id === app.activeId);
  if (current !== undefined && untouched(app, current)) app.deleteAutomaton(current.id);
  const copy: Automaton = {
    ...start,
    id: newId(),
    name: freeName(appStore.getState().automata, start.name),
  };
  appStore.getState().addAutomaton(copy);
  // Once the card is on screen, so the fit keeps clear of it.
  requestAnimationFrame(() => {
    if (appStore.getState().activeId === copy.id) fitActive();
  });
  return copy.id;
}

/**
 * Start (or restart) a lesson: by id from the UI, or a lesson object (the tests' own lessons).
 * Basics opens on a DFA named "Tutorial": the active automaton if it is untouched (so a first
 * visit leaves no empty "Untitled" behind), else a new one. A lesson with a `start` automaton
 * opens a copy of it (replacing an untouched active automaton). Starting removes the previous
 * lesson's automata, finished or not, as quitting does.
 */
export function startLesson(which: LessonId | Lesson): void {
  // Before anything changes: an unknown id throws here.
  const lesson = typeof which === 'string' ? lessonById(which) : which;
  quitLesson();
  appStore.getState().closeTrace();
  const automatonId = lesson.start ? openCopy(lesson.start) : openBlank();
  tutorialStore.setState({
    ...OFF,
    active: true,
    lessonId: lesson.id,
    lesson,
    automatonId,
    owned: [automatonId],
    blockedSeen: appStore.getState().blockedEdits,
  });
  setOwned([automatonId]);
  unsubscribe = appStore.subscribe(follow);
  moveOn(appStore.getState());
}

/**
 * Start lesson `id` from the UI: if another lesson is midway, ask first, since starting removes
 * its automata. The same lesson restarts without asking, as does one on its closing card.
 */
export async function requestLesson(id: LessonId): Promise<void> {
  const t = tutorialStore.getState();
  if (t.active && t.lesson && t.lesson.id !== id && !onClosingCard(t)) {
    const ok = await askConfirm({
      title: `Quit ${t.lesson.title}?`,
      note: 'Its automata will be removed from your history.',
      confirmLabel: 'Quit',
      danger: true,
    });
    if (!ok) return;
  }
  startLesson(id);
}

/**
 * Report an action the state doesn't show (a link copied, a picture exported): it counts for
 * the lesson's action steps when a lesson runs and the open automaton is one it owns.
 */
export function noteLessonAction(action: LessonAction): void {
  const t = tutorialStore.getState();
  const app = appStore.getState();
  if (!t.active || app.activeId === null || !t.owned.includes(app.activeId)) return;
  if (t.actions.has(action)) return;
  tutorialStore.setState({ actions: new Set([...t.actions, action]) });
  moveOn(app);
}

/**
 * Report a finished Tidy: when a lesson runs and the open automaton is its own, remember the
 * automaton as Tidy left it and count the `tidy` action (every time, not only the first).
 */
export function noteTidied(): void {
  const t = tutorialStore.getState();
  const app = appStore.getState();
  if (!t.active || app.activeId === null || app.activeId !== t.automatonId) return;
  const tidied = app.automata.find((a) => a.id === app.activeId);
  if (!tidied) return;
  tutorialStore.setState({ tidied, actions: new Set([...t.actions, 'tidy']) });
  moveOn(app);
}

/**
 * Where playback of `trace` pauses on its way to the end: the step on the card's `pauseAt`, for a
 * run or walkthrough of an automaton the running lesson owns; null otherwise.
 */
export function lessonStopAt(
  trace: AnyTrace,
  t: TutorialState = tutorialStore.getState(),
): number | null {
  if (!t.active || !t.lesson || !ownsId(t.owned, trace)) return null;
  const ctx = { ...tutorialContext(appStore.getState(), t.automatonId, t), trace };
  const pauseAt = pacingStep(t.lesson, t, ctx)?.pauseAt;
  return pauseAt ? pauseAt(ctx) : null;
}

/**
 * `trace` opens paused: it is of an automaton the running lesson owns, and either a run of a word
 * in the lesson's `pausedRuns` or a Convert to DFA walkthrough in a lesson with `pausedConvert`.
 */
export function lessonOpensPaused(
  trace: AnyTrace,
  t: TutorialState = tutorialStore.getState(),
): boolean {
  if (!t.active || !t.lesson || !ownsId(t.owned, trace)) return false;
  if (trace.kind === 'subset') return t.lesson.pausedConvert === true;
  return trace.kind === 'run' && (t.lesson.pausedRuns?.includes(trace.word) ?? false);
}

/** Next on an idea step: latch it and move on. Does nothing on any other step. */
export function pressNext(): void {
  const t = tutorialStore.getState();
  if (!t.active || !t.lesson) return;
  const step = lessonSteps(t.lesson)[t.current];
  if (!step?.idea) return;
  tutorialStore.setState({ latched: new Set([...t.latched, step.id]) });
  moveOn(appStore.getState());
}

/**
 * Quit midway: end the lesson and remove its automata from the history. The canvas is never
 * left without an automaton.
 */
export function quitLesson(): void {
  const { owned } = tutorialStore.getState();
  endLesson();
  removeAutomata(owned);
}

/** Remove `ids` from the history, never leaving the canvas without an automaton. */
function removeAutomata(ids: readonly string[]): void {
  if (ids.length === 0) return;
  const app = appStore.getState();
  for (const id of ids) app.deleteAutomaton(id);
  if (appStore.getState().automata.length === 0)
    app.addAutomaton(emptyAutomaton('Untitled', 'DFA'));
}

/**
 * Finish from the closing card: the run or walkthrough that ended the lesson closes, back to
 * editing, and the congratulations popup opens. A lesson leaves nothing behind: its automata are
 * removed, leaving the user's own, or a blank Untitled.
 */
export function finishLesson(): void {
  const { owned, lesson } = tutorialStore.getState();
  endLesson();
  if (lesson && isLessonId(lesson.id)) markLessonFinished(lesson.id);
  const app = appStore.getState();
  if (app.trace && ownsId(owned, app.trace)) app.closeTrace();
  removeAutomata(owned);
  tutorialStore.setState({ celebrating: lesson });
  playFanfareSound();
}

export function closeCelebration(): void {
  tutorialStore.setState({ celebrating: null });
}

/**
 * Stop following the app and unlock its automata, which become ordinary ones. `quitLesson`,
 * `finishLesson` and `follow` (the lesson's own automaton was deleted) call it, then remove the
 * automata; tests also call it directly.
 */
export function endLesson(): void {
  unsubscribe?.();
  unsubscribe = null;
  const wasActive = tutorialStore.getState().active;
  tutorialStore.setState(OFF);
  if (wasActive) {
    appStore.getState().setReadOnly([]);
    appStore.getState().setLessonIds([]);
  }
}
