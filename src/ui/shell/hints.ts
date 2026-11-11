import type { Automaton } from '../../core/model';
import { startStates } from '../../core/model';
import type { Gesture } from './GestureChip';

/**
 * The canvas's hint strip: one line just above "Test a word" that says what can be done next,
 * from what is on the canvas and what is selected. Pure: `HintStrip` renders it.
 *
 * Each part teaches one thing (`learn`). Using it counts (`hintsLearned.ts`), and after
 * `RETIRE_AFTER` uses the part is no longer shown, so the strip goes quiet as people learn.
 */

/** What a hint part teaches; the keys of the learned counts. */
export type LearnKey =
  | 'transition'
  | 'start'
  | 'accept'
  | 'copy'
  | 'menu'
  | 'multi'
  | 'group'
  | 'delete'
  | 'convert'
  | 'minimize';

/** Uses after which a part is no longer shown. */
export const RETIRE_AFTER = 3;

/** How many parts a hint shows at most: the first ones not yet learned. */
export const MAX_PARTS = 3;

/** A gesture and what it does. */
export interface GesturePart {
  kind: 'gesture';
  learn: LearnKey;
  gesture: Gesture;
  action: string;
}

/** A suggestion with a button that does it (the walkthroughs). */
export interface ActionPart {
  kind: 'action';
  learn: LearnKey;
  /** What it does, before the button. */
  lead: string;
  /** The button's text; also the toolbar button's name. */
  label: string;
  run: 'convert' | 'minimize';
}

export type HintPart = GesturePart | ActionPart;

export interface Hint {
  /** Which situation it is about (`data-hint`, for tests). */
  id:
    | 'connect'
    | 'set-start'
    | 'set-accepting'
    | 'one-selected'
    | 'many-selected'
    | 'convert'
    | 'minimize';
  /** What is shown: the first parts not yet learned. */
  parts: HintPart[];
  /** Everything this situation teaches, shown or not: the strip's × retires all of it. */
  teaches: LearnKey[];
}

export type Learned = Partial<Record<LearnKey, number>>;

export interface HintInput {
  automaton: Automaton;
  /** How many states are selected. */
  selected: number;
  learned: Learned;
  /** `canConvert` / `canMinimize` of the automaton: `null` when it can. */
  convertReason: string | null;
  minimizeReason: string | null;
}

export function isLearned(learned: Learned, key: LearnKey): boolean {
  return (learned[key] ?? 0) >= RETIRE_AFTER;
}

const gesture = (learn: LearnKey, g: Gesture, action: string): GesturePart => ({
  kind: 'gesture',
  learn,
  gesture: g,
  action,
});

/** `id` with the first `MAX_PARTS` of `parts` not yet learned, or `null` when all are. */
function hint(id: Hint['id'], parts: HintPart[], learned: Learned): Hint | null {
  const fresh = parts.filter((p) => !isLearned(learned, p.learn)).slice(0, MAX_PARTS);
  return fresh.length === 0 ? null : { id, parts: fresh, teaches: parts.map((p) => p.learn) };
}

/**
 * The hint for the canvas as it is, or `null` for none. An empty automaton gets none: the
 * canvas's own centred hint covers it.
 */
export function pickHint(input: HintInput): Hint | null {
  const { automaton: a, selected, learned, convertReason, minimizeReason } = input;
  if (a.states.length === 0) return null;

  if (selected === 1) {
    return hint(
      'one-selected',
      [
        gesture('start', { keys: ['S'] }, 'start state'),
        gesture('accept', { keys: ['A'] }, 'accepting'),
        ...(a.states.length >= 2
          ? [gesture('multi', { keys: ['Ctrl'], mouse: 'click' }, 'select more')]
          : []),
        gesture('copy', { keys: ['Ctrl', 'C'] }, 'copy'),
        gesture('menu', { mouse: 'right' }, 'more options'),
      ],
      learned,
    );
  }
  if (selected > 1) {
    return hint(
      'many-selected',
      [
        gesture('group', { mouse: 'drag', on: 'one' }, 'move them all'),
        gesture('copy', { keys: ['Ctrl', 'C'] }, 'copy, then Ctrl+V to paste'),
        gesture('delete', { keys: ['Delete'] }, 'delete'),
        gesture('menu', { mouse: 'right' }, 'more options'),
      ],
      learned,
    );
  }

  // Nothing selected: the next thing to build, or something to do with the finished automaton.
  if (a.transitions.length === 0) {
    return hint(
      'connect',
      [
        gesture(
          'transition',
          { keys: ['Shift'], mouse: 'drag', on: 'state to state' },
          'add a transition (drop it on the same state for a loop)',
        ),
      ],
      learned,
    );
  }
  if (startStates(a).length === 0) {
    return hint(
      'set-start',
      [gesture('start', { mouse: 'click', on: 'a state' }, 'then S to make it the start state')],
      learned,
    );
  }
  if (a.accepting.length === 0) {
    return hint(
      'set-accepting',
      [gesture('accept', { mouse: 'click', on: 'a state' }, 'then A to make it accepting')],
      learned,
    );
  }
  if (convertReason === null) {
    return hint(
      'convert',
      [
        {
          kind: 'action',
          learn: 'convert',
          lead: 'Watch this NFA become a DFA, step by step:',
          label: 'Convert to DFA',
          run: 'convert',
        },
      ],
      learned,
    );
  }
  if (minimizeReason === null && a.states.length >= 2) {
    return hint(
      'minimize',
      [
        {
          kind: 'action',
          learn: 'minimize',
          lead: 'See whether this DFA can be smaller, step by step:',
          label: 'Minimize',
          run: 'minimize',
        },
      ],
      learned,
    );
  }
  return null;
}
