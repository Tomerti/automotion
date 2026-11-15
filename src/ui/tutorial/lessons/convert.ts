import type { Automaton } from '../../../core/model';
import type { SubsetTrace } from '../../../core/trace';
import { ownsTrace } from '../engine';
import type { Lesson, StepSpec, TutorialContext } from '../engine';

/** NFA for the words that contain 01: the lesson opens on it, and the minimize lesson's DFA is checked against its subset construction. */
export const CONTAINS_01: Automaton = {
  id: 'convert-lesson',
  name: 'Contains 01',
  kind: 'NFA',
  alphabet: ['0', '1'],
  states: [
    { id: 'q_0', label: 'q_0', x: 120, y: 200 },
    { id: 'q_1', label: 'q_1', x: 232, y: 200 },
    { id: 'q_2', label: 'q_2', x: 344, y: 200 },
  ],
  starts: ['q_0'],
  accepting: ['q_2'],
  transitions: [
    { id: 'q_0->q_0', from: 'q_0', to: 'q_0', symbols: ['0', '1'], loopAngle: -Math.PI / 2 },
    { id: 'q_0->q_1', from: 'q_0', to: 'q_1', symbols: ['0'] },
    { id: 'q_1->q_2', from: 'q_1', to: 'q_2', symbols: ['1'] },
    { id: 'q_2->q_2', from: 'q_2', to: 'q_2', symbols: ['0', '1'], loopAngle: -Math.PI / 2 },
  ],
};

/** The open trace is a subset walkthrough of an automaton the lesson owns. */
function subsetOf(ctx: TutorialContext): SubsetTrace | null {
  const t = ctx.trace;
  return t?.kind === 'subset' && ownsTrace(ctx) ? t : null;
}

const needConvert = (ctx: TutorialContext): string | null =>
  subsetOf(ctx) ? null : 'First, press Convert to DFA again.';

/** Where the open walkthrough first shows the DFA state labelled `label`, if one is open. */
function stateAt(ctx: TutorialContext, label: string): number | null {
  const t = subsetOf(ctx);
  const id = t?.result.states.find((s) => s.label === label)?.id;
  if (!t || id === undefined) return null;
  const at = t.steps.findIndex((s) => s.revealedStates.includes(id));
  return at >= 0 ? at : null;
}

const PAIR = '{q_0,q_1}';
const ACCEPTING_PAIR = '{q_0,q_2}';

/** The open walkthrough has shown the state labelled `label`. */
const shown = (label: string) => (ctx: TutorialContext) => {
  const at = stateAt(ctx, label);
  return at !== null && ctx.stepIndex >= at;
};

const atEnd = (ctx: TutorialContext): boolean => {
  const t = subsetOf(ctx);
  return t !== null && ctx.stepIndex === t.steps.length - 1;
};

const STEPS: StepSpec[] = [
  {
    id: 'convert/idea',
    idea: true,
    instruction: () =>
      'A DFA can’t guess. So each DFA state stands for a set of NFA states: every state the NFA could be in at that point.',
  },
  {
    id: 'convert/open',
    instruction: () => 'Press Convert to DFA at the top.',
    // Playback pauses as «{q_0,q_1}» appears; the walkthrough may be opened during the idea step.
    pauseAt: (ctx) => stateAt(ctx, PAIR),
    latch: shown(PAIR),
    target: () => 'button[aria-label="Convert to DFA"]',
  },
  {
    id: 'convert/pair',
    instruction: () => 'Press Play.',
    explain: (l) =>
      `After a \`0\` the NFA could be in ${l.q0} or ${l.q1}, so the DFA gets the state «${PAIR}».`,
    pauseAt: (ctx) => stateAt(ctx, ACCEPTING_PAIR),
    latch: shown(ACCEPTING_PAIR),
    first: needConvert,
  },
  {
    id: 'convert/accepting',
    instruction: () => 'Press Play to finish.',
    explain: () => `«${ACCEPTING_PAIR}» holds «q_2», which accepts, so this DFA state accepts too.`,
    latch: atEnd,
    first: needConvert,
  },
  {
    id: 'convert/save',
    instruction: () => 'Press Save as new automaton to keep the DFA.',
    explain: () => 'Every set the NFA can reach is now a state: four in all.',
    latch: (ctx) => ctx.owned.length > 1,
    first: (ctx) => {
      if (ctx.owned.length > 1) return null;
      const t = subsetOf(ctx);
      if (!t) return needConvert(ctx);
      // Saving shows only at the last step; a reopened walkthrough plays there by itself.
      return ctx.stepIndex < t.steps.length - 1 ? 'First, press Play to reach the end.' : null;
    },
    target: () => '[data-testid="save-trace-result"]',
  },
];

export const CONVERT_LESSON: Lesson & { id: 'convert' } = {
  id: 'convert',
  noun: 'lesson',
  title: 'Convert NFA → DFA',
  summary: 'The subset construction',
  minutes: 1,
  start: CONTAINS_01,
  editable: false,
  parts: [
    {
      title: 'Convert an NFA',
      goal: { text: 'Turn this NFA into a DFA', examples: [] },
      steps: STEPS,
    },
  ],
  closing: 'Each DFA state is a set of NFA states you could be in, so the DFA never has to guess.',
};
