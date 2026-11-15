import { EPSILON } from '../../../core/model';
import type { Automaton } from '../../../core/model';
import type { Lesson, StepSpec } from '../engine';
import { atMoment, otherWordHint, reached, runOf } from './handStep';

/** The lesson opens on this NFA for a*b*: `q_0 –ε→ q_1` makes the second state start with the first. */
const A_STAR_B_STAR: Automaton = {
  id: 'epsilon-lesson',
  name: 'a*b*',
  kind: 'NFA',
  alphabet: ['a', 'b'],
  states: [
    { id: 'q_0', label: 'q_0', x: 160, y: 200 },
    { id: 'q_1', label: 'q_1', x: 400, y: 200 },
  ],
  starts: ['q_0'],
  accepting: ['q_1'],
  transitions: [
    { id: 't0', from: 'q_0', to: 'q_0', symbols: ['a'], loopAngle: -Math.PI / 2 },
    { id: 't1', from: 'q_0', to: 'q_1', symbols: [EPSILON] },
    { id: 't2', from: 'q_1', to: 'q_1', symbols: ['b'], loopAngle: -Math.PI / 2 },
  ],
};

const STEPS: StepSpec[] = [
  {
    id: 'epsilon/idea',
    idea: true,
    instruction: () =>
      'An ε-arrow moves without reading a letter. The NFA takes it for free, so whenever it can reach a state by ε, it is in that state too.',
  },
  {
    id: 'epsilon/run',
    instruction: () => 'Run `b`.',
    latch: (ctx) => runOf(ctx, 'b') !== null,
    hint: otherWordHint('b'),
  },
  {
    id: 'epsilon/closure',
    instruction: () => 'Press [→] to follow the ε-arrow.',
    explain: (l) => `It starts in ${l.q0} and hasn't read anything yet.`,
    ...atMoment('b', 0),
    latch: reached('b', 1),
  },
  {
    id: 'epsilon/read',
    instruction: () => 'Press [→] to read the `b`.',
    explain: (l) =>
      `It took the ε-arrow for free: it's in ${l.q0} and ${l.q1} before reading a letter.`,
    ...atMoment('b', 1),
    latch: reached('b', 2),
  },
  {
    id: 'epsilon/verdict',
    instruction: () => 'Press [→] for the verdict.',
    explain: (l) => `${l.q0} has no arrow on \`b\`, but ${l.q1} does: no \`a\` was needed.`,
    // A run step, so the next step's wrong-word hint accepts the still-open `b` run.
    run: { word: 'b', accepted: true },
    ...atMoment('b', 2, true),
  },
  {
    id: 'epsilon/ba',
    instruction: () => 'Press [Esc], then run `ba`.',
    // Only while the `b` run is open at its verdict: it says nothing about `ba`.
    explain: (l, ctx) => {
      const t = runOf(ctx, 'b');
      return t !== null && ctx.stepIndex === t.steps.length - 1
        ? `It ended in ${l.q1}, which accepts.`
        : null;
    },
    run: { word: 'ba', accepted: false },
  },
];

export const EPSILON_LESSON: Lesson & { id: 'epsilon' } = {
  id: 'epsilon',
  noun: 'lesson',
  title: 'ε-moves',
  summary: 'Arrows that read nothing',
  minutes: 1,
  start: A_STAR_B_STAR,
  editable: false,
  pausedRuns: ['b'],
  parts: [
    {
      title: 'Follow an ε-arrow',
      goal: {
        text: 'Follow an NFA with an ε-arrow',
        examples: [
          { word: 'b', accepted: true },
          { word: 'ba', accepted: false },
        ],
      },
      steps: STEPS,
    },
  ],
  closing:
    'ε costs nothing: the NFA is in every state it can reach by ε-arrows, before and after each letter.',
};
