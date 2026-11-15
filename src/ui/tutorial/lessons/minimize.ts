import type { Automaton } from '../../../core/model';
import type { MinimizeTrace } from '../../../core/trace';
import { ownsTrace } from '../engine';
import type { Lesson, StepSpec, TutorialContext } from '../engine';

/** Where the DFA puts its states (by label): one flat row. */
const AFTER_SPOTS: Record<string, { x: number; y: number }> = {
  '{q_0}': { x: 120, y: 200 },
  '{q_0,q_1}': { x: 270, y: 200 },
  '{q_0,q_2}': { x: 420, y: 200 },
  '{q_0,q_1,q_2}': { x: 570, y: 200 },
};

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
    id: 'minimize/idea',
    idea: true,
    instruction: () =>
      'Two states are the same if no word can tell them apart: from both, every word is accepted or rejected alike. Minimizing merges such states.',
  },
  {
    id: 'minimize/open',
    instruction: () => 'Press Minimize at the top.',
    latch: (ctx) => minimizeOf(ctx) !== null,
    target: () => 'button[aria-label="Minimize"]',
  },
  {
    id: 'minimize/groups',
    instruction: () => 'Press Play.',
    explain: () =>
      'It starts with two groups, accepting and not: the empty word already tells those apart.',
    // Playback pauses on the split, which latches this step.
    pauseAt: splitAt,
    latch: (ctx) => {
      const at = splitAt(ctx);
      return at !== null && ctx.stepIndex >= at;
    },
    first: needMinimize,
  },
  {
    id: 'minimize/split',
    instruction: () => 'Press Play to finish.',
    explain: () => 'On `1`, «{q_0}» stays out of accepting but «{q_0,q_1}» gets in, so they split.',
    // Playback runs on to the end, but stops at the split while it is still ahead.
    pauseAt: (ctx) => {
      const at = splitAt(ctx);
      return at !== null && ctx.stepIndex < at ? at : null;
    },
    latch: (ctx) => {
      const t = minimizeOf(ctx);
      return t !== null && ctx.stepIndex === t.steps.length - 1;
    },
    first: needMinimize,
  },
  {
    id: 'minimize/save',
    instruction: () => 'Press Save as new automaton to keep the smaller DFA.',
    explain: () => 'No symbol tells «{q_0,q_2}» and «{q_0,q_1,q_2}» apart, so they merge.',
    latch: (ctx) => ctx.owned.length > 1,
    first: (ctx) => {
      if (ctx.owned.length > 1) return null;
      const t = minimizeOf(ctx);
      if (!t) return needMinimize(ctx);
      // The walkthrough reopens paused, and saving shows only at its last step.
      return ctx.stepIndex < t.steps.length - 1 ? 'First, press Play to reach the end.' : null;
    },
    target: () => '[data-testid="save-trace-result"]',
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
      goal: { text: 'Make this DFA as small as possible', examples: [] },
      steps: STEPS,
    },
  ],
  closing:
    'States that no word can tell apart are one state, so the smallest DFA has none to spare.',
};
