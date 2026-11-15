import { startStates } from '../../../core/model';
import type { Automaton, State, Sym } from '../../../core/model';
import { chip, edge, edgeIs, onAutomaton, wrongSymbols } from '../engine';
import type { Lesson, StepSpec, TutorialContext, WantedEdge } from '../engine';

export { roles } from '../engine';

/** The names the steps ask for, which the goal pictures use. */
export const NAMES = { even: 'even', odd: 'odd', any: 'any' } as const;

/** A two-symbol picture automaton: states at (x, 0), loops pointing up. */
function picture(
  states: { id: string; x: number }[],
  edges: [from: string, symbols: Sym[], to: string][],
): Automaton {
  return {
    id: 'goal',
    name: 'Goal',
    kind: 'DFA',
    alphabet: ['0', '1'],
    states: states.map((s) => ({ id: s.id, label: s.id, x: s.x, y: 0 })),
    starts: [states[0]!.id],
    accepting: [states[0]!.id],
    transitions: edges.map(([from, symbols, to]) => ({
      id: `${from}->${to}`,
      from,
      to,
      symbols,
      ...(from === to ? { loopAngle: -Math.PI / 2 } : {}),
    })),
  };
}

/** A label as new states get it (`q_3`, `q_{12}`), or as typed without the underscore. */
const DEFAULT_LABEL = /^q_?(\d+|\{\d+\})$/;

/** The state's circle: its start arrow carries the same `data-state-id` and comes first. */
const stateTarget = (s: State | undefined): string | null =>
  s ? `[data-testid="canvas"] [data-state-id="${s.id}"] .av-state-body` : null;
/** The whole run pill, so the frame takes in the Run button too. */
const RUN_PILL = 'form:has(input[aria-label="Word"])';

const PART1_EDGES: WantedEdge[] = [
  { from: 'q0', to: 'q1', symbols: ['0'] },
  { from: 'q1', to: 'q0', symbols: ['0'] },
  { from: 'q0', to: 'q0', symbols: ['1'] },
  { from: 'q1', to: 'q1', symbols: ['1'] },
];

/** Hints that hold for every step of part 1. */
function part1Hint(ctx: TutorialContext): string | null {
  return onAutomaton(ctx, null, (a, r) => {
    const extra = a.states.find((s) => s.id !== r.q0?.id && s.id !== r.q1?.id);
    if (extra) return `Delete the extra state ${chip(extra.label)}: click it, then press [Delete].`;
    if (r.q0 && r.q1 && a.accepting.includes(r.q1.id)) {
      return `Only ${chip(r.q0.label)} should be accepting: click ${chip(r.q1.label)} and press [A].`;
    }
    return null;
  });
}

function nfaHint(ctx: TutorialContext): string | null {
  return ctx.automaton?.kind === 'NFA'
    ? 'It became an NFA: switch back to DFA at the top (ε makes it one).'
    : null;
}

/** A state given a name of the user's own (not a `q`-number). */
const isNamed = (s: State | undefined): boolean => s !== undefined && !DEFAULT_LABEL.test(s.label);

/** The state is named `name` (spaces around it and capitals aside). */
const hasName = (s: State | undefined, name: string): boolean =>
  s !== undefined && s.label.trim().toLowerCase() === name;

/**
 * "«evem» should be `even`" once the state is renamed to anything but `name`; `unfinished` lists
 * names it may still have before the rename (part 1's, in part 2).
 */
function wrongName(s: State | undefined, name: string, unfinished: string[] = []): string | null {
  if (!s || !isNamed(s) || hasName(s, name)) return null;
  if (unfinished.some((n) => hasName(s, n))) return null;
  return `${chip(s.label)} should be named \`${name}\`: double-click it to fix the name.`;
}

