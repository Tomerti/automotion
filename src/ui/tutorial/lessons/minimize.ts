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

/** Where the open walkthrough first splits a block, if one is open. */
function splitAt(ctx: TutorialContext): number | null {
  const at = minimizeOf(ctx)?.steps.findIndex((s) => s.phase === 'split') ?? -1;
  return at >= 0 ? at : null;
}

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
    instruction: () => 'Press Play: it pauses when a block splits.',
    why: () =>
      'It starts from accepting and not, and a block splits when a symbol sends its states to different blocks.',
    // Playback pauses on the split, which latches this step: the next one explains it.
    pauseAt: splitAt,
    latch: (ctx) => {
      const at = splitAt(ctx);
      return at !== null && ctx.stepIndex >= at;
    },
    first: needMinimize,
    target: () => DOCK,
  },
  {
    id: 'minimize/end',
    instruction: () => 'Press Play to finish.',
    why: () =>
      'On a `1`, «{q_0}» stays put but «{q_0,q_1}» reaches an accepting state, so they differ.',
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
