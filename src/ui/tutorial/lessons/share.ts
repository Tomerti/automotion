import type { Automaton } from '../../../core/model';
import type { Lesson, StepSpec } from '../engine';
import { NAMES } from './basics';

/** Basics' finished part 1: an even number of zeros, its states named as that part asks. */
const EVEN_ZEROS: Automaton = {
  id: 'share-lesson',
  name: 'Even zeros',
  kind: 'DFA',
  alphabet: ['0', '1'],
  states: [
    { id: NAMES.even, label: NAMES.even, x: 160, y: 200 },
    { id: NAMES.odd, label: NAMES.odd, x: 400, y: 200 },
  ],
  starts: [NAMES.even],
  accepting: [NAMES.even],
  transitions: [
    { id: 't0', from: NAMES.even, to: NAMES.odd, symbols: ['0'] },
    { id: 't1', from: NAMES.odd, to: NAMES.even, symbols: ['0'] },
    { id: 't2', from: NAMES.even, to: NAMES.even, symbols: ['1'], loopAngle: -Math.PI / 2 },
    { id: 't3', from: NAMES.odd, to: NAMES.odd, symbols: ['1'], loopAngle: -Math.PI / 2 },
  ],
};

const MENU = 'button[aria-label="Share, copy or export"]';

const STEPS: StepSpec[] = [
  {
    id: 'share/link',
    instruction: () => 'Open Share, copy or export, and choose Share link.',
    why: () => 'The automaton travels inside the link: whoever opens it gets their own copy.',
    action: ['share-link'],
    target: () => MENU,
  },
  {
    id: 'share/image',
    instruction: () => 'Press [Ctrl] + [C] with nothing selected.',
    why: () => 'That copies the picture, ready to paste into notes or slides.',
    // Export PNG and SVG count too: the copy fails where the clipboard is blocked.
    action: ['copy-image', 'export-png', 'export-svg'],
    // With states selected, Ctrl+C copies the states and nothing counts.
    first: (ctx) =>
      ctx.selected.length > 0 ? 'First, click the empty canvas to clear the selection.' : null,
    target: () => MENU,
  },
  {
    id: 'share/latex',
    instruction: () => 'Choose Copy LaTeX or Export LaTeX from the same menu.',
    why: () => 'It is TikZ, laid out as on the canvas, to paste into a LaTeX document.',
    action: ['copy-latex', 'export-latex'],
    target: () => MENU,
  },
];

export const SHARE_LESSON: Lesson & { id: 'share' } = {
  id: 'share',
  noun: 'lesson',
  title: 'Share and export',
  summary: 'Links, pictures, LaTeX',
  minutes: 1,
  start: EVEN_ZEROS,
  editable: false,
  parts: [
    {
      title: 'Share and export',
      goal: {
        text: 'Share your automaton',
        examples: [],
        automaton: EVEN_ZEROS,
        description:
          'A DFA for an even number of zeros: «even» (start, accepting) and «odd», a 0 switching between them.',
      },
      steps: STEPS,
    },
  ],
  closing: 'A link, a picture and TikZ: share the automaton, or paste it into your notes.',
};
