import { startStates } from '../../core/model';
import type { Automaton, State, StateId, Sym } from '../../core/model';
import type { AnyTrace } from '../../core/trace';

export type LessonId = 'basics' | 'nfa' | 'convert' | 'minimize' | 'share';

/** Something done in the shell that leaves no trace in the state (see the spec's *Actions*). */
export type LessonAction =
  'share-link' | 'copy-image' | 'export-svg' | 'export-png' | 'copy-latex' | 'export-latex';

/** What the steps look at: the lesson's automaton (by id) and whatever run is on screen. */
export interface TutorialContext {
  /** The lesson's own automaton. */
  automaton: Automaton | undefined;
  /** The lesson's automaton is the one open. */
  isActive: boolean;
  trace: AnyTrace | null;
  stepIndex: number;
  /** The selected states. */
  selected: readonly StateId[];
  /** The automata the lesson owns: for now only its own automaton. */
  owned: readonly string[];
  /** Actions reported while the lesson runs: none yet. */
  actions: ReadonlySet<LessonAction>;
}

/**
 * What a part builds, shown at the top of the card for the whole part so the steps have a point:
 * a few words (same markup as the steps), words it accepts and rejects, and a picture of the
 * finished automaton, with `description` as the picture's text alternative. `after`: a second
 * picture, for a part that turns one automaton into another.
 */
export interface Goal {
  text: string;
  examples: { word: string; accepted: boolean }[];
  automaton: Automaton;
  description: string;
  after?: { automaton: Automaton; description: string };
}

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
  | { kind: 'part-done'; part: number }
  | { kind: 'first'; text: string }
  | { kind: 'text'; text: string };

/** The current labels of the start state and the other one, as chips (see `roles`). */
export interface Labels {
  q0: string;
  q1: string;
}

/** An edge a step draws, between the roles, and the symbols it should read. */
export interface WantedEdge {
  from: 'q0' | 'q1';
  to: 'q0' | 'q1';
  symbols: Sym[];
}

/** One step as a lesson writes it. */
export interface StepSpec {
  id: string;
  /**
   * What to do, in one short sentence. Words and symbols in backticks, keys in brackets
   * (`[Shift]`, `[0]`), state labels in guillemets as typed (`«q_0»`), drawn as a small state
   * with `LabelText`. `ctx` for a step that follows the user halfway through it.
   */
  instruction(l: Labels, ctx: TutorialContext): string;
  /** Why, in a few words, under the instruction (same markup), if it needs saying. */
  why?(l: Labels, ctx: TutorialContext): string;
  done?(ctx: TutorialContext): boolean;
  /** Hints of this step only, after the common ones. */
  hint?(ctx: TutorialContext): string | null;
  /** Something to do before this step, shown as a `first` hint. */
  first?(ctx: TutorialContext): string | null;
  /** The edges this step draws: done once they read exactly their symbols. */
  edges?: WantedEdge[];
  /** CSS selector of what to point at, if anything. */
  target?(ctx: TutorialContext): string | null;
  run?: { word: string; accepted: boolean };
}

export interface LessonPart {
  /** For the card's header and the hand-over between the parts. */
  title: string;
  goal: Goal;
  /** What the part achieved, on the hand-over panel; only parts followed by another. */
  done?: string;
  steps: StepSpec[];
  /** Hints that hold for every step of the part, before the step's own. */
  hint?(ctx: TutorialContext): string | null;
}

export interface Lesson {
  id: LessonId;
  /** What the card and the popup call it. */
  noun: 'tutorial' | 'lesson';
  /** In the list and the card's header. */
  title: string;
  /** One line in the list. */
  summary: string;
  minutes: number;
  /** The automaton it opens on; null: a blank DFA (Basics). */
  start: Automaton | null;
  editable: boolean;
  /** Runs and conversions of its automata start playing as they open. */
  autoPlay: boolean;
  parts: LessonPart[];
  /** The closing card's text. */
  closing: string;
}

export interface Step {
  id: string;
  /** From 1; `parts.length + 1` is the closing card. */
  part: number;
  instruction(ctx: TutorialContext): string;
  why(ctx: TutorialContext): string | null;
  /** Structural check. Run steps are done once latched (see `runSucceeded`). */
  done(ctx: TutorialContext): boolean;
  hint(ctx: TutorialContext): Hint | null;
  /** CSS selector of what to point at, if anything. */
  target(ctx: TutorialContext): string | null;
  run?: { word: string; accepted: boolean };
}

/** q0 is the start state (or the first state before there is one); q1 is the first other state. */
export function roles(a: Automaton): { q0?: State; q1?: State } {
  const startId = startStates(a)[0];
  const q0 = a.states.find((s) => s.id === startId) ?? a.states[0];
  const q1 = a.states.find((s) => s.id !== q0?.id);
  return { q0, q1 };
}

/** The symbols of the edge `from` → `to`, if any. */
export function edge(a: Automaton, from: StateId | undefined, to: StateId | undefined): Sym[] {
  return a.transitions.find((t) => t.from === from && t.to === to)?.symbols ?? [];
}

function sameSet(xs: Sym[], ys: Sym[]): boolean {
  return xs.length === ys.length && xs.every((x) => ys.includes(x));
}

/** A state label as the card draws it: a small state. */
export const chip = (label: string): string => `«${label}»`;

