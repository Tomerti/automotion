import { subsetConstruction } from '../../../core/subset';
import type { Automaton } from '../../../core/model';
import type { SubsetTrace } from '../../../core/trace';
import { ownsTrace } from '../engine';
import type { Lesson, StepSpec, TutorialContext } from '../engine';

/** NFA for the words that contain 01: the lesson opens on it, and the minimize lesson's DFA comes from it. */
export const CONTAINS_01: Automaton = {
  id: 'convert-lesson',
  name: 'Contains 01',
  kind: 'NFA',
  alphabet: ['0', '1'],
  states: [
    { id: 'q_0', label: 'q_0', x: 120, y: 200 },
    { id: 'q_1', label: 'q_1', x: 300, y: 200 },
    { id: 'q_2', label: 'q_2', x: 480, y: 200 },
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

/** Where the picture of the DFA puts its states (by label): a row of three, the fourth under the last. */
export const AFTER_SPOTS: Record<string, { x: number; y: number }> = {
  '{q_0}': { x: 0, y: 0 },
  '{q_0,q_1}': { x: 140, y: 0 },
  '{q_0,q_2}': { x: 280, y: 0 },
  '{q_0,q_1,q_2}': { x: 280, y: 120 },
};

/**
 * The DFA the subset construction builds, laid out by hand so it reads at the picture's size.
 * `lessons/minimize.ts` hand-writes the same DFA (a test keeps them equal): edits change both.
 */
const CONTAINS_01_DFA: Automaton = (() => {
  const dfa = subsetConstruction(CONTAINS_01).result;
  return {
    ...dfa,
    states: dfa.states.map((s) => ({ ...s, ...AFTER_SPOTS[s.label] })),
    transitions: dfa.transitions.map((t) =>
      t.from === t.to ? { ...t, loopAngle: -Math.PI / 2 } : t,
    ),
  };
})();

const DOCK = '[data-testid="dock"]';

/** The open trace is a subset walkthrough of an automaton the lesson owns. */
function subsetOf(ctx: TutorialContext): SubsetTrace | null {
  const t = ctx.trace;
  return t?.kind === 'subset' && ownsTrace(ctx) ? t : null;
}

const needConvert = (ctx: TutorialContext): string | null =>
  subsetOf(ctx) ? null : 'First, press Convert to DFA again.';

/**
 * The walkthrough has reached the turn of the DFA state {q_0,q_1}: it has appeared (one step after
 * the first state) and the next steps expand it.
 */
function pairTurn(ctx: TutorialContext): boolean {
  const t = subsetOf(ctx);
  const turn = t?.steps.findIndex(
    (s) => s.phase === 'expand' && s.subset.includes('q_0') && s.subset.includes('q_1'),
  );
  return turn !== undefined && turn >= 0 && ctx.stepIndex >= turn;
}

const STEPS: StepSpec[] = [
  {
    id: 'convert/open',
    instruction: () => 'Press Convert to DFA at the top.',
    why: () => 'It builds a DFA that accepts exactly the same words.',
    latch: (ctx) => subsetOf(ctx) !== null,
    target: () => 'button[aria-label="Convert to DFA"]',
  },
  {
    id: 'convert/first',
    instruction: () => 'Look at the first DFA state, «{q_0}», then press [→] once.',
    why: () =>
      'A DFA can’t guess, so each of its states stands for every NFA state you could be in: here «{q_0}».',
    latch: (ctx) => {
      const t = subsetOf(ctx);
      const init = t?.steps.findIndex((s) => s.phase === 'init') ?? -1;
      return init >= 0 && ctx.stepIndex > init;
    },
    first: needConvert,
    target: () => DOCK,
  },
  {
    id: 'convert/pair',
    instruction: () => 'Keep stepping until «{q_0,q_1}» is expanded.',
    why: (l) =>
      `After a \`0\` the NFA is in ${l.q0} or has moved to ${l.q1}, so the DFA state holds both.`,
    latch: pairTurn,
    first: needConvert,
    target: () => '.av-player-explanation',
  },
  {
    id: 'convert/end',
    instruction: () => 'Press Play, or [Space], to run it to the end.',
    why: () => 'A set accepts when it holds an accepting NFA state: some guess got there.',
    latch: (ctx) => {
      const t = subsetOf(ctx);
      return t !== null && ctx.stepIndex === t.steps.length - 1;
    },
    first: needConvert,
    target: () => DOCK,
  },
  {
    id: 'convert/save',
    instruction: () => 'Press Save as new automaton to keep the DFA.',
    why: () => 'Saved, it’s an automaton of its own: you can run words on it, or minimize it next.',
    latch: (ctx) => ctx.owned.length > 1,
    first: (ctx) => (ctx.owned.length > 1 ? null : needConvert(ctx)),
    target: () => DOCK,
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
  autoPlay: false,
  parts: [
    {
      title: 'Convert an NFA',
      goal: {
        text: 'Turn this NFA into a DFA',
        examples: [
          { word: '1011', accepted: true },
          { word: '110', accepted: false },
        ],
        automaton: CONTAINS_01,
        description:
          'An NFA for the words that contain 01: «q_0» loops on 0 and 1, then 0 leads to «q_1», 1 to «q_2», which loops on 0 and 1.',
        after: {
          automaton: CONTAINS_01_DFA,
          description:
            'The DFA it becomes, with four states: each is a set of NFA states, and those holding «q_2» accept.',
        },
      },
      steps: STEPS,
    },
  ],
  closing: 'Each DFA state is a set of NFA states you could be in, so the DFA never has to guess.',
};
