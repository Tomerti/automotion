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
  | 'start'
  | 'accepting'
  | 'add-q1'
  | 'q0-q1'
  | 'q1-q0'
  | 'loops'
  | 'run-1010'
  | 'run-10'
  | 'delete-q1'
  | 'loop-01'
  | 'rename-q0'
  | 'run-10-again'
  | 'done';

/**
 * `elsewhere`: another automaton is open (the card names it and offers the way back).
 * `part-done`: the run that ended `part` is still open: the card keeps that part on show, its
 * last ✓ included, and asks for Esc to start the next one.
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
   * Words and symbols in backticks, keys in brackets (`[Shift]`, `[0]`); state labels as typed
   * (`q_0`), for `LabelText`.
   */
  instruction(ctx: TutorialContext): string;
  /** Shown as "✓ …" once the step is done. */
  confirmation(ctx: TutorialContext): string;
  /** Structural check. Run steps are done once latched (see `runSucceeded`). */
  done(ctx: TutorialContext): boolean;
  hint(ctx: TutorialContext): Hint | null;
  /** CSS selector of what to point at, if anything. */
  target(ctx: TutorialContext): string | null;
  run?: { word: string; accepted: boolean };
}

export const COUNTED_STEPS = 13;

/** What each part builds, as the checklist's headings. */
export const PART_TITLES: Record<1 | 2, string> = {
  1: 'An even number of zeros',
  2: 'Accept every word',
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

function labels(ctx: TutorialContext): { q0: string; q1: string } {
  const r = ctx.automaton ? roles(ctx.automaton) : {};
  return { q0: r.q0?.label ?? 'q_0', q1: r.q1?.label ?? 'q_1' };
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
        return `${from.label} → ${to.label} should read only ${only}.`;
      }
    }
    return null;
  });
}

