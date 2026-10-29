import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { renameAutomaton } from '../../core/edit';
import { appStore, freeName } from '../../store/store';
import type { AppState } from '../../store/store';
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
  /** What the last completed step did, shown as "✓ …". */
  confirmation: string | null;
}

const NOTHING: ReadonlySet<StepId> = new Set();

const OFF: TutorialState = {
  active: false,
  automatonId: null,
  progress: 0,
  current: 0,
  latched: NOTHING,
  confirmation: null,
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
  const next = advance(t.progress, t.latched, ctx);
  const done = next.completed === null ? null : STEPS.find((s) => s.id === next.completed);
  const confirmation = done ? done.confirmation(ctx) : t.confirmation;
  if (
    next.progress !== t.progress ||
    next.current !== t.current ||
    next.latched !== t.latched ||
    confirmation !== t.confirmation
  ) {
    tutorialStore.setState({
      progress: next.progress,
      current: next.current,
      latched: next.latched,
      confirmation,
    });
  }
}

/**
 * Start (or restart) the tutorial on a DFA named "Tutorial": the active automaton if it has no
 * states yet (so a first visit leaves no empty "Untitled" behind), else a new one.
 */
export function startTutorial(): void {
  endTutorial();
  const app = appStore.getState();
  app.closeTrace();
  const current = app.automata.find((a) => a.id === app.activeId);
  const reuse = current !== undefined && current.states.length === 0;
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

/** Stop following the app. The tutorial automaton stays like any other. */
export function endTutorial(): void {
  unsubscribe?.();
  unsubscribe = null;
  tutorialStore.setState(OFF);
}
