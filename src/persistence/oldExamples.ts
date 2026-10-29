import { EPSILON } from '../core/model';
import type { Automaton, AutomatonKind } from '../core/model';

interface OldExample {
  id: string;
  name: string;
  kind: AutomatonKind;
  states: [id: string, x: number, y: number][];
  starts: string[];
  accepting: string[];
  transitions: [from: string, to: string, symbols: string[]][];
}

/**
 * The three examples the first release seeded on first launch (removed in 7bcab68), as they were
 * stored. Kept only so `isUntouchedOldExample` can recognize copies nobody has changed.
 */
const OLD_EXAMPLES: OldExample[] = [
  {
    id: 'example-ends-in-ab',
    name: 'Ends in ab (NFA)',
    kind: 'NFA',
    states: [
      ['q0', 100, 150],
      ['q1', 250, 150],
      ['q2', 400, 150],
      ['q3', 550, 150],
    ],
    starts: ['q0'],
    accepting: ['q3'],
    transitions: [
      ['q0', 'q0', ['a', 'b']],
      ['q0', 'q1', [EPSILON]],
      ['q1', 'q2', ['a']],
      ['q2', 'q3', ['b']],
    ],
  },
  {
    id: 'example-even-zeros',
    name: 'Even number of 0s (DFA)',
    kind: 'DFA',
    states: [
      ['even', 150, 150],
      ['odd', 300, 150],
    ],
    starts: ['even'],
    accepting: ['even'],
    transitions: [
      ['even', 'odd', ['0']],
      ['odd', 'even', ['0']],
      ['even', 'even', ['1']],
      ['odd', 'odd', ['1']],
    ],
  },
  {
    id: 'example-redundant',
    name: 'Redundant states (DFA)',
    kind: 'DFA',
    states: [
      ['q0', 100, 100],
      ['q1', 250, 100],
      ['q2', 100, 250],
      ['q3', 250, 250],
    ],
    starts: ['q0'],
    accepting: ['q0', 'q2'],
    transitions: [
      ['q0', 'q1', ['a']],
      ['q0', 'q2', ['b']],
      ['q1', 'q0', ['a']],
      ['q1', 'q3', ['b']],
      ['q2', 'q3', ['a']],
      ['q2', 'q0', ['b']],
      ['q3', 'q2', ['a']],
      ['q3', 'q1', ['b']],
    ],
  },
];

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x) => b.includes(x));

/**
 * Whether `a` is one of the old seeded examples exactly as seeded: same id, name, kind, states
 * (in place), start, accepting states and transitions (unbent). Labels may be `q0` or `q_0`.
 * The alphabet is ignored, since it follows the transitions.
 */
export function isUntouchedOldExample(a: Automaton): boolean {
  const ex = OLD_EXAMPLES.find((e) => e.id === a.id);
  if (!ex || a.name !== ex.name || a.kind !== ex.kind) return false;
  if (!sameSet(a.starts, ex.starts) || !sameSet(a.accepting, ex.accepting)) return false;
  const statesMatch =
    a.states.length === ex.states.length &&
    ex.states.every(([id, x, y]) =>
      a.states.some(
        (s) =>
          s.id === id &&
          s.x === x &&
          s.y === y &&
          s.startAngle === undefined &&
          (s.label === id || s.label === id.replace(/^q(\d+)$/, 'q_$1')),
      ),
    );
  const transitionsMatch =
    a.transitions.length === ex.transitions.length &&
    ex.transitions.every(([from, to, symbols]) =>
      a.transitions.some(
        (t) =>
          t.from === from &&
          t.to === to &&
          sameSet(t.symbols, symbols) &&
          t.bend === undefined &&
          t.loopAngle === undefined,
      ),
    );
  return statesMatch && transitionsMatch;
}
