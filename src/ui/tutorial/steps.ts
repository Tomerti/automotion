import { startStates } from '../../core/model';
import type { Automaton, State, StateId, Sym } from '../../core/model';
import type { AnyTrace } from '../../core/trace';

/** What the steps look at: the tutorial automaton (by id) and whatever run is on screen. */
export interface TutorialContext {
  automaton: Automaton | undefined;
  /** The tutorial automaton is the one open. */
  isActive: boolean;
  trace: AnyTrace | null;
  stepIndex: number;
  /** The selected states. */
  selected: readonly StateId[];
  /** The DFA saved from the tutorial's conversion (part 3), once there is one. */
  derivedId: string | null;
  /** That saved DFA is the one open: part 3 minimizes it, so it isn't "elsewhere". */
  derivedActive: boolean;
}

export type StepId =
  | 'add-q0'
  | 'name-q0'
  | 'start'
  | 'accepting'
  | 'add-q1'
  | 'q0-q1'
  | 'q1-q0'
  | 'loop-q0'
  | 'loop-q1'
  | 'run-1010'
  | 'run-10'
  | 'delete-q1'
  | 'loop-01'
  | 'rename-q0'
  | 'run-10-again'
  | 'convert'
  | 'convert-end'
  | 'save-minimize'
  | 'minimize-end'
  | 'done';

/**
 * `elsewhere`: another automaton is open (the card names it and offers the way back).
 * `part-done`: the run that ended `part` is still open: the card says so and asks for Esc to
 * start the next one.
 * `first`: something to do before the step (leave a run, select the state). Not a mistake, so
 * the card puts it before the step, in plain ink.
 * `text`: something is off, shown in red.
 */
export type Hint =
  | { kind: 'elsewhere' }
  | { kind: 'part-done'; part: 1 | 2 }
  | { kind: 'first'; text: string }
  | { kind: 'text'; text: string };

export interface Step {
  id: StepId;
  /** 4 is the closing card. */
  part: 1 | 2 | 3 | 4;
  /**
   * What to do, in one short sentence. Words and symbols in backticks, keys in brackets
   * (`[Shift]`, `[0]`), state labels in guillemets as typed (`«q_0»`), drawn as a small state
   * with `LabelText`.
   */
  instruction(ctx: TutorialContext): string;
  /** Why, in a few words, under the instruction (same markup), if it needs saying. */
  why(ctx: TutorialContext): string | null;
  /** Structural check. Run and `latch` steps are done once latched instead (see `advance`). */
  done(ctx: TutorialContext): boolean;
  hint(ctx: TutorialContext): Hint | null;
  /** CSS selector of what to point at, if anything. */
  target(ctx: TutorialContext): string | null;
  run?: { word: string; accepted: boolean };
  /**
   * A step done by something that comes and goes (a walkthrough opening, reaching its end): it
   * latches once this holds, like a run step at its verdict, and stays done after.
   */
  latch?: (ctx: TutorialContext) => boolean;
}

export const COUNTED_STEPS = 19;

/** Each part's name, for the card's header and the hand-over between the parts. */
export const PART_TITLES: Record<1 | 2 | 3, string> = {
  1: 'Even number of zeros',
  2: 'Accept every word',
  3: 'Convert and minimize',
};

/** What a finished part does, said when it ends. */
export const PART_DONE: Record<1 | 2, string> = {
  1: 'Your DFA accepts exactly the words with an even number of zeros.',
  2: 'Your DFA accepts every word.',
};

/**
 * What a part builds, shown at the top of the card for the whole part so the steps have a point:
 * a few words (same markup as the steps), words it accepts and rejects, and a picture of the
 * finished automaton, with `description` as the picture's text alternative.
 */
export interface Goal {
  text: string;
  examples: { word: string; accepted: boolean }[];
  automaton: Automaton;
  description: string;
}

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

/**
 * Part 3's NFA, for the words that contain `01`: part 3 converts it to a DFA (4 states) and
 * minimizes that (3 states). State ids equal their labels.
 */
export const PART3_NFA: Automaton = {
  id: 'tutorial-nfa',
  name: 'Contains 01',
  kind: 'NFA',
  alphabet: ['0', '1'],
  states: [
    { id: 'q_0', label: 'q_0', x: 0, y: 0 },
    { id: 'q_1', label: 'q_1', x: 150, y: 0 },
    { id: 'q_2', label: 'q_2', x: 300, y: 0 },
  ],
  starts: ['q_0'],
  accepting: ['q_2'],
  transitions: [
    { id: 'q_0->q_0', from: 'q_0', to: 'q_0', symbols: ['0', '1'], loopAngle: -Math.PI / 2 },
    { id: 'q_0->q_1', from: 'q_0', to: 'q_1', symbols: ['0'] },
    { id: 'q_1->q_2', from: 'q_1', to: 'q_2', symbols: ['1'] },
    { id: 'q_2->q_2', from: 'q_2', to: 'q_2', symbols: ['0', '1'], loopAngle: -Math.PI / 2 },
  ],
};

