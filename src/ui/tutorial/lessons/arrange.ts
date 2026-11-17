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

/** Divisible by 5, drawn badly on purpose: only the positions are messy, nothing else is set. */
const DIVISIBLE_BY_5: Automaton = {
  id: 'arrange-lesson',
  name: 'Divisible by 5',
  kind: 'DFA',
  alphabet: ['0', '1'],
  states: NAMES.map((id) => ({ id, label: id, x: POSITIONS[id]![0], y: POSITIONS[id]![1] })),
  starts: ['q_0'],
  accepting: ['q_0'],
  transitions: [
    ['q_0', 'q_0', '0'],
    ['q_0', 'q_1', '1'],
    ['q_1', 'q_2', '0'],
    ['q_1', 'q_3', '1'],
    ['q_2', 'q_4', '0'],
    ['q_2', 'q_0', '1'],
    ['q_3', 'q_1', '0'],
    ['q_3', 'q_2', '1'],
    ['q_4', 'q_3', '0'],
    ['q_4', 'q_4', '1'],
  ].map(([from, to, sym], i) => ({ id: `t${i}`, from: from!, to: to!, symbols: [sym!] })),
};

const SAME = 1e-6;
const THREE: StateId[] = ['q_0', 'q_2', 'q_3'];

const hasAll = (ctx: TutorialContext, ids: readonly StateId[]): boolean =>
  ids.every((id) => ctx.selected.includes(id));

const stateOf = (a: Automaton, id: StateId) => a.states.find((s) => s.id === id);

/** The three states are all off where Tidy put them by one and the same, non-zero, offset. */
function movedTogether(ctx: TutorialContext, ids: readonly StateId[]): boolean {
  const a = ctx.automaton;
  const t = ctx.tidied;
  if (!a || !t) return false;
  const offsets = ids.map((id) => {
    const now = stateOf(a, id);
    const was = stateOf(t, id);
    return now && was ? { x: now.x - was.x, y: now.y - was.y } : null;
  });
  const first = offsets[0];
  if (!first || Math.hypot(first.x, first.y) <= SAME) return false;
  return offsets.every(
    (o) => o !== null && Math.abs(o.x - first.x) <= SAME && Math.abs(o.y - first.y) <= SAME,
  );
}

const startAngleOf = (a: Automaton): number => stateOf(a, 'q_0')?.startAngle ?? START_ANGLE;

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
    instruction: () => 'Hold [Ctrl] and drag a box around «q_0» and «q_2».',
    why: () => 'A box selects every state inside it.',
    latch: (ctx) => !!ctx.automaton && hasAll(ctx, ['q_0', 'q_2']),
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
    done: (ctx) => movedTogether(ctx, THREE),
    first: (ctx) =>
      !hasAll(ctx, THREE) && !movedTogether(ctx, THREE)
        ? 'First, select «q_0», «q_2» and «q_3» again.'
        : null,
  },
  {
    id: 'arrange/snap',
    instruction: () => 'Drag «q_1» until it snaps into line with «q_4».',
    why: () => 'States snap into line, and to equal gaps, as you drag them.',
    done: (ctx) => {
      const p = ctx.automaton && stateOf(ctx.automaton, 'q_1');
      const q = ctx.automaton && stateOf(ctx.automaton, 'q_4');
      return !!p && !!q && (p.x === q.x || p.y === q.y);
    },
  },
  {
    id: 'arrange/bend',
    instruction: () => 'Drag the arrow from «q_3» to «q_2» to bend it.',
    why: () => 'Drag a loop the same way to turn it around its state.',
    done: (ctx) =>
      !!ctx.automaton &&
      !!ctx.tidied &&
      drawnBend(ctx.automaton, 'q_3', 'q_2') !== drawnBend(ctx.tidied, 'q_3', 'q_2'),
  },
  {
    id: 'arrange/label',
    instruction: () => 'Drag that arrow’s `1` to the other side.',
    done: (ctx) => {
      const a = ctx.automaton;
      const t = a?.transitions.find((x) => x.from === 'q_3' && x.to === 'q_2');
      if (!a || !t) return false;
      const b = drawnBend(a, 'q_3', 'q_2');
      return labelSideOf(b, t.labelSide) !== labelSideOf(b, undefined);
    },
  },
  {
    id: 'arrange/start',
    instruction: () => 'Drag the start arrow to turn it around «q_0».',
    done: (ctx) =>
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

/** Steps 0, 1-3 and 4-8 of `STEPS`, by part. */
const PART_SIZES = [1, 3, 5] as const;
const PART_TITLES = ['Tidy up', 'Select and move', 'Fine-tune'] as const;

const GOAL = { text: 'Tidy this DFA up, then make it yours', examples: [] };

export const ARRANGE_LESSON: Lesson & { id: 'arrange' } = {
  id: 'arrange',
  noun: 'lesson',
  title: 'Arrange',
  summary: 'Tidy, select, move, bend',
  minutes: 2,
  start: DIVISIBLE_BY_5,
  editable: false,
  parts: PART_SIZES.map((size, i) => {
    const from = PART_SIZES.slice(0, i).reduce((n, s) => n + s, 0);
    return { title: PART_TITLES[i]!, goal: GOAL, steps: STEPS.slice(from, from + size) };
  }),
  closing: 'That’s arranging: Tidy first, then fine-tune by hand. [?] shows every gesture again.',
};
