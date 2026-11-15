import { minimize } from '../../../core/minimize';
import type { Automaton } from '../../../core/model';
import type { MinimizeTrace } from '../../../core/trace';
import { ownsTrace } from '../engine';
import type { Lesson, StepSpec, TutorialContext } from '../engine';
import { AFTER_SPOTS } from './convert';

/** The DFA the convert lesson ends with ("Contains 01"), written out by hand; ids equal labels. */
const CONTAINS_01_DFA: Automaton = {
  id: 'minimize-lesson',
  name: 'Contains 01 → DFA',
  kind: 'DFA',
  alphabet: ['0', '1'],
  states: ['{q_0}', '{q_0,q_1}', '{q_0,q_2}', '{q_0,q_1,q_2}'].map((label) => ({
    id: label,
    label,
    ...(AFTER_SPOTS[label] as { x: number; y: number }),
  })),
  starts: ['{q_0}'],
  accepting: ['{q_0,q_2}', '{q_0,q_1,q_2}'],
  transitions: [
    ['{q_0}', '{q_0,q_1}', '0'],
    ['{q_0}', '{q_0}', '1'],
    ['{q_0,q_1}', '{q_0,q_1}', '0'],
    ['{q_0,q_1}', '{q_0,q_2}', '1'],
    ['{q_0,q_2}', '{q_0,q_1,q_2}', '0'],
    ['{q_0,q_2}', '{q_0,q_2}', '1'],
    ['{q_0,q_1,q_2}', '{q_0,q_1,q_2}', '0'],
    ['{q_0,q_1,q_2}', '{q_0,q_2}', '1'],
  ].map(([from, to, sym]) => ({
    id: `${from}->${to}`,
    from: from as string,
    to: to as string,
    symbols: [sym as string],
    ...(from === to ? { loopAngle: -Math.PI / 2 } : {}),
  })),
};

/** What minimizing gives, its loops pointing up like the others'. */
const MINIMIZED: Automaton = (() => {
  const result = minimize(CONTAINS_01_DFA).result;
  return {
    ...result,
    transitions: result.transitions.map((t) =>
      t.from === t.to ? { ...t, loopAngle: -Math.PI / 2 } : t,
    ),
  };
})();

const DOCK = '[data-testid="dock"]';

/** The open trace is a minimize walkthrough of an automaton the lesson owns. */
function minimizeOf(ctx: TutorialContext): MinimizeTrace | null {
  const t = ctx.trace;
  return t?.kind === 'minimize' && ownsTrace(ctx) ? t : null;
}

const needMinimize = (ctx: TutorialContext): string | null =>
  minimizeOf(ctx) ? null : 'First, press Minimize again.';

const STEPS: StepSpec[] = [
  {
    id: 'minimize/open',
    instruction: () => 'Press Minimize at the top.',
    why: () => 'It looks for states no word can tell apart, and merges them.',
    latch: (ctx) => minimizeOf(ctx) !== null,
    target: () => 'button[aria-label="Minimize"]',
  },
  {
    id: 'minimize/split',
    instruction: () => 'Step with [→] until a block splits.',
    why: () =>
      'On a `1`, «{q_0}» stays put but «{q_0,q_1}» reaches an accepting state, so they differ.',
    latch: (ctx) => {
      const split = minimizeOf(ctx)?.steps.findIndex((s) => s.phase === 'split') ?? -1;
      return split >= 0 && ctx.stepIndex >= split;
    },
    first: needMinimize,
    target: () => '.av-player-explanation',
  },
  {
    id: 'minimize/end',
    instruction: () => 'Press Play, or [Space], to run it to the end.',
    why: () =>
      'Nothing splits any more, so states in a block act alike: each block becomes one state.',
    latch: (ctx) => {
      const t = minimizeOf(ctx);
      return t !== null && ctx.stepIndex === t.steps.length - 1;
    },
    first: needMinimize,
    target: () => DOCK,
  },
  {
    id: 'minimize/save',
    instruction: () => 'Press Save as new automaton to keep the smaller DFA.',
    why: () => 'Saved, it’s an automaton of its own: you can run words on it, or share it.',
    latch: (ctx) => ctx.owned.length > 1,
    first: (ctx) => {
      if (ctx.owned.length > 1) return null;
      const t = minimizeOf(ctx);
      if (!t) return needMinimize(ctx);
      // The walkthrough reopens paused, and saving shows only at its last step.
      return ctx.stepIndex < t.steps.length - 1 ? 'First, press Play to reach the end.' : null;
    },
    target: () => DOCK,
  },
];

export const MINIMIZE_LESSON: Lesson & { id: 'minimize' } = {
  id: 'minimize',
  noun: 'lesson',
  title: 'Minimize a DFA',
  summary: 'Merge states no word tells apart',
  minutes: 1,
  start: CONTAINS_01_DFA,
  editable: false,
  autoPlay: false,
  parts: [
    {
      title: 'Minimize a DFA',
      goal: {
        text: 'Make this DFA as small as possible',
        examples: [
          { word: '0011', accepted: true },
          { word: '100', accepted: false },
        ],
        automaton: CONTAINS_01_DFA,
        description:
          'A DFA for the words that contain 01, with four states, each named by the NFA states it holds; the last two accept.',
        after: {
          automaton: MINIMIZED,
          description:
            'The smallest DFA for the same words: three states, the last two merged into one.',
        },
      },
      steps: STEPS,
    },
  ],
  closing:
    'States that no word can tell apart are one state, so the smallest DFA has none to spare.',
};
