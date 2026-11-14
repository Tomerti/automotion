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
import { advance, PART3_NFA, STEPS } from './steps';
import type { StepId, TutorialContext } from './steps';

export interface TutorialState {
  active: boolean;
  automatonId: string | null;
  /** The furthest step reached (index into `STEPS`). */
  progress: number;
  /** The step on the card. */
  current: number;
  /** Run steps that reached their verdict, and part 3's walkthrough steps once reached. */
  latched: ReadonlySet<StepId>;
  /**
   * The DFA from the tutorial's conversion (part 3): the id Save and minimize saves it under, so
   * its minimization counts as the tutorial's. Cleared once that DFA is gone (deleted, or never
   * saved before the conversion closed).
   */
  derivedId: string | null;
  /** Part 3 has replaced the tutorial automaton with its NFA (once: undo is the user's). */
  nfaLoaded: boolean;
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
  derivedId: null,
  nfaLoaded: false,
  celebrating: false,
};

export const tutorialStore: StoreApi<TutorialState> = createStore<TutorialState>()(() => OFF);

/** Same rule as `useAppStore`: selectors must return stable references. */
export const useTutorial = <T>(selector: (s: TutorialState) => T): T =>
  useStore(tutorialStore, selector);

export function tutorialContext(
  app: AppState,
  automatonId: string | null,
  derivedId: string | null,
): TutorialContext {
  return {
    automaton: app.automata.find((a) => a.id === automatonId),
    isActive: automatonId !== null && app.activeId === automatonId,
    trace: app.trace,
    stepIndex: app.stepIndex,
    selected: app.selection.states,
    derivedId,
    derivedActive: derivedId !== null && app.activeId === derivedId,
  };
}

/**
 * The DFA part 3 works on after the conversion: the result of the tutorial's conversion while it
 * is open (Save and minimize saves it under that id), kept while that DFA exists.
 */
function derivedOf(app: AppState, automatonId: string | null, known: string | null): string | null {
  const t = app.trace;
  if (t?.kind === 'subset' && automatonId !== null && t.source.id === automatonId) {
    return t.result.id;
  }
  return known !== null && app.automata.some((a) => a.id === known) ? known : null;
}

let unsubscribe: (() => void) | null = null;

function follow(app: AppState): void {
  const t = tutorialStore.getState();
  if (!t.active) return;
  // Recorded in the same call that first sees the conversion, so the steps that follow already
  // know the saved DFA's minimization is the tutorial's.
  const derivedId = derivedOf(app, t.automatonId, t.derivedId);
  const ctx = tutorialContext(app, t.automatonId, derivedId);
  if (!ctx.automaton) {
    endTutorial();
    return;
  }
  const next = advance(t.progress, t.latched, ctx, t.current);
  if (
    next.progress !== t.progress ||
    next.current !== t.current ||
    next.latched !== t.latched ||
    derivedId !== t.derivedId
  ) {
    tutorialStore.setState({
      progress: next.progress,
      current: next.current,
      latched: next.latched,
      derivedId,
    });
  }
  // Part 3 starts once part 2's last run is closed: its NFA replaces the tutorial automaton.
  if (STEPS[next.current]?.id === 'convert' && !t.nfaLoaded && app.trace === null && ctx.isActive) {
    // Before the edit, which calls back in here.
    tutorialStore.setState({ nfaLoaded: true });
    // One undo step: the part-2 automaton is a Ctrl + Z away.
    appStore.getState().edit((a) => ({ ...PART3_NFA, id: a.id, name: a.name }));
    requestAnimationFrame(fitActive);
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
  if (STEPS[tutorialStore.getState().current]?.part === 4) endTutorial();
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
 * Finish from the closing card: the tutorial automaton (and the DFA saved from it) stay, the
 * walkthrough that ended the tutorial closes, back to editing, the view fits what is open, and
 * the congratulations popup opens.
 */
export function finishTutorial(): void {
  const { automatonId, derivedId } = tutorialStore.getState();
  const ours = (id: string | null | undefined): boolean =>
    id != null && (id === automatonId || id === derivedId);
  endTutorial();
  const app = appStore.getState();
  if (app.trace && ours(app.trace.source.id)) app.closeTrace();
  tutorialStore.setState({ celebrating: true });
  playFanfareSound();
  // Once the editing canvas is back on screen, so the fit has its size.
  requestAnimationFrame(() => {
    if (ours(appStore.getState().activeId)) fitActive();
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
