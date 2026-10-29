import { useStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { syncAlphabet } from '../core/edit';
import { emptyAutomaton } from '../core/model';
import type { Automaton, AutomatonKind } from '../core/model';
import type { AnyTrace } from '../core/trace';
import type { Selection, Viewport } from './types';

export type { Selection, Viewport } from './types';

const HISTORY_CAP = 100;
const NO_SELECTION: Selection = { states: [], transitions: [] };

export interface AppState {
  /** Most recently edited first: edits, undo/redo, creating and adding move one to the front. */
  automata: Automaton[];
  activeId: string | null;
  selection: Selection;
  viewports: Record<string, Viewport>;
  trace: AnyTrace | null;
  stepIndex: number;
  history: Record<string, { past: Automaton[]; future: Automaton[] }>;

  /** A blank automaton named "Untitled" (or "Untitled 2", …); a DFA unless `kind` says NFA. */
  createAutomaton(kind?: AutomatonKind): string;
  addAutomaton(a: Automaton): void;
  deleteAutomaton(id: string): void;
  setActive(id: string): void;
  replaceAll(automata: Automaton[]): void;
  edit(fn: (a: Automaton) => Automaton, opts?: { record?: boolean }): void;
  checkpoint(): void;
  undo(): void;
  redo(): void;
  select(sel: Selection): void;
  setViewport(id: string, vp: Viewport): void;
  openTrace(trace: AnyTrace): void;
  setStep(i: number): void;
  closeTrace(): void;
}

type Initial = Partial<Pick<AppState, 'automata' | 'activeId'>>;

/** No kind in the name: the kind can be switched right after creating it. */
function freeName(automata: Automaton[]): string {
  const taken = new Set(automata.map((a) => a.name));
  const base = 'Untitled';
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base} ${n}`;
  return name;
}

/** Put automaton `i` first with `next` as its content (the history bar lists newest first). */
function toFront(automata: Automaton[], i: number, next: Automaton): void {
  automata.splice(i, 1);
  automata.unshift(next);
}

function initialData(
  initial: Initial,
): Pick<
  AppState,
  'automata' | 'activeId' | 'selection' | 'viewports' | 'trace' | 'stepIndex' | 'history'
> {
  const automata = initial.automata ?? [];
  return {
    automata,
    activeId: initial.activeId ?? automata[0]?.id ?? null,
    selection: NO_SELECTION,
    viewports: {},
    trace: null,
    stepIndex: 0,
    history: {},
  };
}

export function createAppStore(initial: Initial = {}): StoreApi<AppState> {
  return createStore<AppState>()(
    immer((set, get) => {
      /** Push `snapshot` onto the active history's past (capped) and clear the future. */
      const record = (id: string, snapshot: Automaton): void =>
        set((s) => {
          const h = (s.history[id] ??= { past: [], future: [] });
          h.past.push(snapshot);
          if (h.past.length > HISTORY_CAP) h.past.splice(0, h.past.length - HISTORY_CAP);
          h.future = [];
        });

      const swap = (from: 'past' | 'future', to: 'past' | 'future'): void => {
        const { activeId, trace, automata: all, history } = get();
        if (activeId === null || trace) return;
        const stack = history[activeId]?.[from];
        const current = all.find((a) => a.id === activeId);
        if (!stack || stack.length === 0 || !current) return;
        const target = stack[stack.length - 1];
        if (!target) return;
        set((s) => {
          const h = s.history[activeId];
          if (!h) return;
          h[from].pop();
          h[to].push(current);
          toFront(
            s.automata,
            s.automata.findIndex((a) => a.id === activeId),
            target,
          );
        });
      };

      return {
        ...initialData(initial),

        createAutomaton(kind = 'DFA') {
          const a = emptyAutomaton(freeName(get().automata), kind);
          set((s) => {
            s.automata.unshift(a);
            s.activeId = a.id;
            s.selection = NO_SELECTION;
            s.trace = null;
            s.stepIndex = 0;
          });
          return a.id;
        },

        addAutomaton(a) {
          set((s) => {
            s.automata.unshift(a);
            s.activeId = a.id;
            s.selection = NO_SELECTION;
            s.trace = null;
            s.stepIndex = 0;
          });
        },

        deleteAutomaton(id) {
          set((s) => {
            const i = s.automata.findIndex((a) => a.id === id);
            if (i < 0) return;
            s.automata.splice(i, 1);
            delete s.history[id];
            delete s.viewports[id];
            if (s.activeId === id) {
              s.activeId = (s.automata[i] ?? s.automata[i - 1])?.id ?? null;
              s.selection = NO_SELECTION;
              s.trace = null;
              s.stepIndex = 0;
            }
          });
        },

        setActive(id) {
          // Re-selecting the active automaton must not close an open trace.
          if (id === get().activeId) return;
          set((s) => {
            s.activeId = id;
            s.selection = NO_SELECTION;
            s.trace = null;
            s.stepIndex = 0;
          });
        },

        replaceAll(next) {
          set((s) => {
            s.automata = next;
            s.activeId = next[0]?.id ?? null;
            s.history = {};
            s.trace = null;
            s.stepIndex = 0;
            s.selection = NO_SELECTION;
          });
        },

        edit(fn, opts) {
          const { activeId, trace, automata: all } = get();
          if (activeId === null || trace) return;
          const current = all.find((a) => a.id === activeId);
          if (!current) return;
          // The alphabet is derived from the transitions (there is no alphabet editor).
          const next = syncAlphabet(fn(current));
          if (opts?.record ?? true) record(activeId, current);
          set((s) => {
            toFront(
              s.automata,
              s.automata.findIndex((a) => a.id === activeId),
              next,
            );
          });
        },

        checkpoint() {
          const { activeId, trace, automata: all } = get();
          if (activeId === null || trace) return;
          const current = all.find((a) => a.id === activeId);
          if (current) record(activeId, current);
        },

        undo: () => swap('past', 'future'),
        redo: () => swap('future', 'past'),

        select(sel) {
          set((s) => {
            s.selection = sel;
          });
        },

        setViewport(id, vp) {
          set((s) => {
            s.viewports[id] = vp;
          });
        },

        openTrace(trace) {
          set((s) => {
            s.trace = trace;
            s.stepIndex = 0;
            s.selection = NO_SELECTION;
          });
        },

        setStep(i) {
          const { trace } = get();
          if (!trace) return;
          const max = trace.steps.length - 1;
          set((s) => {
            s.stepIndex = Math.min(Math.max(i, 0), max);
          });
        },

        closeTrace() {
          set((s) => {
            s.trace = null;
            s.stepIndex = 0;
          });
        },
      };
    }),
  );
}

export const appStore: StoreApi<AppState> = createAppStore();

/**
 * Subscribe to the app store. Selectors must return stable references: select existing state
 * or primitives, and wrap derived objects/arrays with `useShallow` from `zustand/react/shallow`.
 * A selector that builds a fresh object each call re-renders forever.
 */
export const useAppStore = <T>(selector: (s: AppState) => T): T => useStore(appStore, selector);

export function resetAppStore(initial: Initial = {}): void {
  appStore.setState(initialData(initial));
}
