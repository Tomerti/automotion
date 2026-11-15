import type { Automaton } from '../../../core/model';
import type { RunTrace } from '../../../core/trace';
import { ownsTrace } from '../engine';
import type { Lesson, StepSpec, TutorialContext } from '../engine';

/** The lesson opens on this NFA for words ending in `01`: `q_0` guesses where the `01` starts. */
const ENDS_01: Automaton = {
  id: 'nfa-lesson',
  name: 'Ends in 01',
  kind: 'NFA',
  alphabet: ['0', '1'],
  states: [
    { id: 'q_0', label: 'q_0', x: 120, y: 200 },
    { id: 'q_1', label: 'q_1', x: 240, y: 200 },
    { id: 'q_2', label: 'q_2', x: 360, y: 200 },
  ],
  starts: ['q_0'],
  accepting: ['q_2'],
  transitions: [
    { id: 't0', from: 'q_0', to: 'q_0', symbols: ['0', '1'], loopAngle: -Math.PI / 2 },
    { id: 't1', from: 'q_0', to: 'q_1', symbols: ['0'] },
    { id: 't2', from: 'q_1', to: 'q_2', symbols: ['1'] },
  ],
};

/** The open run is an owned run of `word`. */
function runOf(ctx: TutorialContext, word: string): RunTrace | null {
  const t = ctx.trace;
  return t?.kind === 'run' && t.word === word && ownsTrace(ctx) ? t : null;
}

/** Where playback pauses next: the card explains the moment one index on. */
const pauseAfter =
  (next: number) =>
  (ctx: TutorialContext): number | null =>
    runOf(ctx, '001') ? next : null;

/**
 * Before a paused step: run `001` again if it isn't open, or step back to the moment the card
 * explains (index `moment`) if the run is before it.
 */
const getBack =
  (moment: number) =>
  (ctx: TutorialContext): string | null => {
    if (!runOf(ctx, '001')) return 'First, run `001` again.';
    return ctx.stepIndex < moment ? 'First, press [→] to get back to this point.' : null;
  };

const reached = (index: number) => (ctx: TutorialContext) =>
  runOf(ctx, '001') !== null && ctx.stepIndex >= index;

const STEPS: StepSpec[] = [
  {
    id: 'nfa/idea',
    idea: true,
    instruction: () =>
      'An NFA can have several arrows on one letter, or none. Think of it as guessing: it follows every guess at once, and accepts if any guess ends in an accepting state.',
  },
  {
    id: 'nfa/run',
    instruction: () => 'Run `001`.',
    latch: (ctx) => runOf(ctx, '001') !== null,
    // A latch step, so the engine's wrong-word hint doesn't apply: same wording here.
    hint: (ctx) => {
      const t = ctx.trace;
      if (t?.kind !== 'run' || t.word === '001' || !ownsTrace(ctx)) return null;
      return `That was \`${t.word === '' ? 'ε' : t.word}\`. Press [Esc] and run \`001\`.`;
    },
  },
  {
    id: 'nfa/read-0',
    instruction: () => 'Press [→] to read the first `0`.',
    explain: (l) => `It starts in ${l.q0}, with nothing guessed yet.`,
    pauseAt: pauseAfter(1),
    latch: reached(1),
    first: getBack(0),
  },
  {
    id: 'nfa/guess',
    instruction: () => 'Press [→] to read the second `0`.',
    explain: (l) =>
      `It guessed this \`0\` starts the final \`01\`, so it follows both ${l.q0} and ${l.q1}.`,
    pauseAt: pauseAfter(2),
    latch: reached(2),
    first: getBack(1),
  },
  {
    id: 'nfa/dies',
    instruction: () => 'Press [→] to read the `1`.',
    explain: (l) =>
      `${l.q1} had no arrow on \`0\`, so that guess died; ${l.q0} made the same guess again.`,
    pauseAt: pauseAfter(3),
    latch: reached(3),
    first: getBack(2),
  },
  {
    id: 'nfa/reach',
    instruction: () => 'Press [→] for the verdict.',
    explain: () => 'The guess in «q_1» read `1` and reached «q_2».',
    latch: reached(4),
    first: getBack(3),
  },
];

export const NFA_LESSON: Lesson & { id: 'nfa' } = {
  id: 'nfa',
  noun: 'lesson',
  title: 'NFAs',
  summary: 'Guesses, and branches that die',
  minutes: 1,
  start: ENDS_01,
  editable: false,
  pausedRuns: ['001'],
  parts: [
    {
      title: 'Follow an NFA',
      goal: {
        text: 'Follow an NFA for words ending in `01`',
        examples: [
          { word: '001', accepted: true },
          { word: '010', accepted: false },
        ],
      },
      steps: STEPS,
    },
  ],
  closing:
    'One guess reached an accepting state, and one is enough: an NFA accepts if any guess does.',
};