export const PART_GOALS: Record<1 | 2 | 3, Goal> = {
  1: {
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
  2: {
    text: 'Accept every word',
    examples: [
      { word: '10', accepted: true },
      { word: '0', accepted: true },
      { word: '111', accepted: true },
    ],
    automaton: picture([{ id: NAMES.any, x: 0 }], [[NAMES.any, ['0', '1'], NAMES.any]]),
    description: 'The goal: one state, any (start, accepting), looping on 0 and 1.',
  },
  3: {
    text: 'Turn an NFA into a DFA, then make it as small as possible',
    examples: [
      { word: '1011', accepted: true },
      { word: '0010', accepted: true },
      { word: '110', accepted: false },
      { word: '0', accepted: false },
    ],
    automaton: PART3_NFA,
    description:
      'The goal: an NFA with three states, q_0 (start), q_1 and q_2 (accepting), for the words that contain 01.',
  },
};

/**
 * The walkthrough on screen is part 3's: the conversion of the tutorial automaton, or the
 * minimization of the DFA saved from it (open while that DFA, not the tutorial one, is active).
 */
export function isPart3Trace(ctx: TutorialContext): boolean {
  const t = ctx.trace;
  if (t?.kind === 'subset') return ctx.automaton !== undefined && t.source.id === ctx.automaton.id;
  if (t?.kind === 'minimize') return ctx.derivedId !== null && t.source.id === ctx.derivedId;
  return false;
}

/** The tutorial's conversion is open (at its last step with `atEnd`). */
function converting(ctx: TutorialContext, atEnd = false): boolean {
  const t = ctx.trace;
  return (
    t?.kind === 'subset' && isPart3Trace(ctx) && (!atEnd || ctx.stepIndex === t.steps.length - 1)
  );
}

/** The saved DFA's minimization is open (at its last step with `atEnd`). */
function minimizing(ctx: TutorialContext, atEnd = false): boolean {
  const t = ctx.trace;
  return (
    t?.kind === 'minimize' && isPart3Trace(ctx) && (!atEnd || ctx.stepIndex === t.steps.length - 1)
  );
}

/** The player at the bottom, which plays and steps through a walkthrough. */
const DOCK = '[data-testid="dock"]';

/** q0 is the start state (or the first state before there is one); q1 is the first other state. */
export function roles(a: Automaton): { q0?: State; q1?: State } {
  const startId = startStates(a)[0];
  const q0 = a.states.find((s) => s.id === startId) ?? a.states[0];
  const q1 = a.states.find((s) => s.id !== q0?.id);
  return { q0, q1 };
}

function edge(a: Automaton, from: StateId | undefined, to: StateId | undefined): Sym[] {
  return a.transitions.find((t) => t.from === from && t.to === to)?.symbols ?? [];
}

function sameSet(xs: Sym[], ys: Sym[]): boolean {
  return xs.length === ys.length && xs.every((x) => ys.includes(x));
}

/** A state label as the card draws it: a small state. */
const chip = (label: string): string => `«${label}»`;

/** The current labels of q0 and q1, as chips. */
function labels(ctx: TutorialContext): { q0: string; q1: string } {
  const r = ctx.automaton ? roles(ctx.automaton) : {};
  return { q0: chip(r.q0?.label ?? 'q_0'), q1: chip(r.q1?.label ?? 'q_1') };
}

/** What `fn` says about the automaton, or `fallback` without one. */
function onAutomaton<T>(
  ctx: TutorialContext,
  fallback: T,
  fn: (a: Automaton, r: { q0?: State; q1?: State }) => T,
): T {
  return ctx.automaton ? fn(ctx.automaton, roles(ctx.automaton)) : fallback;
}

/** A label as new states get it (`q_3`, `q_{12}`), or as typed without the underscore. */
const DEFAULT_LABEL = /^q_?(\d+|\{\d+\})$/;

/** The state's circle: its start arrow carries the same `data-state-id` and comes first. */
const stateTarget = (s: State | undefined): string | null =>
  s ? `[data-testid="canvas"] [data-state-id="${s.id}"] .av-state-body` : null;
/** The whole run pill, so the frame takes in the Run button too. */
const RUN_PILL = 'form:has(input[aria-label="Word"])';

/** An edge the step draws, and the symbols it should read. */
interface WantedEdge {
  from: 'q0' | 'q1';
  to: 'q0' | 'q1';
  symbols: Sym[];
}

const PART1_EDGES: WantedEdge[] = [
  { from: 'q0', to: 'q1', symbols: ['0'] },
  { from: 'q1', to: 'q0', symbols: ['0'] },
  { from: 'q0', to: 'q0', symbols: ['1'] },
  { from: 'q1', to: 'q1', symbols: ['1'] },
];

function edgeIs(ctx: TutorialContext, e: WantedEdge): boolean {
  return onAutomaton(ctx, false, (a, r) => sameSet(edge(a, r[e.from]?.id, r[e.to]?.id), e.symbols));
}

/** "q_0 → q_1 should read only 0." when that edge exists with other symbols. */
function wrongSymbols(ctx: TutorialContext, edges: WantedEdge[]): string | null {
  return onAutomaton(ctx, null, (a, r) => {
    for (const e of edges) {
      const from = r[e.from];
      const to = r[e.to];
      if (!from || !to) continue;
      const syms = edge(a, from.id, to.id);
      if (syms.length > 0 && !sameSet(syms, e.symbols)) {
        const only = e.symbols.map((s) => `\`${s}\``).join(', ');
        return from === to
          ? `${chip(from.label)}’s loop should read only ${only}.`
          : `${chip(from.label)} → ${chip(to.label)} should read only ${only}.`;
      }
    }
    return null;
  });
}

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

interface StepSpec {
  id: StepId;
  part: 1 | 2 | 3 | 4;
  /** `ctx` for a step that follows the user halfway through it. */
  instruction(l: { q0: string; q1: string }, ctx: TutorialContext): string;
  why?(l: { q0: string; q1: string }, ctx: TutorialContext): string;
  done?(ctx: TutorialContext): boolean;
  /** Hints of this step only, after the common ones. */
  hint?(ctx: TutorialContext): string | null;
  /** Something to do before this step, shown as a `first` hint. */
  first?(ctx: TutorialContext): string | null;
  /** The edges this step draws, for the wrong-symbols hint. */
  edges?: WantedEdge[];
  target?(ctx: TutorialContext): string | null;
  run?: { word: string; accepted: boolean };
  latch?: (ctx: TutorialContext) => boolean;
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

const SPECS: StepSpec[] = [
  {
    id: 'add-q0',
    part: 1,
    instruction: () => 'Double-click the canvas to add a state.',
    done: (ctx) => onAutomaton(ctx, false, (a) => a.states.length >= 1),
  },
  {
    id: 'name-q0',
    part: 1,
    instruction: (l) => `Double-click ${l.q0} and rename it \`${NAMES.even}\`.`,
    why: () => 'It will mean: an even number of zeros so far.',
    done: (ctx) => onAutomaton(ctx, false, (_, r) => hasName(r.q0, NAMES.even)),
    hint: (ctx) => onAutomaton(ctx, null, (_, r) => wrongName(r.q0, NAMES.even)),
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'start',
    part: 1,
    instruction: (l) => `Click ${l.q0}, then press [S] to make it the start state.`,
    why: () => 'Every run starts here. The start state gets an arrow pointing in.',
    done: (ctx) =>
      onAutomaton(ctx, false, (a, r) => r.q0 !== undefined && startStates(a).includes(r.q0.id)),
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'accepting',
    part: 1,
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
    part: 1,
    instruction: () => `Add a second state and rename it \`${NAMES.odd}\`.`,
    why: () => 'It will mean: an odd number of zeros so far.',
    done: (ctx) => onAutomaton(ctx, false, (_, r) => hasName(r.q1, NAMES.odd)),
    hint: (ctx) => onAutomaton(ctx, null, (_, r) => wrongName(r.q1, NAMES.odd)),
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q1)),
  },
  {
    id: 'q0-q1',
    part: 1,
    instruction: (l) =>
      `Hold [Shift] and drag from ${l.q0} to ${l.q1}, then type [0] and press [Enter].`,
    why: () => 'A `0` makes an even count odd.',
    edges: [PART1_EDGES[0]!],
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'q1-q0',
    part: 1,
    instruction: (l) =>
      `Hold [Shift] and drag from ${l.q1} to ${l.q0}, then type [0] and press [Enter].`,
    why: () => '…and an odd count even again.',
    edges: [PART1_EDGES[1]!],
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q1)),
  },
  {
    id: 'loop-q0',
    part: 1,
    instruction: (l) =>
      `Hold [Shift] and drag from ${l.q0} out and back onto it, then type [1] and press [Enter].`,
    why: () => 'A `1` leaves the count as it is.',
    edges: [PART1_EDGES[2]!],
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'loop-q1',
    part: 1,
    instruction: (l) => `Give ${l.q1} a loop on \`1\` the same way.`,
    edges: [PART1_EDGES[3]!],
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q1)),
  },
  {
    id: 'run-1010',
    part: 1,
    instruction: () => 'Type `1010` in “Test a word” and press [Enter].',
    why: () => 'Two zeros: it should be accepted.',
    run: { word: '1010', accepted: true },
    target: () => RUN_PILL,
  },
  {
    id: 'run-10',
    part: 1,
    instruction: () => 'Press [Esc], then run `10`.',
    why: () => 'One zero: it should be rejected.',
    run: { word: '10', accepted: false },
    target: () => RUN_PILL,
  },
  {
    id: 'delete-q1',
    part: 2,
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
    part: 2,
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
    part: 2,
    instruction: (l) => `Double-click ${l.q0} and rename it \`${NAMES.any}\`.`,
    why: () => 'It accepts any word now, so give it a name that fits.',
    done: (ctx) => onAutomaton(ctx, false, (_, r) => hasName(r.q0, NAMES.any)),
    // Still part 1's name is just not renamed yet.
    hint: (ctx) => onAutomaton(ctx, null, (_, r) => wrongName(r.q0, NAMES.any, [NAMES.even])),
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'run-10-again',
    part: 2,
    instruction: () => 'Run `10` again.',
    why: () => 'This time it’s accepted.',
    run: { word: '10', accepted: true },
    target: () => RUN_PILL,
  },
  {
    id: 'convert',
    part: 3,
    instruction: () => 'Press Convert to DFA at the top.',
    why: () => 'It builds a DFA that accepts the same words.',
    latch: (ctx) => converting(ctx),
    target: () => 'button[aria-label="Convert to DFA"]',
  },
  {
    id: 'convert-end',
    part: 3,
    instruction: () => 'Press Play, or step with [→], to the end.',
    why: () => 'Each DFA state is a set of NFA states.',
    latch: (ctx) => converting(ctx, true),
    first: (ctx) => (converting(ctx) ? null : 'First, press Convert to DFA again.'),
    target: () => DOCK,
  },
  {
    id: 'save-minimize',
    part: 3,
    instruction: () => 'Press Save and minimize.',
    why: () => 'Two of its states do the same job.',
    latch: (ctx) => minimizing(ctx),
    // The button is at the end of the conversion, which was closed before it was pressed.
    first: (ctx) =>
      ctx.isActive && !isPart3Trace(ctx) ? 'First, press Convert to DFA again.' : null,
    target: () => '[data-testid="save-and-minimize"]',
  },
  {
    id: 'minimize-end',
    part: 3,
    instruction: () => 'Play the minimization to the end.',
    why: () => 'It merges states that accept the same words.',
    latch: (ctx) => minimizing(ctx, true),
    first: (ctx) => {
      if (minimizing(ctx)) return null;
      if (ctx.derivedActive) return 'First, press Minimize again.';
      // The NFA can't be minimized: the saved DFA can.
      return ctx.isActive ? 'First, open the DFA you saved and press Minimize.' : null;
    },
    target: () => DOCK,
  },
  {
    id: 'done',
    part: 4,
    instruction: () =>
      'You built DFAs, ran them, and converted and minimized an NFA. Press [?] any time for the controls.',
    done: () => false,
  },
];

