import type { Automaton } from '../../../core/model';
import type { Lesson, StepSpec } from '../engine';
import { atMoment, otherWordHint, reached as reachedWord, runOf } from './handStep';

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

const reached = (index: number) => reachedWord('001', index);

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
    hint: otherWordHint('001'),
  },
  {
    id: 'nfa/read-0',
    instruction: () => 'Press [→] to read the first `0`.',
    explain: (l) => `It starts in ${l.q0}, with nothing guessed yet.`,
    ...atMoment('001', 0),
    latch: reached(1),
  },
  {
    id: 'nfa/guess',
    instruction: () => 'Press [→] to read the second `0`.',
    explain: (l) =>
      `From ${l.q0}, a \`0\` can stay in ${l.q0} or move to ${l.q1}. It follows both, so it’s in both at once.`,
    ...atMoment('001', 1),
    latch: reached(2),
  },
  {
    id: 'nfa/dies',
    instruction: () => 'Press [→] to read the `1`.',
    explain: (l) =>
      `${l.q1} had no arrow on \`0\`, so that guess died; from ${l.q0} it took both arrows again.`,
    ...atMoment('001', 2),
    latch: reached(3),
  },
  {
    id: 'nfa/reach',
    instruction: () => 'Press [→] for the verdict.',
    explain: () => 'The guess in «q_1» read `1` and reached «q_2».',
    ...atMoment('001', 3, true),
    latch: reached(4),
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
        text: 'This NFA accepts words ending in `01`. Watch it guess.',
        examples: [],
      },
      steps: STEPS,
    },
  ],
  closing:
    'One guess reached an accepting state, and one is enough: an NFA accepts if any guess does.',
};
