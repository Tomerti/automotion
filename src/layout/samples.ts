import type { Automaton } from '../core/model';
import { minimize } from '../core/minimize';
import { subsetConstruction } from '../core/subset';
import { fixture, nthFromEnd } from '../core/testing/fixtures';

/**
 * Typical course automata, for the layout's tests: what Tidy is most often asked to lay out.
 * Each starts on a single row (the fixture's placement), so the layout has to find its shape.
 */
export function layoutSamples(): Automaton[] {
  const endsInAb = fixture({
    name: 'Ends in ab (NFA)',
    kind: 'NFA',
    alphabet: 'ab',
    states: ['q0', 'q1', 'q2'],
    start: 'q0',
    accepting: ['q2'],
    edges: [
      ['q0', 'a,b', 'q0'],
      ['q0', 'a', 'q1'],
      ['q1', 'b', 'q2'],
    ],
  });
  const samples: Automaton[] = [
    fixture({
      name: 'Even number of 0s',
      kind: 'DFA',
      alphabet: '01',
      states: ['even', 'odd'],
      start: 'even',
      accepting: ['even'],
      edges: [
        ['even', '1', 'even'],
        ['even', '0', 'odd'],
        ['odd', '1', 'odd'],
        ['odd', '0', 'even'],
      ],
    }),
    fixture({
      name: 'Contains 101',
      kind: 'DFA',
      alphabet: '01',
      states: ['q0', 'q1', 'q2', 'q3'],
      start: 'q0',
      accepting: ['q3'],
      edges: [
        ['q0', '0', 'q0'],
        ['q0', '1', 'q1'],
        ['q1', '1', 'q1'],
        ['q1', '0', 'q2'],
        ['q2', '0', 'q0'],
        ['q2', '1', 'q3'],
        ['q3', '0,1', 'q3'],
      ],
    }),
    fixture({
      name: 'Divisible by 3',
      kind: 'DFA',
      alphabet: '01',
      states: ['r0', 'r1', 'r2'],
      start: 'r0',
      accepting: ['r0'],
      edges: [
        ['r0', '0', 'r0'],
        ['r0', '1', 'r1'],
        ['r1', '0', 'r2'],
        ['r1', '1', 'r0'],
        ['r2', '0', 'r1'],
        ['r2', '1', 'r2'],
      ],
    }),
    fixture({
      name: 'Exactly two a',
      kind: 'DFA',
      alphabet: 'ab',
      states: ['q0', 'q1', 'q2', 'dead'],
      start: 'q0',
      accepting: ['q2'],
      edges: [
        ['q0', 'b', 'q0'],
        ['q0', 'a', 'q1'],
        ['q1', 'b', 'q1'],
        ['q1', 'a', 'q2'],
        ['q2', 'b', 'q2'],
        ['q2', 'a', 'dead'],
        ['dead', 'a,b', 'dead'],
      ],
    }),
    fixture({
      name: 'Length mod 5',
      kind: 'DFA',
      alphabet: 'a',
      states: ['q0', 'q1', 'q2', 'q3', 'q4'],
      start: 'q0',
      accepting: ['q0'],
      edges: [
        ['q0', 'a', 'q1'],
        ['q1', 'a', 'q2'],
        ['q2', 'a', 'q3'],
        ['q3', 'a', 'q4'],
        ['q4', 'a', 'q0'],
      ],
    }),
    fixture({
      name: 'Divisible by 5',
      kind: 'DFA',
      alphabet: '01',
      states: ['r0', 'r1', 'r2', 'r3', 'r4'],
      start: 'r0',
      accepting: ['r0'],
      edges: [0, 1, 2, 3, 4].flatMap((r) =>
        [0, 1].map((b): [string, string, string] => [`r${r}`, String(b), `r${(2 * r + b) % 5}`]),
      ),
    }),
    fixture({
      name: 'Starts with ab',
      kind: 'DFA',
      alphabet: 'ab',
      states: ['q0', 'q1', 'q2', 'dead'],
      start: 'q0',
      accepting: ['q2'],
      edges: [
        ['q0', 'a', 'q1'],
        ['q0', 'b', 'dead'],
        ['q1', 'b', 'q2'],
        ['q1', 'a', 'dead'],
        ['q2', 'a,b', 'q2'],
        ['dead', 'a,b', 'dead'],
      ],
    }),
    fixture({
      name: '(a|b)*abb with ε',
      kind: 'NFA',
      alphabet: 'ab',
      states: ['q0', 'q1', 'q2', 'q3', 'q4', 'q5'],
      start: 'q0',
      accepting: ['q5'],
      edges: [
        ['q0', 'ε', 'q1'],
        ['q1', 'a,b', 'q1'],
        ['q1', 'ε', 'q2'],
        ['q2', 'a', 'q3'],
        ['q3', 'b', 'q4'],
        ['q4', 'b', 'q5'],
      ],
    }),
    fixture({
      name: 'a* or b* (two starts)',
      kind: 'NFA',
      alphabet: 'ab',
      states: ['p', 'r'],
      starts: ['p', 'r'],
      accepting: ['p', 'r'],
      edges: [
        ['p', 'a', 'p'],
        ['r', 'b', 'r'],
      ],
    }),
    fixture({
      name: 'Union NFA',
      kind: 'NFA',
      alphabet: 'ab',
      states: ['s', 'a0', 'a1', 'b0', 'b1'],
      start: 's',
      accepting: ['a1', 'b1'],
      edges: [
        ['s', 'ε', 'a0'],
        ['s', 'ε', 'b0'],
        ['a0', 'a', 'a1'],
        ['a1', 'a', 'a0'],
        ['b0', 'b', 'b1'],
        ['b1', 'b', 'b0'],
      ],
    }),
  ];
  const minInput = fixture({
    name: 'To minimize',
    kind: 'DFA',
    alphabet: '01',
    states: ['A', 'B', 'C', 'D', 'E', 'F'],
    start: 'A',
    accepting: ['C', 'D', 'E'],
    edges: [
      ['A', '0', 'B'],
      ['A', '1', 'C'],
      ['B', '0', 'A'],
      ['B', '1', 'D'],
      ['C', '0', 'E'],
      ['C', '1', 'F'],
      ['D', '0', 'E'],
      ['D', '1', 'F'],
      ['E', '0', 'E'],
      ['E', '1', 'F'],
      ['F', '0,1', 'F'],
    ],
  });
  samples.push(minInput);
  const minimized = minimize(minInput).result;
  if (minimized) samples.push({ ...minimized, name: 'Minimized' });
  samples.push({ ...subsetConstruction(endsInAb).result, name: 'Ends in ab → DFA' });
  samples.push({ ...subsetConstruction(nthFromEnd(2)).result, name: '2nd from end → DFA' });
  samples.push({ ...subsetConstruction(nthFromEnd(3)).result, name: '3rd from end → DFA' });
  return samples;
}
