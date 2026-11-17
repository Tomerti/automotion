import { START_ANGLE, drawnBend, labelSideOf } from '../../../core/geometry';
import type { Automaton, StateId } from '../../../core/model';
import type { Lesson, StepSpec, TutorialContext } from '../engine';

const NAMES = ['q_0', 'q_1', 'q_2', 'q_3', 'q_4'];
const POSITIONS: Record<string, [number, number]> = {
  q_0: [400, 300],
  q_1: [150, 150],
  q_2: [420, 140],
  q_3: [180, 320],
  q_4: [300, 220],
};

/** Number of 0s mod 5 = 0, drawn badly on purpose: only the positions are messy, nothing else is set. */
const ZEROS_MOD_5: Automaton = {
  id: 'arrange-lesson',
  name: 'Number of 0s mod 5 = 0',
  kind: 'DFA',
  alphabet: ['0', '1'],
  states: NAMES.map((id) => ({ id, label: id, x: POSITIONS[id]![0], y: POSITIONS[id]![1] })),
  starts: ['q_0'],
  accepting: ['q_0'],
  transitions: NAMES.flatMap((from, i) => [
    [from, NAMES[(i + 1) % 5]!, '0'],
    [from, from, '1'],
  ]).map(([from, to, sym], i) => ({ id: `t${i}`, from: from!, to: to!, symbols: [sym!] })),
};

const SAME = 1e-6;
const THREE: StateId[] = ['q_1', 'q_2', 'q_3'];

const hasAll = (ctx: TutorialContext, ids: readonly StateId[]): boolean =>
  ids.every((id) => ctx.selected.includes(id));

const stateOf = (a: Automaton, id: StateId) => a.states.find((s) => s.id === id);

/** Where each state sits relative to where Tidy left it, null if it or the snapshot is missing. */
function offsetsFromTidy(ctx: TutorialContext, ids: readonly StateId[]) {
  const a = ctx.automaton;
  const t = ctx.tidied;
  if (!a || !t) return null;
  return ids.map((id) => {
    const now = stateOf(a, id);
    const was = stateOf(t, id);
    return now && was ? { x: now.x - was.x, y: now.y - was.y } : null;
  });
}

/** Every offset equals the first. */
function sameOffsets(offsets: ReturnType<typeof offsetsFromTidy>): boolean {
  const first = offsets?.[0];
  if (!offsets || !first) return false;
  return offsets.every(
    (o) => o !== null && Math.abs(o.x - first.x) <= SAME && Math.abs(o.y - first.y) <= SAME,
  );
}

/** The three states are all off where Tidy put them by one and the same, non-zero, offset. */
function movedTogether(ctx: TutorialContext, ids: readonly StateId[]): boolean {
  const offsets = offsetsFromTidy(ctx, ids);
  const first = offsets?.[0];
  if (!first || Math.hypot(first.x, first.y) <= SAME) return false;
  return sameOffsets(offsets);
}

/** One of them moved on its own: no group drag can complete the step until Tidy resets them. */
function movedApart(ctx: TutorialContext, ids: readonly StateId[]): boolean {
  const offsets = offsetsFromTidy(ctx, ids);
  return !!offsets && !sameOffsets(offsets);
}

const startAngleOf = (a: Automaton): number => stateOf(a, 'q_0')?.startAngle ?? START_ANGLE;

/**
 * Every step after Tidy latches: a gesture counts the moment it happens, so dragging the start arrow
 * (or a bend, a label, the three) back to where it was doesn't undo it, and nor does Tidy again.
 */
const STEPS: StepSpec[] = [
  {
    id: 'arrange/tidy',
    instruction: () => 'Press Tidy at the top.',
    why: () => 'It lays out the whole automaton the way you’d draw it by hand.',
    action: ['tidy'],
    target: () => 'button[aria-label="Tidy"]',
  },
  {
    id: 'arrange/box',
    instruction: () => 'Hold [Ctrl] and drag a box around «q_1» and «q_2».',
    why: () => 'A box selects every state inside it.',
    latch: (ctx) => !!ctx.automaton && hasAll(ctx, ['q_1', 'q_2']),
  },
  {
    id: 'arrange/add',
    instruction: () => '[Ctrl] + click «q_3» to add it.',
    why: () => '[Ctrl] + click a selected state to take it out again.',
    latch: (ctx) => !!ctx.automaton && hasAll(ctx, THREE),
  },
  {
    id: 'arrange/move',
    instruction: () => 'Drag one of them: the other two move along.',
    latch: (ctx) => movedTogether(ctx, THREE),
    first: (ctx) => {
      if (movedTogether(ctx, THREE)) return null;
      if (movedApart(ctx, THREE)) return 'First, press Tidy: one of them moved on its own.';
      return hasAll(ctx, THREE) ? null : 'First, select «q_1», «q_2» and «q_3» again.';
    },
  },
  {
    id: 'arrange/bend',
    instruction: () => 'Drag the line from «q_4» to «q_0» to bend the arrow.',
    why: () => 'Drag a loop the same way to turn it around its state.',
    latch: (ctx) =>
      !!ctx.automaton &&
      !!ctx.tidied &&
      drawnBend(ctx.automaton, 'q_4', 'q_0') !== drawnBend(ctx.tidied, 'q_4', 'q_0'),
  },
  {
    id: 'arrange/label',
    instruction: () => 'Now drag the `0` written on that arrow across it, to the other side.',
    why: () => 'Drag the line to bend an arrow, and its symbols to move them.',
    latch: (ctx) => {
      const a = ctx.automaton;
      const t = a?.transitions.find((x) => x.from === 'q_4' && x.to === 'q_0');
      if (!a || !t) return false;
      const b = drawnBend(a, 'q_4', 'q_0');
      return labelSideOf(b, t.labelSide) !== labelSideOf(b, undefined);
    },
  },
  {
    id: 'arrange/start',
    instruction: () => 'Drag the start arrow to turn it around «q_0».',
    latch: (ctx) =>
      !!ctx.automaton && !!ctx.tidied && startAngleOf(ctx.automaton) !== startAngleOf(ctx.tidied),
  },
  {
    id: 'arrange/all',
    instruction: () => 'Press [Ctrl] + [A].',
    why: () => 'Everything is selected: drag any state and the whole automaton moves.',
    latch: (ctx) =>
      !!ctx.automaton && ctx.automaton.states.every((s) => ctx.selected.includes(s.id)),
  },
];

/** Steps 0, 1-3 and 4-7 of `STEPS`, by part. */
const PART_SIZES = [1, 3, 4] as const;
const PART_TITLES = ['Tidy up', 'Select and move', 'Fine-tune'] as const;

const GOAL = { text: 'Learn to arrange a diagram: Tidy first, then by hand', examples: [] };

export const ARRANGE_LESSON: Lesson & { id: 'arrange' } = {
  id: 'arrange',
  noun: 'lesson',
  title: 'Arrange',
  summary: 'Tidy, select, move, bend',
  minutes: 2,
  start: ZEROS_MOD_5,
  editable: false,
  parts: PART_SIZES.map((size, i) => {
    const from = PART_SIZES.slice(0, i).reduce((n, s) => n + s, 0);
    return { title: PART_TITLES[i]!, goal: GOAL, steps: STEPS.slice(from, from + size) };
  }),
  closing: 'That’s arranging: Tidy first, then fine-tune by hand. [?] shows every gesture again.',
};
