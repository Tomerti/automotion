import { startStates } from '../../core/model';
import type { Automaton, State, StateId, Sym } from '../../core/model';
import { traceSourceId } from '../../core/trace';
import type { AnyTrace } from '../../core/trace';

export const LESSON_IDS = ['basics', 'nfa', 'epsilon', 'convert', 'minimize', 'share'] as const;
export type LessonId = (typeof LESSON_IDS)[number];

/** Something done in the shell that leaves no trace in the state (see the spec's *Actions*). */
export type LessonAction =
  'share-link' | 'copy-image' | 'export-svg' | 'export-png' | 'copy-latex' | 'export-latex';

/** What the steps look at: the lesson's automaton (by id) and whatever run is on screen. */
export interface TutorialContext {
  /** The lesson's own automaton. */
  automaton: Automaton | undefined;
  /** An automaton the lesson owns is the one open (for Basics: its own automaton). */
  isActive: boolean;
  trace: AnyTrace | null;
  stepIndex: number;
  /** The selected states. */
  selected: readonly StateId[];
  /**
   * The automata the lesson owns: its own automaton, and any saved from a walkthrough of an owned
   * one while the lesson runs.
   */
  owned: readonly string[];
  /** Actions reported on an owned automaton since the lesson started (see `noteLessonAction`). */
  actions: ReadonlySet<LessonAction>;
}
/** `trace` was computed from an automaton in `owned`. */
export function ownsId(owned: readonly string[], trace: AnyTrace): boolean {
  return owned.includes(traceSourceId(trace));
}

/** The open trace is a run or walkthrough of an automaton the lesson owns. */
export function ownsTrace(ctx: TutorialContext): boolean {
  return ctx.trace !== null && ownsId(ctx.owned, ctx.trace);
}

/** An owned automaton is open, or a walkthrough of one: anything else is "elsewhere". */
function onOwned(ctx: TutorialContext): boolean {
  return ctx.isActive || ownsTrace(ctx);
}

/**
 * What a part builds, shown at the top of the card for the whole part so the steps have a point:
 * a few words (same markup as the steps) and words it accepts and rejects. Basics also has a
 * picture of the finished automaton, with `description` as its text alternative; the other
 * lessons have none.
 */
export interface Goal {
  text: string;
  examples: { word: string; accepted: boolean }[];
  automaton?: Automaton;
  description?: string;
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
  /**
   * An idea step: a short explanation with no task and no target. It is done only once the user
   * presses Next (`pressNext`), which latches it.
   */
  idea?: true;
  /**
   * What the paused moment shows (same markup), rendered before the instruction while the run or
   * walkthrough sits at the step `pauseAt` names. Null: nothing to say for what is on screen.
   */
  explain?(l: Labels, ctx: TutorialContext): string | null;
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
  /**
   * Something that comes and goes (a walkthrough opening, reaching its end): the step latches
   * once this holds, like a run step at its verdict, and stays done after.
   */
  latch?(ctx: TutorialContext): boolean;
  /** Done (latched) once any of these actions is reported (see `noteLessonAction`). */
  action?: LessonAction[];
  /**
   * The step of the open run or walkthrough where playback pauses while this step is on the
   * card: the moment the next step explains (see `lessonStopAt`). Null: nowhere.
   */
  pauseAt?(ctx: TutorialContext): number | null;
  /**
   * For a latch or run step done on reaching a point of a run or walkthrough: that trace is open
   * but stepped back (←) to before the point. The step shows again, so the card follows the trace
   * back; once the trace is closed, or another one is open, the step stays done.
   */
  steppedBack?(ctx: TutorialContext): boolean;
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
  /** `'test'` is for the tests' own lessons: never listed, never recorded as finished. */
  id: LessonId | 'test';
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
  parts: LessonPart[];
  /** The closing card's text. */
  closing: string;
  /** Words whose runs of an owned automaton open paused (see `lessonOpensPaused`). */
  pausedRuns?: readonly string[];
  /** Convert to DFA walkthroughs of an owned automaton open paused, as Minimize's always do. */
  pausedConvert?: true;
}

