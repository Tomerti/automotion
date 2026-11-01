import { useStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { clipCenter, copyStates, internalTransitions, pasteClip } from '../core/clipboard';
import type { Clip } from '../core/clipboard';
import { syncAlphabet } from '../core/edit';
import { newId } from '../core/id';
import { emptyAutomaton } from '../core/model';
import type { Automaton, AutomatonKind } from '../core/model';
import type { AnyTrace } from '../core/trace';
import type { Selection, Viewport } from './types';

export type { Selection, Viewport } from './types';

const HISTORY_CAP = 100;
const NO_SELECTION: Selection = { states: [], transitions: [] };
/** World px between a paste and the next one pasted at the same place. */
export const PASTE_STEP = 40;

/**
 * What Ctrl+C copied (in memory only, never saved), and where the last paste went: pasting again
 * at the same place (or again without a place) steps `repeat` times further along.
 */
interface Clipboard {
  clip: Clip;
  last: { at: { x: number; y: number } | null; repeat: number } | null;
}

export interface AppState {
  /** Most recently edited first: edits, undo/redo, creating and adding move one to the front. */
  automata: Automaton[];
  activeId: string | null;
  selection: Selection;
  viewports: Record<string, Viewport>;
  trace: AnyTrace | null;
  stepIndex: number;
  history: Record<string, { past: Automaton[]; future: Automaton[] }>;
  clipboard: Clipboard | null;

  /** A blank automaton named "Untitled" (or "Untitled 2", …); a DFA unless `kind` says NFA. */
  createAutomaton(kind?: AutomatonKind): string;
  addAutomaton(a: Automaton): void;
  /**
   * Add a copy of automaton `id` named "X copy" (or "X copy 2", …) with its own undo history,
   * and open it like `addAutomaton`, in the same view. `null` if there is no such automaton.
   */
  duplicateAutomaton(id: string): string | null;
  deleteAutomaton(id: string): void;
  setActive(id: string): void;
  replaceAll(automata: Automaton[]): void;
  edit(fn: (a: Automaton) => Automaton, opts?: { record?: boolean }): void;
  checkpoint(): void;
  undo(): void;
  redo(): void;
  select(sel: Selection): void;
  /** Copy the selected states of the active automaton (Ctrl+C); false if none is selected. */
  copySelection(): boolean;
  /**
   * Paste what was copied into the active automaton as one undo step, centred on `at` (world
   * coordinates), or a step down and right of where it was copied from; the pasted states and
   * the arrows between them become the selection. `promoted`: an ε-arrow turned a DFA into an
   * NFA. `null` when nothing was copied or a trace is open.
   */
  paste(at?: { x: number; y: number }): { promoted: boolean } | null;
  setViewport(id: string, vp: Viewport): void;
  openTrace(trace: AnyTrace): void;
  setStep(i: number): void;
  closeTrace(): void;
}

type Initial = Partial<Pick<AppState, 'automata' | 'activeId'>>;

/**
 * `base`, or `base 2`, `base 3`, … if taken. No kind in the name: the kind can be switched right
 * after creating it.
 */
export function freeName(automata: Automaton[], base = 'Untitled'): string {
  const taken = new Set(automata.map((a) => a.name));
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
  | 'automata'
  | 'activeId'
  | 'selection'
  | 'viewports'
  | 'trace'
  | 'stepIndex'
  | 'history'
  | 'clipboard'
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
    clipboard: null,
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

        duplicateAutomaton(id) {
          const { automata, viewports } = get();
          const original = automata.find((a) => a.id === id);
          if (!original) return null;
          // A copy of "X copy 2" is "X copy 3", not "X copy 2 copy".
          const base = `${original.name.replace(/ copy(?: \d+)?$/, '')} copy`;
          const copy: Automaton = { ...original, id: newId(), name: freeName(automata, base) };
          const viewport = viewports[id];
          get().addAutomaton(copy);
          if (viewport) {
            set((s) => {
              s.viewports[copy.id] = viewport;
            });
          }
          return copy.id;
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

        copySelection() {
          const { activeId, automata: all, selection } = get();
          const current = all.find((a) => a.id === activeId);
          const clip = current ? copyStates(current, selection.states) : null;
          if (!clip) return false;
          set((s) => {
            s.clipboard = { clip, last: null };
          });
          return true;
        },

        paste(at) {
          const { activeId, trace, automata: all, clipboard } = get();
          const current = all.find((a) => a.id === activeId);
          if (!clipboard || trace || !current) return null;
          const { clip, last } = clipboard;
          const again =
            last !== null &&
            (at === undefined
              ? last.at === null
              : last.at !== null && Math.hypot(at.x - last.at.x, at.y - last.at.y) < 1);
          // Without a place, even the first paste steps off the original.
          const repeat = again ? last.repeat + 1 : at === undefined ? 1 : 0;
          const center = clipCenter(clip);
          const offset = {
            x: (at ? at.x - center.x : 0) + repeat * PASTE_STEP,
            y: (at ? at.y - center.y : 0) + repeat * PASTE_STEP,
          };
          const result = pasteClip(current, clip, offset);
          get().edit(() => result.automaton);
          set((s) => {
            s.clipboard = { clip, last: { at: at ?? null, repeat } };
            s.selection = {
              states: result.stateIds,
              transitions: internalTransitions(result.automaton, result.stateIds),
            };
          });
          return { promoted: result.promoted };
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
 * The selected states that exist in the active automaton (undo can leave stale ids selected).
 * Ctrl+C copies these when there are any, and the diagram as a picture otherwise.
 */
export function selectedStates(s: AppState): string[] {
  const active = s.automata.find((a) => a.id === s.activeId);
  return active ? s.selection.states.filter((id) => active.states.some((q) => q.id === id)) : [];
}

/**
 * Subscribe to the app store. Selectors must return stable references: select existing state
 * or primitives, and wrap derived objects/arrays with `useShallow` from `zustand/react/shallow`.
 * A selector that builds a fresh object each call re-renders forever.
 */
export const useAppStore = <T>(selector: (s: AppState) => T): T => useStore(appStore, selector);

export function resetAppStore(initial: Initial = {}): void {
  appStore.setState(initialData(initial));
}