/** Hints that hold for every step of part 1. */
function part1Hint(ctx: TutorialContext): string | null {
  return onAutomaton(ctx, null, (a, r) => {
    const extra = a.states.find((s) => s.id !== r.q0?.id && s.id !== r.q1?.id);
    if (extra) return `Delete the extra state ${extra.label}: click it, then press [Delete].`;
    if (r.q0 && r.q1 && a.accepting.includes(r.q1.id)) {
      return `Only ${r.q0.label} should be accepting: click ${r.q1.label} and press [A].`;
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
  instruction(l: { q0: string; q1: string }): string;
  confirmation(l: { q0: string; q1: string }): string;
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

const SPECS: StepSpec[] = [
  {
    id: 'add-q0',
    part: 1,
    instruction: () => 'Add a state: double-click anywhere on the canvas.',
    confirmation: (l) => `Added ${l.q0}`,
    done: (ctx) => onAutomaton(ctx, false, (a) => a.states.length >= 1),
  },
  {
    id: 'start',
    part: 1,
    instruction: (l) => `Make ${l.q0} the start state: click it, then press [S].`,
    confirmation: (l) => `${l.q0} is the start state`,
    done: (ctx) => onAutomaton(ctx, false, (a) => startStates(a).length > 0),
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'accepting',
    part: 1,
    instruction: (l) =>
      `Make ${l.q0} accepting too: a word is accepted when its run ends here. Press [A].`,
    confirmation: (l) => `${l.q0} is accepting`,
    done: (ctx) =>
      onAutomaton(ctx, false, (a, r) => r.q0 !== undefined && a.accepting.includes(r.q0.id)),
    // A click on the canvas since the last step clears the selection, and A then does nothing.
    first: (ctx) =>
      onAutomaton(ctx, null, (_, r) =>
        r.q0 && !ctx.selected.includes(r.q0.id) ? `First, click ${r.q0.label} to select it.` : null,
      ),
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'add-q1',
    part: 1,
    instruction: () => 'Add a second state: double-click the canvas again.',
    confirmation: (l) => `Added ${l.q1}`,
    done: (ctx) => onAutomaton(ctx, false, (a) => a.states.length >= 2),
  },
  {
    id: 'q0-q1',
    part: 1,
    instruction: (l) =>
      `Reading a \`0\` in ${l.q0} goes to ${l.q1}: hold [Shift] and drag from ${l.q0} to ${l.q1}, then type [0] and press [Enter].`,
    confirmation: (l) => `${l.q0} → ${l.q1} reads \`0\``,
    edges: [PART1_EDGES[0]!],
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'q1-q0',
    part: 1,
    instruction: (l) =>
      `…and reading a \`0\` in ${l.q1} goes back: hold [Shift] and drag from ${l.q1} to ${l.q0}, then type [0] and press [Enter].`,
    confirmation: (l) => `${l.q1} → ${l.q0} reads \`0\``,
    edges: [PART1_EDGES[1]!],
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q1)),
  },
  {
    id: 'loops',
    part: 1,
    instruction: () =>
      'Reading a `1` changes nothing: give both states a loop. Hold [Shift] and drag from a state, out and back onto itself, then type [1] and press [Enter].',
    confirmation: () => 'Both states loop on `1`',
    edges: [PART1_EDGES[2]!, PART1_EDGES[3]!],
    target: (ctx) =>
      onAutomaton(ctx, null, (_, r) => stateTarget(edgeIs(ctx, PART1_EDGES[2]!) ? r.q1 : r.q0)),
  },
  {
    id: 'run-1010',
    part: 1,
    instruction: () =>
      'Test it: type `1010` in “Test a word” and press [Enter]. It should end in Accepted.',
    confirmation: () => '`1010` is accepted',
    run: { word: '1010', accepted: true },
    target: () => RUN_PILL,
  },
  {
    id: 'run-10',
    part: 1,
    instruction: () =>
      'Now try `10`, which should be rejected: press [Esc] to get back to editing, then run it.',
    confirmation: () => '`10` is rejected, as it should be: it has an odd number of zeros',
    run: { word: '10', accepted: false },
    target: () => RUN_PILL,
  },
  {
    id: 'delete-q1',
    part: 2,
    instruction: (l) => `Delete ${l.q1}: click it, then press [Delete]. Its arrows go with it.`,
    confirmation: (l) => `${l.q1} is gone`,
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
          return `That was the start state: press [Ctrl] + [Z] to undo, then delete ${r.q0.label}.`;
        }
        return null;
      }),
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q1)),
  },
  {
    id: 'loop-01',
    part: 2,
    instruction: (l) =>
      `Let ${l.q0}’s loop read both symbols: double-click its label, type \`0,1\` and press [Enter].`,
    confirmation: (l) => `${l.q0} loops on \`0\` and \`1\``,
    // Not `edges`: a loop still reading only 1 is unfinished, not wrong.
    done: (ctx) => edgeIs(ctx, { from: 'q0', to: 'q0', symbols: ['0', '1'] }),
    hint: (ctx) =>
      onAutomaton(ctx, null, (a, r) =>
        edge(a, r.q0?.id, r.q0?.id).some((s) => s !== '0' && s !== '1')
          ? `${r.q0?.label ?? 'q_0'}’s loop should read only \`0\` and \`1\`.`
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
    instruction: (l) =>
      `${l.q0} now accepts every word, so name it that: double-click ${l.q0}, type \`any\` and press [Enter].`,
    confirmation: (l) => `Renamed it ${l.q0}`,
    // Any name of the user's own will do.
    done: (ctx) =>
      onAutomaton(ctx, false, (_, r) => r.q0 !== undefined && !DEFAULT_LABEL.test(r.q0.label)),
    target: (ctx) => onAutomaton(ctx, null, (_, r) => stateTarget(r.q0)),
  },
  {
    id: 'run-10-again',
    part: 2,
    instruction: () =>
      'Run `10` again: type it in “Test a word” and press [Enter]. Now it’s accepted, like every word.',
    confirmation: () => '`10` is accepted now',
    run: { word: '10', accepted: true },
    target: () => RUN_PILL,
  },
  {
    id: 'done',
    part: 3,
    instruction: () =>
      'You built a DFA, ran it, changed what it accepts and named a state. Press [?] for all the controls.',
    confirmation: () => '',
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
    instruction: (ctx) => spec.instruction(labels(ctx)),
    confirmation: (ctx) => spec.confirmation(labels(ctx)),
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
