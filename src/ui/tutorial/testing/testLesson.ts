import { fixture } from '../../../core/testing/fixtures';
import { ownsTrace } from '../engine';
import type { Lesson } from '../engine';

/** "Contains 01" as an NFA: what the test lesson opens on. */
export const CONTAINS_01 = fixture({
  kind: 'NFA',
  alphabet: '01',
  states: ['q0', 'q1', 'q2'],
  start: 'q0',
  accepting: ['q2'],
  edges: [
    ['q0', '0,1', 'q0'],
    ['q0', '0', 'q1'],
    ['q1', '1', 'q2'],
    ['q2', '0,1', 'q2'],
  ],
  name: 'Contains 01',
});

/**
 * A lesson for the engine's tests only (not in `LESSONS`): one part on a read-only copy of
 * `CONTAINS_01`, with a latch, an action and a latch on a saved DFA.
 */
export const TEST_LESSON: Lesson = {
  id: 'test',
  noun: 'lesson',
  title: 'Test lesson',
  summary: 'For the tests',
  minutes: 1,
  start: CONTAINS_01,
  editable: false,
  parts: [
    {
      title: 'Convert it',
      goal: {
        text: 'Turn it into a DFA',
        examples: [],
        automaton: CONTAINS_01,
        description: 'The goal: the NFA for the words that contain 01.',
      },
      steps: [
        {
          id: 'test/open',
          instruction: () => 'Press Convert to DFA.',
          latch: (ctx) => ctx.trace?.kind === 'subset' && ownsTrace(ctx),
        },
        {
          id: 'test/share',
          instruction: () => 'Press Share link.',
          action: ['share-link'],
        },
        {
          id: 'test/save',
          instruction: () => 'Convert it again and save the DFA.',
          latch: (ctx) => ctx.owned.length > 1,
        },
      ],
    },
  ],
  closing: 'You converted it.',
};

/**
 * A lesson whose second step pauses an owned conversion at its step 2 and latches there, so the
 * step that pauses is gone from the card by the time the player has paused.
 */
export const PAUSING_LESSON: Lesson = {
  ...TEST_LESSON,
  parts: [
    {
      ...TEST_LESSON.parts[0]!,
      steps: [
        {
          id: 'pause/open',
          instruction: () => 'Press Convert to DFA.',
          latch: (ctx) => ctx.trace?.kind === 'subset' && ownsTrace(ctx),
        },
        {
          id: 'pause/watch',
          instruction: () => 'Watch: it stops at step 3.',
          pauseAt: (ctx) => (ctx.trace?.kind === 'subset' && ownsTrace(ctx) ? 2 : null),
          latch: (ctx) => ctx.trace?.kind === 'subset' && ownsTrace(ctx) && ctx.stepIndex >= 2,
        },
        {
          id: 'pause/end',
          instruction: () => 'Press Play to finish.',
          latch: (ctx) =>
            ctx.trace?.kind === 'subset' && ctx.stepIndex === ctx.trace.steps.length - 1,
        },
      ],
    },
  ],
};

/**
 * A lesson that opens with an idea step, then a step that pauses an owned conversion at its step
 * 2 (so the pause is governed by the step after the idea), and opens runs of `01` paused.
 */
export const IDEA_LESSON: Lesson = {
  ...TEST_LESSON,
  pausedRuns: ['01'],
  parts: [
    {
      ...TEST_LESSON.parts[0]!,
      steps: [
        { id: 'idea/idea', idea: true, instruction: () => 'An idea.' },
        {
          id: 'idea/open',
          instruction: () => 'Press Convert to DFA.',
          pauseAt: (ctx) => (ctx.trace?.kind === 'subset' && ownsTrace(ctx) ? 2 : null),
          latch: (ctx) => ctx.trace?.kind === 'subset' && ownsTrace(ctx) && ctx.stepIndex >= 2,
        },
        {
          id: 'idea/end',
          instruction: () => 'Press Play to finish.',
          latch: (ctx) =>
            ctx.trace?.kind === 'subset' && ctx.stepIndex === ctx.trace.steps.length - 1,
        },
      ],
    },
  ],
};