function toStep(spec: StepSpec, i: number): Step {
  // Edits made with a walkthrough or run open: Esc first. Part 3 works in walkthroughs.
  const structural = spec.run === undefined && spec.latch === undefined && spec.part !== 4;
  const done = (ctx: TutorialContext): boolean =>
    spec.done ? spec.done(ctx) : (spec.edges ?? []).every((e) => edgeIs(ctx, e));
  const hint = (ctx: TutorialContext): Hint | null => {
    // From the minimization on, part 3 works on the saved DFA.
    const onDerived = spec.part >= 3 && ctx.derivedActive;
    if (!ctx.isActive && !isPart3Trace(ctx) && !onDerived) return { kind: 'elsewhere' };
    const t = ctx.trace;
    if (t) {
      const prev = SPECS[i - 1];
      const endedPart = prev?.part === 1 || prev?.part === 2 ? prev.part : null;
      const endsPart =
        endedPart !== null &&
        prev?.run !== undefined &&
        endedPart !== spec.part &&
        t.kind === 'run' &&
        t.source.id === ctx.automaton?.id &&
        t.word === prev.run.word &&
        t.accepted === prev.run.accepted;
      if (endsPart) return { kind: 'part-done', part: endedPart };
      if (structural) return { kind: 'first', text: 'First, press [Esc] to get back to editing.' };
    }
    const text =
      (spec.part === 1 ? part1Hint(ctx) : null) ??
      // Part 3's automaton is an NFA on purpose.
      (spec.part === 1 || spec.part === 2 ? nfaHint(ctx) : null) ??
      (spec.edges ? wrongSymbols(ctx, spec.edges) : null) ??
      // Any arrow of part 1 can be drawn early, so all four are checked on every part-1 step.
      (spec.part === 1 ? wrongSymbols(ctx, PART1_EDGES) : null) ??
      (spec.run ? otherWord(ctx, spec.run.word, SPECS[i - 1]?.run?.word) : null) ??
      spec.hint?.(ctx) ??
      null;
    if (text !== null) return { kind: 'text', text };
    const first = spec.first?.(ctx) ?? null;
    return first === null ? null : { kind: 'first', text: first };
  };
  return {
    id: spec.id,
    part: spec.part,
    instruction: (ctx) => spec.instruction(labels(ctx), ctx),
    why: (ctx) => spec.why?.(labels(ctx), ctx) ?? null,
    done,
    hint,
    target: (ctx) => spec.target?.(ctx) ?? null,
    ...(spec.run ? { run: spec.run } : {}),
    ...(spec.latch ? { latch: spec.latch } : {}),
  };
}

