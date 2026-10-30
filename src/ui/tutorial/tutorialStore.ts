import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { renameAutomaton } from '../../core/edit';
import { emptyAutomaton } from '../../core/model';
import type { Automaton } from '../../core/model';
import { appStore, freeName } from '../../store/store';
import type { AppState } from '../../store/store';
import { fitActive } from '../canvas/useCanvasEditing';
import { playFanfareSound, playTickSound } from '../player/sound';
import { advance, STEPS } from './steps';
import type { StepId, TutorialContext } from './steps';

export interface TutorialState {
  active: boolean;
  automatonId: string | null;
  /** The furthest step reached (index into `STEPS`). */
  progress: number;
  /** The step on the card. */
  current: number;
  /** Run steps that reached their verdict. */
  latched: ReadonlySet<StepId>;
  /** Finished just now: the congratulations popup is open. */
  celebrating: boolean;
}

const NOTHING: ReadonlySet<StepId> = new Set();

const OFF: TutorialState = {
  active: false,
  automatonId: null,
  progress: 0,
  current: 0,
  latched: NOTHING,
  celebrating: false,
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
  };
}

let unsubscribe: (() => void) | null = null;

function follow(app: AppState): void {
  const t = tutorialStore.getState();
  if (!t.active) return;
  const ctx = tutorialContext(app, t.automatonId);
  if (!ctx.automaton) {
    endTutorial();
    return;
  }
  const next = advance(t.progress, t.latched, ctx, t.current);
  if (next.progress !== t.progress || next.current !== t.current || next.latched !== t.latched) {
    // A step ticked off (a first time, or again after falling back).
    if (next.current > t.current || next.progress > t.progress) playTickSound();
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

/**
 * Start (or restart) the tutorial on a DFA named "Tutorial": the active automaton if it is
 * untouched (so a first visit leaves no empty "Untitled" behind), else a new one. A restart
 * removes the unfinished one, as quitting does.
 */
export function startTutorial(): void {
  // A finished one stays, as with Finish.
  if (STEPS[tutorialStore.getState().current]?.part === 3) endTutorial();
  else quitTutorial();
  const app = appStore.getState();
  app.closeTrace();
  const current = app.automata.find((a) => a.id === app.activeId);
  const reuse = current !== undefined && untouched(app, current);
  const id = reuse ? current.id : app.createAutomaton('DFA');
  const others = appStore.getState().automata.filter((a) => a.id !== id);
  const name = freeName(others, 'Tutorial');
  appStore
    .getState()
    .edit((a) => ({ ...renameAutomaton(a, name), kind: 'DFA' }), { record: false });
  tutorialStore.setState({ ...OFF, active: true, automatonId: id });
  unsubscribe = appStore.subscribe(follow);
  follow(appStore.getState());
}

/**
 * Quit midway: end the tutorial and remove its automaton from the history. The canvas is never
 * left without an automaton.
 */
export function quitTutorial(): void {
  const id = tutorialStore.getState().automatonId;
  endTutorial();
  if (id === null) return;
  const app = appStore.getState();
  app.deleteAutomaton(id);
  if (appStore.getState().automata.length === 0)
    app.addAutomaton(emptyAutomaton('Untitled', 'DFA'));
}

/**
 * Finish from the closing card: the tutorial automaton stays, the run that ended the tutorial
 * closes, back to editing, the view fits what is left (one state, wherever q0 was drawn), and
 * the congratulations popup opens.
 */
export function finishTutorial(): void {
  const id = tutorialStore.getState().automatonId;
  endTutorial();
  const app = appStore.getState();
  if (app.trace && app.trace.source.id === id) app.closeTrace();
  tutorialStore.setState({ celebrating: true });
  playFanfareSound();
  // Once the editing canvas is back on screen, so the fit has its size.
  requestAnimationFrame(() => {
    if (appStore.getState().activeId === id) fitActive();
  });
}

export function closeCelebration(): void {
  tutorialStore.setState({ celebrating: false });
}

/** Stop following the app. The tutorial automaton stays like any other (Finish keeps it). */
export function endTutorial(): void {
  unsubscribe?.();
  unsubscribe = null;
  tutorialStore.setState(OFF);
}
