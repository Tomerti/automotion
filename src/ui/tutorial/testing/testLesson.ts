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
 * `CONTAINS_01` whose walkthroughs open paused, with a latch, an action and a latch on a saved DFA.
 */
export const TEST_LESSON: Lesson = {
  id: 'nfa',
  noun: 'lesson',
  title: 'Test lesson',
  summary: 'For the tests',
  minutes: 1,
  start: CONTAINS_01,
  editable: false,
  autoPlay: false,
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
