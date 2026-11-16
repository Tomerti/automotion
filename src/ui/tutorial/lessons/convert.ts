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

/** The card between the stops, while the line below goes through the other sets and symbols. */
const BETWEEN =
  'Below, it follows each symbol from each set: a set it already has is reused, a new one becomes a state.';

const STEPS: StepSpec[] = [
  {
    id: 'convert/idea',
    idea: true,
    instruction: () =>
      'Every NFA has a DFA that accepts exactly the same words. A DFA can’t guess, so each of its states is a set: all the NFA states you could be in after the same input.',
  },
  {
    id: 'convert/open',
    instruction: () => 'Press Convert to DFA at the top.',
    // The walkthrough opens paused on «{q_0}» (`pausedConvert`), maybe during the idea step.
    latch: (ctx) => subsetOf(ctx) !== null,
    target: () => 'button[aria-label="Convert to DFA"]',
  },
  {
    id: 'convert/pair',
    // On «{q_0}», step by hand to the pair's moment; from there, Play.
    instruction: (_, ctx) => {
      const pair = stateAt(ctx, PAIR);
      return pair !== null && ctx.stepIndex < pair
        ? 'Press [→] to follow `0` from «{q_0}».'
        : 'Press Play.';
    },
    // What the line below the walkthrough shows: the start, the pair's moment, or the steps between.
    explain: (l, ctx) => {
      const pair = stateAt(ctx, PAIR);
      if (pair === null) return null;
      if (ctx.stepIndex < pair)
        return `The DFA starts in «{q_0}»: before reading anything, the NFA can only be in ${l.q0}.`;
      if (ctx.stepIndex === pair)
        return `Below, it follows \`0\` from «{q_0}»: ${l.q0} can stay or move to ${l.q1}, so the new DFA state is «${PAIR}».`;
      return BETWEEN;
    },
    // Before the pair's moment (opened, stepped back or reopened there): stop on it first.
    pauseAt: (ctx) => {
      const pair = stateAt(ctx, PAIR);
      return pair !== null && ctx.stepIndex < pair ? pair : stateAt(ctx, ACCEPTING_PAIR);
    },
    latch: shown(ACCEPTING_PAIR),
    steppedBack: (ctx) => subsetOf(ctx) !== null && !shown(ACCEPTING_PAIR)(ctx),
    first: needConvert,
  },
  {
    id: 'convert/accepting',
    instruction: () => 'Press Play to finish.',
    explain: (_, ctx) => {
      const at = stateAt(ctx, ACCEPTING_PAIR);
      if (at === null) return null;
      return ctx.stepIndex === at
        ? `Below, \`1\` from «${PAIR}» leads to «${ACCEPTING_PAIR}». It holds «q_2», which accepts, so this DFA state accepts too.`
        : BETWEEN;
    },
    // Playback runs on to the end, but stops at this moment while it is still ahead.
    pauseAt: (ctx) => {
      const at = stateAt(ctx, ACCEPTING_PAIR);
      return at !== null && ctx.stepIndex < at ? at : null;
    },
    latch: atEnd,
    steppedBack: (ctx) => subsetOf(ctx) !== null && !atEnd(ctx),
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
      // The walkthrough reopens paused, and saving shows only at its last step.
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
  pausedConvert: true,
  parts: [
    {
      title: 'Convert an NFA',
      goal: { text: 'Turn this NFA into a DFA', examples: [] },
      steps: STEPS,
    },
  ],
  closing: 'Each DFA state is a set of NFA states you could be in, so the DFA never has to guess.',
};