export interface Step {
  id: string;
  /** From 1; `parts.length + 1` is the closing card. */
  part: number;
  instruction(ctx: TutorialContext): string;
  /** An idea step: done once Next latches it. */
  idea: boolean;
  /** What the paused moment shows, before the instruction; null if the step has none. */
  explain(ctx: TutorialContext): string | null;
  why(ctx: TutorialContext): string | null;
  /** Structural check. Run, latch and action steps are done once latched instead (see `advance`). */
  done(ctx: TutorialContext): boolean;
  hint(ctx: TutorialContext): Hint | null;
  /** CSS selector of what to point at, if anything. */
  target(ctx: TutorialContext): string | null;
  run?: { word: string; accepted: boolean };
  latch?(ctx: TutorialContext): boolean;
  action?: LessonAction[];
  pauseAt?(ctx: TutorialContext): number | null;
  steppedBack?(ctx: TutorialContext): boolean;
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
  // A check on the automaton: the only kind of step that needs the editor back first.
  const structural = !spec.run && !spec.latch && !spec.action && !spec.idea && !closing;
  const done = (ctx: TutorialContext): boolean =>
    spec.done ? spec.done(ctx) : (spec.edges ?? []).every((e) => edgeIs(ctx, e));
  const hint = (ctx: TutorialContext): Hint | null => {
    if (!onOwned(ctx)) return { kind: 'elsewhere' };
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
    idea: spec.idea === true,
    explain: (ctx) => spec.explain?.(labels(ctx), ctx) ?? null,
    why: (ctx) => spec.why?.(labels(ctx), ctx) ?? null,
    done,
    hint,
    target: (ctx) => spec.target?.(ctx) ?? null,
    ...(spec.run ? { run: spec.run } : {}),
    ...(spec.latch ? { latch: spec.latch } : {}),
    ...(spec.action ? { action: spec.action } : {}),
    ...(spec.pauseAt ? { pauseAt: spec.pauseAt } : {}),
    ...(spec.steppedBack ? { steppedBack: spec.steppedBack } : {}),
  };
}

/** Idea, run, latch and action steps: done once latched, not by a check on the automaton. */
const latching = (s: Step): boolean => s.idea || s.run !== undefined || !!s.latch || !!s.action;

/** The latching step `s` has just happened (an idea step never does: `pressNext` latches it). */
const happened = (s: Step, ctx: TutorialContext): boolean =>
  !s.idea &&
  (runSucceeded(s, ctx) || !!s.latch?.(ctx) || !!s.action?.some((a) => ctx.actions.has(a)));

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

/**
 * The step whose `pauseAt` governs playback while `current` is on the card: `current`'s own, or
 * on an idea step (the user opens the run during the idea) the step the lesson would land on once
 * Next latches the idea, given what is on screen.
 */
export function pacingStep(
  lesson: Lesson,
  at: { progress: number; current: number; latched: ReadonlySet<string> },
  ctx: TutorialContext,
): Step | undefined {
  const steps = lessonSteps(lesson);
  const s = steps[at.current];
  if (!s?.idea) return s;
  const latched = new Set([...at.latched, s.id]);
  return steps[advance(lesson, at.progress, latched, ctx, at.current).current];
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
 * Move through every step that is done, latching runs that reached their verdict, latches that
 * hold and reported actions. Never moves while an automaton the lesson doesn't own is open, and
 * never falls back past the start of `progress`'s part, except that a latched step whose trace is
 * stepped back (`steppedBack`) shows again, from the closing card too.
 */
export function advance(
  lesson: Lesson,
  progress: number,
  latched: ReadonlySet<string>,
  ctx: TutorialContext,
  /** The step on the card now: kept as it is while another automaton is open. */
  current: number = progress,
): Progress {
  if (!onOwned(ctx) || !ctx.automaton) return { progress, current, latched };
  const steps = lessonSteps(lesson);
  const last = steps.length - 1;
  const partStart = (i: number): number => {
    const part = steps[i]?.part;
    return steps.findIndex((s) => s.part === part);
  };
  const back = (s: Step): boolean => !!s.steppedBack?.(ctx);
  // On the closing card, the last part's steps are done; one stepped back to shows again.
  if (steps[progress]!.part > lesson.parts.length) {
    for (let i = partStart(progress - 1); i < progress; i++) {
      const s = steps[i]!;
      if (latching(s) && latched.has(s.id) && back(s)) return { progress, current: i, latched };
    }
  }
  let held = latched;
  for (;;) {
    const isDone = (i: number): boolean => {
      const s = steps[i]!;
      return latching(s) ? held.has(s.id) && !back(s) : s.done(ctx);
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
      if (latching(s) && !back(s) && happened(s, ctx)) {
        held = new Set([...held, s.id]);
        continue;
      }
      return { progress, current: undone, latched: held };
    }
    if (progress === last) return { progress, current: last, latched: held };
    progress += 1;
  }
}
