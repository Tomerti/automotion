import { EPSILON } from '../../../core/model';
import type { Automaton } from '../../../core/model';
import type { RunTrace } from '../../../core/trace';
import { ownsTrace } from '../engine';
import type { Lesson, StepSpec, TutorialContext } from '../engine';

/** The lesson opens on this NFA for a*b*: `q_0 –ε→ q_1` makes the second state start with the first. */
const A_STAR_B_STAR: Automaton = {
  id: 'nfa-lesson',
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

/** The whole run pill, so the frame takes in the Run button too. */
const RUN_PILL = 'form:has(input[aria-label="Word"])';
const DOCK = '[data-testid="dock"]';

/** The open run is an owned run of `word`. */
function runOf(ctx: TutorialContext, word: string): RunTrace | null {
  const t = ctx.trace;
  return t?.kind === 'run' && t.word === word && ownsTrace(ctx) ? t : null;
}

/** The first read step where some state in `before` has no move on the symbol: a branch dies. */
function firstDeath(t: RunTrace): number {
  const a = t.source;
  return t.steps.findIndex(
    (s) =>
      s.phase === 'read' &&
      s.symbol !== undefined &&
      s.before.some(
        (id) => !a.transitions.some((tr) => tr.from === id && tr.symbols.includes(s.symbol!)),
      ),
  );
}

/** Where the open `aab` run first loses a branch, if one is open. */
function deathOf(ctx: TutorialContext): number | null {
  const t = runOf(ctx, 'aab');
  const at = t ? firstDeath(t) : -1;
  return at >= 0 ? at : null;
}

const needRun = (ctx: TutorialContext): string | null =>
  runOf(ctx, 'aab') ? null : 'First, run `aab` again.';

const STEPS: StepSpec[] = [
  {
    id: 'nfa/run',
    instruction: () => 'Type `aab` in the word box and press Run.',
    why: (l) =>
      `The run starts in ${l.q0} and ${l.q1} at once, since the ε-arrow moves without reading.`,
    latch: (ctx) => runOf(ctx, 'aab') !== null,
    // A latch step, so the engine's wrong-word hint doesn't apply: same wording here.
    hint: (ctx) => {
      const t = ctx.trace;
      if (t?.kind !== 'run' || t.word === 'aab' || !ownsTrace(ctx)) return null;
      return `That was \`${t.word === '' ? 'ε' : t.word}\`. Press [Esc] and run \`aab\`.`;
    },
    target: () => RUN_PILL,
  },
  {
    id: 'nfa/branch',
    instruction: () => 'Watch: the run pauses where a branch dies.',
    why: () => 'An NFA follows every guess at once, and a guess dies when it has no arrow to take.',
    // Playback pauses on the death, which latches this step: the next one explains it.
    pauseAt: deathOf,
    latch: (ctx) => {
      const at = deathOf(ctx);
      return at !== null && ctx.stepIndex >= at;
    },
    first: needRun,
    target: () => DOCK,
  },
  {
    id: 'nfa/verdict',
    instruction: () => 'Press Play to see the verdict.',
    why: (l) => `${l.q1} has no arrow on \`a\`, so that guess dies while ${l.q0} carries on.`,
    run: { word: 'aab', accepted: true },
    first: needRun,
    target: () => DOCK,
  },
  {
    id: 'nfa/aba',
    instruction: () => 'Press [Esc], then run `aba`.',
    why: () =>
      'By the last `a` every branch has died, so none is left to accept and it’s rejected.',
    run: { word: 'aba', accepted: false },
    target: () => RUN_PILL,
  },
];

export const NFA_LESSON: Lesson & { id: 'nfa' } = {
  id: 'nfa',
  noun: 'lesson',
  title: 'NFAs',
  summary: 'ε and branches that die',
  minutes: 1,
  start: A_STAR_B_STAR,
  editable: false,
  parts: [
    {
      title: 'Run an NFA',
      goal: {
        text: 'Run an NFA',
        examples: [
          { word: 'aab', accepted: true },
          { word: 'aba', accepted: false },
        ],
        automaton: A_STAR_B_STAR,
        description:
          'An NFA for a*b*: «q_0» loops on a, an ε-arrow leads to «q_1», which loops on b.',
      },
      steps: STEPS,
    },
  ],
  closing:
    'ε costs nothing, and a word is accepted if any one branch survives to an accepting state.',
};