const PART1_STEPS: StepSpec[] = [
  {
    id: 'add-q0',
    instruction: () => 'Double-click the canvas to add a state.',
    done: (ctx) => onAutomaton(ctx, false, (a) => a.states.length >= 1),
  },
  {
    id: 'name-q0',
    instruction: (l) => `Double-click ${l.q0} and rename it \`${NAMES.even}\`.`,
    why: () => 'It will mean: an even number of zeros so far.',
    done: (ctx) => onAutomaton(ctx, false, (_, r) => hasName(r.q0, NAMES.even)),
    hint: (ctx) => onAutomaton(ctx, null, (_, r) => wrongName(r.q0, NAMES.even)),
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'start',
    instruction: (l) => `Click ${l.q0}, then press [S] to make it the start state.`,
    why: () => 'Every run starts here. The start state gets an arrow pointing in.',
    done: (ctx) =>
      onAutomaton(ctx, false, (a, r) => r.q0 !== undefined && startStates(a).includes(r.q0.id)),
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'accepting',
    instruction: (l) => `Press [A] to make ${l.q0} accepting.`,
    why: () => 'A run that ends here is accepted. It gets a double ring.',
    done: (ctx) =>
      onAutomaton(ctx, false, (a, r) => r.q0 !== undefined && a.accepting.includes(r.q0.id)),
    // A click on the canvas since the last step clears the selection, and A then does nothing.
    first: (ctx) =>
      onAutomaton(ctx, null, (_, r) =>
        r.q0 && !ctx.selected.includes(r.q0.id)
          ? `First, click ${chip(r.q0.label)} to select it.`
          : null,
      ),
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'add-q1',
    instruction: () => `Add a second state and rename it \`${NAMES.odd}\`.`,
    why: () => 'It will mean: an odd number of zeros so far.',
    done: (ctx) => onAutomaton(ctx, false, (_, r) => hasName(r.q1, NAMES.odd)),
    hint: (ctx) => onAutomaton(ctx, null, (_, r) => wrongName(r.q1, NAMES.odd)),
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q1)),
  },
  {
    id: 'q0-q1',
    instruction: (l) =>
      `Hold [Shift] and drag from ${l.q0} to ${l.q1}, then type [0] and press [Enter].`,
    why: () => 'A `0` makes an even count odd.',
    edges: [PART1_EDGES[0]!],
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'q1-q0',
    instruction: (l) =>
      `Hold [Shift] and drag from ${l.q1} to ${l.q0}, then type [0] and press [Enter].`,
    why: () => '…and an odd count even again.',
    edges: [PART1_EDGES[1]!],
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q1)),
  },
  {
    id: 'loop-q0',
    instruction: (l) =>
      `Hold [Shift] and drag from ${l.q0} out and back onto it, then type [1] and press [Enter].`,
    why: () => 'A `1` leaves the count as it is.',
    edges: [PART1_EDGES[2]!],
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'loop-q1',
    instruction: (l) => `Give ${l.q1} a loop on \`1\` the same way.`,
    edges: [PART1_EDGES[3]!],
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q1)),
  },
  {
    id: 'run-1010',
    instruction: () => 'Type `1010` in “Test a word” and press [Enter].',
    why: () => 'Two zeros: it should be accepted.',
    run: { word: '1010', accepted: true },
    target: () => RUN_PILL,
  },
  {
    id: 'run-10',
    instruction: () => 'Press [Esc], then run `10`.',
    why: () => 'One zero: it should be rejected.',
    run: { word: '10', accepted: false },
    target: () => RUN_PILL,
  },
];