/** The current labels of q0 and q1, as chips. */
function labels(ctx: TutorialContext): Labels {
  const r = ctx.automaton ? roles(ctx.automaton) : {};
  return { q0: chip(r.q0?.label ?? 'q_0'), q1: chip(r.q1?.label ?? 'q_1') };
}

/** What `fn` says about the automaton, or `fallback` without one. */
export function onAutomaton<T>(
  ctx: TutorialContext,
  fallback: T,
  fn: (a: Automaton, r: { q0?: State; q1?: State }) => T,
): T {
  return ctx.automaton ? fn(ctx.automaton, roles(ctx.automaton)) : fallback;
}

export function edgeIs(ctx: TutorialContext, e: WantedEdge): boolean {
  return onAutomaton(ctx, false, (a, r) => sameSet(edge(a, r[e.from]?.id, r[e.to]?.id), e.symbols));
}

/** "q_0 → q_1 should read only 0." when that edge exists with other symbols. */
export function wrongSymbols(ctx: TutorialContext, edges: WantedEdge[]): string | null {
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

/** A run of another word on the lesson's automaton is open (the previous step's run is fine). */
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

/** A step spec with the part it belongs to (from 1). */
interface Placed {
  spec: StepSpec;
  part: number;
}

function toStep(lesson: Lesson, all: readonly Placed[], i: number): Step {
  const { spec, part } = all[i]!;
  const closing = part > lesson.parts.length;
  const partHint = lesson.parts[part - 1]?.hint;
  const structural = spec.run === undefined && !closing;
  const done = (ctx: TutorialContext): boolean =>
    spec.done ? spec.done(ctx) : (spec.edges ?? []).every((e) => edgeIs(ctx, e));
  const hint = (ctx: TutorialContext): Hint | null => {
    if (!ctx.isActive) return { kind: 'elsewhere' };
    if (structural && ctx.trace) {
      const prev = all[i - 1];
      const t = ctx.trace;
      const endsPart =
        prev?.spec.run !== undefined &&
        prev.part !== part &&
        t.kind === 'run' &&
        t.source.id === ctx.automaton?.id &&
        t.word === prev.spec.run.word &&
        t.accepted === prev.spec.run.accepted;
      return endsPart
        ? { kind: 'part-done', part: prev.part }
        : { kind: 'first', text: 'First, press [Esc] to get back to editing.' };
    }
    const text =
      partHint?.(ctx) ??
      (spec.edges ? wrongSymbols(ctx, spec.edges) : null) ??
      (spec.run ? otherWord(ctx, spec.run.word, all[i - 1]?.spec.run?.word) : null) ??
      spec.hint?.(ctx) ??
      null;
    if (text !== null) return { kind: 'text', text };
    const first = spec.first?.(ctx) ?? null;
    return first === null ? null : { kind: 'first', text: first };
  };
  return {
    id: spec.id,
    part,
    instruction: (ctx) => spec.instruction(labels(ctx), ctx),
    why: (ctx) => spec.why?.(labels(ctx), ctx) ?? null,
    done,
    hint,
    target: (ctx) => spec.target?.(ctx) ?? null,
    ...(spec.run ? { run: spec.run } : {}),
  };
}

const stepsOf = new WeakMap<Lesson, readonly Step[]>();

/** Every step of the lesson, part by part, and its closing card last. */
export function lessonSteps(lesson: Lesson): readonly Step[] {
  const known = stepsOf.get(lesson);
  if (known) return known;
  const closing: StepSpec = {
    id: 'done',
    instruction: () => lesson.closing,
    done: () => false,
  };
  const all: Placed[] = [
    ...lesson.parts.flatMap((p, i) => p.steps.map((spec) => ({ spec, part: i + 1 }))),
    { spec: closing, part: lesson.parts.length + 1 },
  ];
  const steps = all.map((_, i) => toStep(lesson, all, i));
  stepsOf.set(lesson, steps);
  return steps;
}

/** The steps the progress bar counts: all but the closing card. */
export function countedSteps(lesson: Lesson): number {
  return lessonSteps(lesson).length - 1;
}

/** The run step's word ran to its verdict, on the lesson's automaton, with the expected result. */
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
  latched: ReadonlySet<string>;
}

/**
 * Move through every step that is done, latching runs that reached their verdict. Never moves
 * while another automaton is open, and never falls back past the start of `progress`'s part.
 */
export function advance(
  lesson: Lesson,
  progress: number,
  latched: ReadonlySet<string>,
  ctx: TutorialContext,
  /** The step on the card now: kept as it is while another automaton is open. */
  current: number = progress,
): Progress {
  if (!ctx.isActive || !ctx.automaton) return { progress, current, latched };
  const steps = lessonSteps(lesson);
  const last = steps.length - 1;
  const partStart = (i: number): number => {
    const part = steps[i]?.part;
    return steps.findIndex((s) => s.part === part);
  };
  let held = latched;
  for (;;) {
    const isDone = (i: number): boolean => {
      const s = steps[i]!;
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
      const s = steps[undone]!;
      if (s.run && runSucceeded(s, ctx)) {
        held = new Set([...held, s.id]);
        continue;
      }
      return { progress, current: undone, latched: held };
    }
    if (progress === last) return { progress, current: last, latched: held };
    progress += 1;
  }
}