/** A run of another word on the tutorial automaton is open (the previous step's run is fine). */
function otherWord(
  ctx: TutorialContext,
  word: string,
  previous: string | undefined,
): string | null {
  const t = ctx.trace;
  if (t?.kind !== 'run' || t.source.id !== ctx.automaton?.id) return null;
  if (t.word === word || t.word === previous) return null;
  return `That was \`${t.word === '' ? 'ε' : t.word}\`. Press [Esc] and run \`${word}\`.`;
}

export const STEPS: readonly Step[] = SPECS.map(toStep);

/** The run step's word ran to its verdict, on the tutorial automaton, with the expected result. */
export function runSucceeded(step: Step, ctx: TutorialContext): boolean {
  const t = ctx.trace;
  return (
    step.run !== undefined &&
    ctx.isActive &&
    t?.kind === 'run' &&
    t.source.id === ctx.automaton?.id &&
    t.word === step.run.word &&
    t.accepted === step.run.accepted &&
    ctx.stepIndex === t.steps.length - 1
  );
}

export interface Progress {
  /** The furthest step reached. */
  progress: number;
  /** The step to show: the earliest one of `progress`'s part that isn't done. */
  current: number;
  latched: ReadonlySet<StepId>;
}

const LAST = SPECS.length - 1;