const PART2_STEPS: StepSpec[] = [
  {
    id: 'delete-q1',
    instruction: (l) => `Click ${l.q1} and press [Delete].`,
    why: () => 'Nothing to count any more, so one state will do.',
    done: (ctx) =>
      onAutomaton(
        ctx,
        false,
        (a, r) =>
          a.states.length === 1 &&
          r.q0 !== undefined &&
          startStates(a).includes(r.q0.id) &&
          a.accepting.includes(r.q0.id),
      ),
    hint: (ctx) =>
      onAutomaton(ctx, null, (a, r) => {
        if (a.states.length === 0) return 'Press [Ctrl] + [Z] to bring the start state back.';
        // One state left that isn't the start: the start state went instead of q1 (the one left).
        if (a.states.length === 1 && r.q0 && !startStates(a).includes(r.q0.id)) {
          return `That was the start state: press [Ctrl] + [Z] to undo, then delete ${chip(r.q0.label)}.`;
        }
        return null;
      }),
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q1)),
  },
  {
    id: 'loop-01',
    instruction: () => 'Double-click the loop’s `1`, type `0,1` and press [Enter].',
    why: (l) => `Then every word stays in ${l.q0}, which accepts.`,
    // Not `edges`: a loop still reading only 1 is unfinished, not wrong.
    done: (ctx) => edgeIs(ctx, { from: 'q0', to: 'q0', symbols: ['0', '1'] }),
    hint: (ctx) =>
      onAutomaton(ctx, null, (a, r) =>
        edge(a, r.q0?.id, r.q0?.id).some((s) => s !== '0' && s !== '1')
          ? `${chip(r.q0?.label ?? 'q_0')}’s loop should read only \`0\` and \`1\`.`
          : null,
      ),
    target: (ctx) =>
      onAutomaton(ctx, null, (a, r) => {
        const loop = a.transitions.find((t) => t.from === r.q0?.id && t.to === r.q0?.id);
        return loop ? `[data-transition-id="${loop.id}"] [data-testid="edge-label"]` : null;
      }),
  },
  {
    id: 'rename-q0',
    instruction: (l) => `Double-click ${l.q0} and rename it \`${NAMES.any}\`.`,
    why: () => 'It accepts any word now, so give it a name that fits.',
    done: (ctx) => onAutomaton(ctx, false, (_, r) => hasName(r.q0, NAMES.any)),
    // Still part 1's name is just not renamed yet.
    hint: (ctx) => onAutomaton(ctx, null, (_, r) => wrongName(r.q0, NAMES.any, [NAMES.even])),
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'run-10-again',
    instruction: () => 'Run `10` again.',
    why: () => 'This time it’s accepted.',
    run: { word: '10', accepted: true },
    target: () => RUN_PILL,
  },
];

/** The tutorial: build a DFA from a blank one, run it, then change what it accepts. */
export const BASICS: Lesson = {
  id: 'basics',
  noun: 'tutorial',
  title: 'Basics',
  summary: 'Build a DFA and run it',
  minutes: 2,
  start: null,
  editable: true,
  autoPlay: true,
  parts: [
    {
      title: 'Even number of zeros',
      goal: {
        text: 'Accept the words with an even number of zeros',
        examples: [
          { word: '1010', accepted: true },
          { word: '11', accepted: true },
          { word: '10', accepted: false },
          { word: '000', accepted: false },
        ],
        automaton: picture(
          [
            { id: NAMES.even, x: 0 },
            { id: NAMES.odd, x: 150 },
          ],
          [
            [NAMES.even, ['0'], NAMES.odd],
            [NAMES.odd, ['0'], NAMES.even],
            [NAMES.even, ['1'], NAMES.even],
            [NAMES.odd, ['1'], NAMES.odd],
          ],
        ),
        description:
          'The goal: two states, even (start, accepting) and odd. A 0 goes from one to the other; a 1 loops on each.',
      },
      done: 'Your DFA accepts exactly the words with an even number of zeros.',
      steps: PART1_STEPS,
      // Any arrow of part 1 can be drawn early, so all four are checked on every part-1 step.
      hint: (ctx) => part1Hint(ctx) ?? nfaHint(ctx) ?? wrongSymbols(ctx, PART1_EDGES),
    },
    {
      title: 'Accept every word',
      goal: {
        text: 'Accept every word',
        examples: [
          { word: '10', accepted: true },
          { word: '0', accepted: true },
          { word: '111', accepted: true },
        ],
        automaton: picture([{ id: NAMES.any, x: 0 }], [[NAMES.any, ['0', '1'], NAMES.any]]),
        description: 'The goal: one state, any (start, accepting), looping on 0 and 1.',
      },
      steps: PART2_STEPS,
      hint: nfaHint,
    },
  ],
  closing: 'You built a DFA and changed what it accepts. Press [?] any time for all the controls.',
};
