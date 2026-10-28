import { describe, expect, it } from 'vitest';
import { runWord } from '../../core/run';
import { fixture } from '../../core/testing/fixtures';
import type { RunStep } from '../../core/trace';
import {
  cellState,
  deadBranches,
  readHead,
  restingStates,
  stepMotion,
  verdictReason,
} from './runView';

const parity = fixture({
  kind: 'DFA',
  alphabet: 'ab',
  states: ['q_0', 'q_1'],
  start: 'q_0',
  accepting: ['q_1'],
  edges: [
    ['q_0', 'a', 'q_1'],
    ['q_1', 'a', 'q_0'],
    ['q_0', 'b', 'q_0'],
  ],
});

/** NFA guessing the last symbol is 'a': q0 loops, q0 -a-> q1 (accepting), q1 has no moves. */
const endsInA = fixture({
  kind: 'NFA',
  alphabet: 'ab',
  states: ['q0', 'q1'],
  start: 'q0',
  accepting: ['q1'],
  edges: [
    ['q0', 'a,b', 'q0'],
    ['q0', 'a', 'q1'],
  ],
});

/** ε-chain q0 → q1 → q2, plus a shortcut q0 → q2. */
const chain = fixture({
  kind: 'NFA',
  alphabet: 'a',
  states: ['q0', 'q1', 'q2'],
  start: 'q0',
  accepting: [],
  edges: [
    ['q0', 'ε', 'q1'],
    ['q1', 'ε', 'q2'],
    ['q2', 'a', 'q2'],
  ],
});

const stepOf = (steps: RunStep[], i: number): RunStep => steps[i] as RunStep;

describe('tape', () => {
  it('marks consumed, current and pending cells and places the read head', () => {
    const { steps } = runWord(parity, 'ba');
    // start: nothing read yet, the head waits under the first cell
    expect([0, 1].map((i) => cellState(stepOf(steps, 0), i))).toEqual(['pending', 'pending']);
    expect(readHead(stepOf(steps, 0), 2)).toEqual({ cell: 0, waiting: true });
    // read 'b'
    expect([0, 1].map((i) => cellState(stepOf(steps, 1), i))).toEqual(['current', 'pending']);
    expect(readHead(stepOf(steps, 1), 2)).toEqual({ cell: 0, waiting: false });
    // read 'a'
    expect([0, 1].map((i) => cellState(stepOf(steps, 2), i))).toEqual(['consumed', 'current']);
    // verdict: all consumed, no head
    expect([0, 1].map((i) => cellState(stepOf(steps, 3), i))).toEqual(['consumed', 'consumed']);
    expect(readHead(stepOf(steps, 3), 2)).toBeNull();
  });

  it('a stuck step points the head at the symbol it cannot read', () => {
    const { steps } = runWord(parity, 'abb');
    const stuck = stepOf(steps, steps.length - 1);
    expect(stuck.phase).toBe('stuck');
    expect(readHead(stuck, 3)).toEqual({ cell: 1, waiting: false });
    expect([0, 1, 2].map((i) => cellState(stuck, i))).toEqual(['consumed', 'current', 'pending']);
  });
});

describe('stepMotion', () => {
  it('a DFA read moves one token along the taken edge', () => {
    const { steps } = runWord(parity, 'a');
    expect(stepMotion(parity, stepOf(steps, 1))).toEqual({
      moves: [{ transitionId: 'q_0->q_1', from: 'q_0', to: 'q_1', wave: 0 }],
      waves: 1,
      dead: [],
      litBefore: [[]],
    });
  });

  it('an NFA read moves one token per taken edge and reports dead branches', () => {
    const { steps } = runWord(endsInA, 'ab');
    // read 'a' from {q0}: q0 → q0 and q0 → q1
    const first = stepMotion(endsInA, stepOf(steps, 1));
    expect(first?.moves.map((m) => m.transitionId).sort()).toEqual(['q0->q0', 'q0->q1']);
    expect(first?.dead).toEqual([]);
    // read 'b' from {q0, q1}: q1 has no 'b' move, so that branch dies
    const second = stepOf(steps, 2);
    expect(stepMotion(endsInA, second)?.moves.map((m) => m.transitionId)).toEqual(['q0->q0']);
    expect(deadBranches(endsInA, second)).toEqual(['q1']);
  });

  it('an ε-closure moves tokens in waves of depth; the starting states stay lit', () => {
    const { steps } = runWord(chain, '');
    const closure = stepOf(steps, 1);
    expect(closure.phase).toBe('closure');
    expect(stepMotion(chain, closure)).toEqual({
      moves: [
        { transitionId: 'q0->q1', from: 'q0', to: 'q1', wave: 0 },
        { transitionId: 'q1->q2', from: 'q1', to: 'q2', wave: 1 },
      ],
      waves: 2,
      dead: [],
      litBefore: [['q0'], ['q0', 'q1']],
    });
  });

  it('start and verdict steps do not move', () => {
    const { steps } = runWord(parity, 'a');
    expect(stepMotion(parity, stepOf(steps, 0))).toBeNull();
    expect(stepMotion(parity, stepOf(steps, 2))).toBeNull();
  });

  it('a stuck step kills every branch and rests on the states it was in', () => {
    const { steps } = runWord(parity, 'ab');
    const stuck = stepOf(steps, steps.length - 1);
    expect(stuck.phase).toBe('stuck');
    expect(stepMotion(parity, stuck)).toBeNull();
    expect(deadBranches(parity, stuck)).toEqual(['q_1']);
    expect(restingStates(stuck)).toEqual(['q_1']);
    expect(restingStates(stepOf(steps, 1))).toEqual(['q_1']);
  });
});

describe('verdictReason', () => {
  it('DFA accept and reject name the final state', () => {
    expect(verdictReason(runWord(parity, 'a'))).toBe('Ended in accepting state q_1');
    expect(verdictReason(runWord(parity, 'aa'))).toBe('Ended in q_0, which is not accepting');
    expect(verdictReason(runWord(parity, ''))).toBe('Ended in q_0, which is not accepting');
  });

  it('a stuck run names the symbol and the state', () => {
    expect(verdictReason(runWord(parity, 'ab'))).toBe("Stuck: no 'b' transition from q_1");
  });

  it('NFA verdicts talk about the set of active states', () => {
    expect(verdictReason(runWord(chain, ''))).toBe(
      'None of the active states {q0, q1, q2} is accepting',
    );
    expect(verdictReason(runWord(endsInA, 'ba'))).toBe('Ended in {q0, q1}; q1 is accepting');
    expect(verdictReason(runWord(endsInA, 'ab'))).toBe('Ended in q0, which is not accepting');
    const fanOut = fixture({
      kind: 'NFA',
      alphabet: 'a',
      states: ['p', 'q', 'r'],
      start: 'p',
      accepting: ['q', 'r'],
      edges: [
        ['p', 'a', 'p'],
        ['p', 'a', 'q'],
        ['p', 'a', 'r'],
      ],
    });
    expect(verdictReason(runWord(fanOut, 'a'))).toBe('Ended in {p, q, r}; q and r are accepting');
  });

  it('a stuck NFA run lists the states it was stuck in', () => {
    const nfa = fixture({
      kind: 'NFA',
      alphabet: 'ab',
      states: ['q0', 'q1'],
      start: 'q0',
      accepting: ['q1'],
      edges: [
        ['q0', 'ε', 'q1'],
        ['q0', 'a', 'q0'],
      ],
    });
    expect(verdictReason(runWord(nfa, 'b'))).toBe("Stuck: no 'b' transition from any of {q0, q1}");
  });
});
