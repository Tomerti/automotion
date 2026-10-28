import type { Automaton } from '../../core/model';

/** NFA over {a,b} accepting words that end in "ab". */
export const endsAb: Automaton = {
  id: 'n1',
  name: 'ends ab',
  kind: 'NFA',
  alphabet: ['a', 'b'],
  states: [
    { id: 'q0', label: 'q0', x: 0, y: 0 },
    { id: 'q1', label: 'q1', x: 0, y: 0 },
    { id: 'q2', label: 'q2', x: 0, y: 0 },
  ],
  starts: ['q0'],
  accepting: ['q2'],
  transitions: [
    { id: 't1', from: 'q0', to: 'q0', symbols: ['a', 'b'] },
    { id: 't2', from: 'q0', to: 'q1', symbols: ['a'] },
    { id: 't3', from: 'q1', to: 'q2', symbols: ['b'] },
  ],
};