function partStart(i: number): number {
  const part = STEPS[i]?.part;
  return STEPS.findIndex((s) => s.part === part);
}

/**
 * Move through every step that is done, latching runs that reached their verdict and part 3's
 * walkthrough steps. Never moves while another automaton is open (part 3's walkthroughs aside),
 * and never falls back past the start of `progress`'s part.
 */
export function advance(
  progress: number,
  latched: ReadonlySet<StepId>,
  ctx: TutorialContext,
  /** The step on the card now: kept as it is while another automaton is open. */
  current: number = progress,
): Progress {
  if ((!ctx.isActive && !isPart3Trace(ctx)) || !ctx.automaton) {
    return { progress, current, latched };
  }
  let held = latched;
  for (;;) {
    const isDone = (i: number): boolean => {
      const s = STEPS[i]!;
      return s.run || s.latch ? held.has(s.id) : s.done(ctx);
    };
    let undone: number | undefined;
    for (let i = partStart(progress); i <= progress; i++) {
      if (!isDone(i)) {
        undone = i;
        break;
      }
    }
    if (undone !== undefined) {
      const s = STEPS[undone]!;
      if (runSucceeded(s, ctx) || s.latch?.(ctx)) {
        held = new Set([...held, s.id]);
        continue;
      }
      return { progress, current: undone, latched: held };
    }
    if (progress === LAST) return { progress, current: LAST, latched: held };
    progress += 1;
  }
}
