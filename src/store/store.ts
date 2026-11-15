import { useStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import {
  clipCenter,
  copyStates,
  incomingArrows,
  internalTransitions,
  pasteClip,
} from '../core/clipboard';
import type { Clip } from '../core/clipboard';
import { removeState, removeTransition, sameStructure, syncAlphabet } from '../core/edit';
import { newId } from '../core/id';
import { emptyAutomaton } from '../core/model';
import type { Automaton, AutomatonKind, Transition } from '../core/model';
import type { AnyTrace } from '../core/trace';
import type { Selection, Viewport } from './types';

export type { Selection, Viewport } from './types';

const HISTORY_CAP = 100;
const NO_SELECTION: Selection = { states: [], transitions: [] };
/** World px between a paste and the next one pasted at the same place. */
export const PASTE_STEP = 40;

/**
 * What Ctrl+C copied last (in memory only, never saved): states of an automaton, or a whole
 * automaton from the history bar. For states, `last` is where the last paste went: pasting again
 * at the same place (or again without a place) steps `repeat` times further along. After a cut,
 * `incoming` holds the arrows that came into the cut states from states left behind: the first
 * paste restores them when it goes into the automaton cut from, then they are dropped. An automaton
 * is a snapshot with the view it had, so later edits to it, or deleting it, don't change the paste.
 */
export type Clipboard =
  | {
      kind: 'states';
      clip: Clip;
      last: { at: { x: number; y: number } | null; repeat: number } | null;
      incoming?: { automatonId: string; transitions: Transition[] };
    }
  | { kind: 'automaton'; automaton: Automaton; viewport?: Viewport };

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
  /** Ids of automata whose structure can't change (layout moves still can); never saved. */
  readOnly: string[];
  /** Bumped each time an edit, undo or redo is refused because the automaton is read-only. */
  blockedEdits: number;

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
   * Cut (Ctrl+X): copy the selected states, then delete them and the selected arrows as one undo
   * step. The first paste without a place puts them back where they were. False (and nothing
   * changes) when no state is selected or a trace is open.
   */
  cutSelection(): boolean;
  /** Copy automaton `id` as a whole (Ctrl+C in the history bar); false if there is none. */
  copyAutomaton(id: string): boolean;
  /**
   * Add a copy of the copied automaton, named, placed and opened like `duplicateAutomaton`. Its
   * id, or `null` when the clipboard holds no automaton.
   */
  pasteAutomaton(): string | null;
  /**
   * Paste what was copied into the active automaton as one undo step, centred on `at` (world
   * coordinates), or a step down and right of where it was copied from; the pasted states and
   * the arrows between them become the selection. `promoted`: an ε-arrow turned a DFA into an
   * NFA. `null` when no states were copied or a trace is open.
   */
  paste(at?: { x: number; y: number }): { promoted: boolean } | null;
  setViewport(id: string, vp: Viewport): void;
  /** Make exactly these automata read-only: structural edits, undo and redo into one are refused. */
  setReadOnly(ids: string[]): void;
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
  | 'readOnly'
  | 'blockedEdits'
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
    readOnly: [],
    blockedEdits: 0,
  };
}

export function createAppStore(initial: Initial = {}): StoreApi<AppState> {
  return createStore<AppState>()(
    immer((set, get) => {
      /** Add and open a copy of `original` named "X copy" (or "X copy 2", …), in `viewport`. */
      const addCopy = (original: Automaton, viewport: Viewport | undefined): string => {
        // A copy of "X copy 2" is "X copy 3", not "X copy 2 copy".
        const base = `${original.name.replace(/ copy(?: \d+)?$/, '')} copy`;
        const copy: Automaton = { ...original, id: newId(), name: freeName(get().automata, base) };
        get().addAutomaton(copy);
        if (viewport) {
          set((s) => {
            s.viewports[copy.id] = viewport;
          });
        }
        return copy.id;
      };

      /** Push `snapshot` onto the active history's past (capped) and clear the future. */
      const record = (id: string, snapshot: Automaton): void =>
        set((s) => {
          const h = (s.history[id] ??= { past: [], future: [] });
          h.past.push(snapshot);
          if (h.past.length > HISTORY_CAP) h.past.splice(0, h.past.length - HISTORY_CAP);
          h.future = [];
        });

      /** True (and counted) when `next` would change the structure of a read-only automaton. */
      const blocked = (current: Automaton, next: Automaton): boolean => {
        if (!get().readOnly.includes(current.id) || sameStructure(current, next)) return false;
        set((s) => {
          s.blockedEdits++;
        });
        return true;
      };

      const swap = (from: 'past' | 'future', to: 'past' | 'future'): void => {
        const { activeId, trace, automata: all, history } = get();
        if (activeId === null || trace) return;
        const stack = history[activeId]?.[from];
        const current = all.find((a) => a.id === activeId);
        if (!stack || stack.length === 0 || !current) return;
        const target = stack[stack.length - 1];
        if (!target || blocked(current, target)) return;
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
          const original = get().automata.find((a) => a.id === id);
          return original ? addCopy(original, get().viewports[id]) : null;
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
          if (blocked(current, next)) return;
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
            s.clipboard = { kind: 'states', clip, last: null };
          });
          return true;
        },

        cutSelection() {
          const { activeId, automata: all, selection, trace } = get();
          const current = all.find((a) => a.id === activeId);
          const clip = current && !trace ? copyStates(current, selection.states) : null;
          if (!clip) return false;
          let next = current!;
          for (const t of selection.transitions) next = removeTransition(next, t);
          for (const st of clip.states) next = removeState(next, st.id);
          // Refused on a read-only automaton: nothing copied, the selection kept.
          if (blocked(current!, syncAlphabet(next))) return false;
          get().edit(() => next);
          set((s) => {
            // `repeat: -1`: the first placeless paste steps 0 times, back onto the cut states' spot.
            s.clipboard = {
              kind: 'states',
              clip,
              last: { at: null, repeat: -1 },
              incoming: {
                automatonId: current!.id,
                transitions: incomingArrows(
                  current!,
                  clip.states.map((st) => st.id),
                ),
              },
            };
            s.selection = NO_SELECTION;
          });
          return true;
        },

        copyAutomaton(id) {
          const { automata, viewports } = get();
          const automaton = automata.find((a) => a.id === id);
          if (!automaton) return false;
          const viewport = viewports[id];
          set((s) => {
            s.clipboard = viewport
              ? { kind: 'automaton', automaton, viewport }
              : { kind: 'automaton', automaton };
          });
          return true;
        },

        pasteAutomaton() {
          const { clipboard } = get();
          if (clipboard?.kind !== 'automaton') return null;
          return addCopy(clipboard.automaton, clipboard.viewport);
        },

        paste(at) {
          const { activeId, trace, automata: all, clipboard } = get();
          const current = all.find((a) => a.id === activeId);
          if (clipboard?.kind !== 'states' || trace || !current) return null;
          const { clip, last, incoming } = clipboard;
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
          const result = pasteClip(
            current,
            clip,
            offset,
            incoming?.automatonId === current.id ? incoming.transitions : [],
          );
          // Refused on a read-only automaton: the clipboard and the selection stay as they were.
          if (blocked(current, syncAlphabet(result.automaton))) return null;
          get().edit(() => result.automaton);
          set((s) => {
            s.clipboard = { kind: 'states', clip, last: { at: at ?? null, repeat } };
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

        setReadOnly(ids) {
          set((s) => {
            s.readOnly = ids;
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
