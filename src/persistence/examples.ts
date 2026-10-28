import { EPSILON } from '../core/model';
import type { Automaton, State, Transition } from '../core/model';

/** `q0` is shown as q₀: numbered labels use the subscript syntax. */
const st = (id: string, x: number, y: number): State => ({
  id,
  label: id.replace(/^q(\d+)$/, 'q_$1'),
  x,
  y,
});
const tr = (from: string, to: string, symbols: string[]): Transition => ({
  id: `${from}->${to}`,
  from,
  to,
  symbols,
});

/** The three automata seeded on first launch. Ids are fixed so they're stable across launches. */
export function exampleAutomata(): Automaton[] {
  const endsInAb: Automaton = {
    id: 'example-ends-in-ab',
    name: 'Ends in ab (NFA)',
    kind: 'NFA',
    alphabet: ['a', 'b'],
    states: [st('q0', 100, 150), st('q1', 250, 150), st('q2', 400, 150), st('q3', 550, 150)],
    start: 'q0',
    accepting: ['q3'],
    transitions: [
      tr('q0', 'q0', ['a', 'b']),
      tr('q0', 'q1', [EPSILON]),
      tr('q1', 'q2', ['a']),
      tr('q2', 'q3', ['b']),
    ],
  };

  const evenZeros: Automaton = {
    id: 'example-even-zeros',
    name: 'Even number of 0s (DFA)',
    kind: 'DFA',
    alphabet: ['0', '1'],
    states: [st('even', 150, 150), st('odd', 300, 150)],
    start: 'even',
    accepting: ['even'],
    transitions: [
      tr('even', 'odd', ['0']),
      tr('odd', 'even', ['0']),
      tr('even', 'even', ['1']),
      tr('odd', 'odd', ['1']),
    ],
  };

  // Words over {a,b} with an even number of a's; q0/q2 and q1/q3 are pairwise equivalent.
  const redundant: Automaton = {
    id: 'example-redundant',
    name: 'Redundant states (DFA)',
    kind: 'DFA',
    alphabet: ['a', 'b'],
    states: [st('q0', 100, 100), st('q1', 250, 100), st('q2', 100, 250), st('q3', 250, 250)],
    start: 'q0',
    accepting: ['q0', 'q2'],
    transitions: [
      tr('q0', 'q1', ['a']),
      tr('q0', 'q2', ['b']),
      tr('q1', 'q0', ['a']),
      tr('q1', 'q3', ['b']),
      tr('q2', 'q3', ['a']),
      tr('q2', 'q0', ['b']),
      tr('q3', 'q2', ['a']),
      tr('q3', 'q1', ['b']),
    ],
  };

  return [endsInAb, evenZeros, redundant];
}
