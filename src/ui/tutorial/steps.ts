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
}

export type StepId =
  | 'add-q0'
  | 'name-q0'
  | 'start-accepting'
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
  /** 3 is the closing card. */
  part: 1 | 2 | 3;
  /**
   * What to do, in one short sentence. Words and symbols in backticks, keys in brackets
   * (`[Shift]`, `[0]`), state labels in guillemets as typed (`«q_0»`), drawn as a small state
   * with `LabelText`.
   */
  instruction(ctx: TutorialContext): string;
  /** Why, in a few words, under the instruction (same markup), if it needs saying. */
  why(ctx: TutorialContext): string | null;
  /** Structural check. Run steps are done once latched (see `runSucceeded`). */
  done(ctx: TutorialContext): boolean;
  hint(ctx: TutorialContext): Hint | null;
  /** CSS selector of what to point at, if anything. */
  target(ctx: TutorialContext): string | null;
  run?: { word: string; accepted: boolean };
}

export const COUNTED_STEPS = 14;

/** Each part's name, for the card's header and the hand-over between the parts. */
export const PART_TITLES: Record<1 | 2, string> = {
  1: 'Even number of zeros',
  2: 'Accept every word',
};

/** What the finished part 1 does, said when it ends. */
export const PART1_DONE = 'Your DFA accepts exactly the words with an even number of zeros.';

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

export const PART_GOALS: Record<1 | 2, Goal> = {
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
};

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
  part: 1 | 2 | 3;
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
}

/** Whether q0 is a start state, and whether it is accepting. */
function startAndAccepting(ctx: TutorialContext): { start: boolean; accepting: boolean } {
  return onAutomaton(ctx, { start: false, accepting: false }, (a, r) => ({
    start: r.q0 !== undefined && startStates(a).includes(r.q0.id),
    accepting: r.q0 !== undefined && a.accepting.includes(r.q0.id),
  }));
}

/** A state given a name of the user's own (not a `q`-number). */
const isNamed = (s: State | undefined): boolean => s !== undefined && !DEFAULT_LABEL.test(s.label);

/** Labels part 1 asked for, which part 2's rename must move away from. */
const PART1_NAMES: readonly string[] = [NAMES.even, NAMES.odd];

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
    done: (ctx) => onAutomaton(ctx, false, (_, r) => isNamed(r.q0)),
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'start-accepting',
    part: 1,
    // Says what each key does, and once one is pressed, what it did and what the other is for.
    instruction: (l, ctx) => {
      const { start, accepting } = startAndAccepting(ctx);
      if (start && !accepting) {
        return `${l.q0} is the start state now. Press [A] to make it accepting too.`;
      }
      if (accepting && !start) {
        return `${l.q0} is accepting now. Press [S] to make it the start state too.`;
      }
      return `Click ${l.q0}, then press [S] to make it the start state and [A] to make it accepting.`;
    },
    why: (_, ctx) => {
      const { start, accepting } = startAndAccepting(ctx);
      if (start && !accepting) return 'An accepting state gets a double ring.';
      if (accepting && !start) return 'The start state gets an arrow pointing in.';
      return 'Every run starts here, and a run that ends here is accepted.';
    },
    done: (ctx) =>
      onAutomaton(
        ctx,
        false,
        (a, r) =>
          r.q0 !== undefined && startStates(a).includes(r.q0.id) && a.accepting.includes(r.q0.id),
      ),
    // Halfway (S or A pressed) with the selection gone since, the other key would do nothing.
    first: (ctx) =>
      onAutomaton(ctx, null, (a, r) => {
        if (!r.q0 || ctx.selected.includes(r.q0.id)) return null;
        const halfway = startStates(a).includes(r.q0.id) || a.accepting.includes(r.q0.id);
        return halfway ? `First, click ${chip(r.q0.label)} again.` : null;
      }),
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'add-q1',
    part: 1,
    instruction: () => `Add a second state and rename it \`${NAMES.odd}\`.`,
    why: () => 'It will mean: an odd number of zeros so far.',
    done: (ctx) => onAutomaton(ctx, false, (_, r) => isNamed(r.q1)),
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
    // Any name of the user's own will do, but not one part 1 asked for.
    done: (ctx) =>
      onAutomaton(
        ctx,
        false,
        (_, r) =>
          r.q0 !== undefined &&
          isNamed(r.q0) &&
          !PART1_NAMES.includes(r.q0.label.trim().toLowerCase()),
      ),
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
    id: 'done',
    part: 3,
    instruction: () =>
      'You built a DFA and changed what it accepts. Press [?] any time for all the controls.',
    done: () => false,
  },
];

function toStep(spec: StepSpec, i: number): Step {
  const structural = spec.run === undefined && spec.part !== 3;
  const done = (ctx: TutorialContext): boolean =>
    spec.done ? spec.done(ctx) : (spec.edges ?? []).every((e) => edgeIs(ctx, e));
  const hint = (ctx: TutorialContext): Hint | null => {
    if (!ctx.isActive) return { kind: 'elsewhere' };
    if (structural && ctx.trace) {
      const prev = SPECS[i - 1];
      const t = ctx.trace;
      const endsPart =
        prev?.run !== undefined &&
        prev.part !== spec.part &&
        t.kind === 'run' &&
        t.source.id === ctx.automaton?.id &&
        t.word === prev.run.word &&
        t.accepted === prev.run.accepted;
      return endsPart && prev.part !== 3
        ? { kind: 'part-done', part: prev.part }
        : { kind: 'first', text: 'First, press [Esc] to get back to editing.' };
    }
    const text =
      (spec.part === 1 ? part1Hint(ctx) : null) ??
      (spec.part !== 3 ? nfaHint(ctx) : null) ??
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
 * Move through every step that is done, latching runs that reached their verdict. Never moves
 * while another automaton is open, and never falls back past the start of `progress`'s part.
 */
export function advance(
  progress: number,
  latched: ReadonlySet<StepId>,
  ctx: TutorialContext,
  /** The step on the card now: kept as it is while another automaton is open. */
  current: number = progress,
): Progress {
  if (!ctx.isActive || !ctx.automaton) return { progress, current, latched };
  let held = latched;
  for (;;) {
    const isDone = (i: number): boolean => {
      const s = STEPS[i]!;
      return s.run ? held.has(s.id) : s.done(ctx);
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
      if (s.run && runSucceeded(s, ctx)) {
        held = new Set([...held, s.id]);
        continue;
      }
      return { progress, current: undone, latched: held };
    }
    if (progress === LAST) return { progress, current: LAST, latched: held };
    progress += 1;
  }
}
