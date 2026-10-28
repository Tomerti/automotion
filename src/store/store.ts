import { useStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { emptyAutomaton } from '../core/model';
import type { Automaton, AutomatonKind } from '../core/model';
import type { AnyTrace } from '../core/trace';
import type { Selection, Viewport } from './types';

export type { Selection, Viewport } from './types';

const HISTORY_CAP = 100;
const NO_SELECTION: Selection = { states: [], transitions: [] };

export interface AppState {
  automata: Automaton[];
  activeId: string | null;
  selection: Selection;
  viewports: Record<string, Viewport>;
  trace: AnyTrace | null;
  stepIndex: number;
  history: Record<string, { past: Automaton[]; future: Automaton[] }>;

  createAutomaton(kind: AutomatonKind): string;
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

function freeName(kind: AutomatonKind, automata: Automaton[]): string {
  const taken = new Set(automata.map((a) => a.name));
  const base = `Untitled ${kind}`;
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base} ${n}`;
  return name;
}

function initialData(initial: Initial): Pick<
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
          const i = s.automata.findIndex((a) => a.id === activeId);
          s.automata[i] = target;
        });
      };

      return {
        ...initialData(initial),

        createAutomaton(kind) {
          const a = emptyAutomaton(freeName(kind, get().automata), kind);
          set((s) => {
            s.automata.push(a);
            s.activeId = a.id;
            s.selection = NO_SELECTION;
          });
          return a.id;
        },

        addAutomaton(a) {
          set((s) => {
            s.automata.push(a);
            s.activeId = a.id;
            s.selection = NO_SELECTION;
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
          set((s) => {
            s.activeId = id;
            s.selection = NO_SELECTION;
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
          const next = fn(current);
          if (opts?.record ?? true) record(activeId, current);
          set((s) => {
            const i = s.automata.findIndex((a) => a.id === activeId);
            s.automata[i] = next;
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

export const useAppStore = <T>(selector: (s: AppState) => T): T => useStore(appStore, selector);

export function resetAppStore(initial: Initial = {}): void {
  appStore.setState(initialData(initial));
}
