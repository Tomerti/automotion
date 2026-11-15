import { describe, expect, it } from 'vitest';
import { subsetConstruction } from '../../../core/subset';
import type { SubsetTrace } from '../../../core/trace';
import { advance, countedSteps, lessonSteps, pacingStep } from '../engine';
import type { TutorialContext } from '../engine';
import { CONTAINS_01, CONVERT_LESSON } from './convert';

const L = CONVERT_LESSON;
const steps = lessonSteps(L);
const trace = subsetConstruction(CONTAINS_01);
const revealedAt = (label: string): number => {
  const id = trace.result.states.find((s) => s.label === label)!.id;
  return trace.steps.findIndex((s) => s.revealedStates.includes(id));
};
const pairAt = revealedAt('{q_0,q_1}');
const acceptingAt = revealedAt('{q_0,q_2}');
const last = trace.steps.length - 1;

function ctx(t: SubsetTrace | null, stepIndex = 0, more: Partial<TutorialContext> = {}) {
  return {
    automaton: CONTAINS_01,
    isActive: true,
    trace: t,
    stepIndex,
    selected: [],
    owned: [CONTAINS_01.id],
    actions: new Set(),
    ...more,
  } satisfies TutorialContext;
}

const SAVED = { owned: [CONTAINS_01.id, 'saved-dfa'] };
const idea = new Set(['convert/idea']);

describe('the Convert NFA → DFA lesson', () => {
  it('opens on an NFA whose DFA has four states, with the stops at indices 1 and 4', () => {
    expect(CONTAINS_01.kind).toBe('NFA');
    expect(trace.result.states).toHaveLength(4);
    expect(pairAt).toBe(1);
    expect(acceptingAt).toBe(4);
    expect(last).toBe(9);
  });

  it('has a goal with no examples and no picture, and five counted steps', () => {
    const goal = L.parts[0]!.goal;
    expect(goal.text).toBe('Turn this NFA into a DFA');
    expect(goal.examples).toEqual([]);
    expect(goal.automaton).toBeUndefined();
    expect(steps.map((s) => s.id)).toEqual([
      'convert/idea',
      'convert/open',
      'convert/pair',
      'convert/accepting',
      'convert/save',
      'done',
    ]);
    expect(countedSteps(L)).toBe(5);
    expect(steps.some((s) => s.why(ctx(null)) !== null)).toBe(false);
  });

  it('opens with the idea step, which only Next moves past', () => {
    expect(steps[0]!.idea).toBe(true);
    expect(steps[0]!.instruction(ctx(null))).toBe(
      'A DFA can’t guess. So each DFA state stands for a set of NFA states: every state the NFA could be in at that point.',
    );
    expect(advance(L, 0, new Set(), ctx(trace, 0)).current).toBe(0);
    expect(advance(L, 0, idea, ctx(null)).current).toBe(1);
  });

  it('walks from the idea, to Convert to DFA, to each stop, to the end, to saving', () => {
    const first = advance(L, 0, idea, ctx(null));
    expect(first.current).toBe(1);
    const opened = advance(L, first.progress, first.latched, ctx(trace, 0));
    expect(opened.current).toBe(1);
    const pair = advance(L, opened.progress, opened.latched, ctx(trace, pairAt));
    expect(pair.current).toBe(2);
    const early = advance(L, pair.progress, pair.latched, ctx(trace, acceptingAt - 1));
    expect(early.current).toBe(2);
    const accepting = advance(L, pair.progress, pair.latched, ctx(trace, acceptingAt));
    expect(accepting.current).toBe(3);
    const end = advance(L, accepting.progress, accepting.latched, ctx(trace, last));
    expect(end.current).toBe(4);
    const saved = advance(L, end.progress, end.latched, ctx(null, 0, SAVED));
    expect(steps[saved.current]!.id).toBe('done');
  });

  it('pauses where «{q_0,q_1}» and «{q_0,q_2}» appear', () => {
    expect(steps[1]!.pauseAt!(ctx(trace, 0))).toBe(pairAt);
    expect(steps[2]!.pauseAt!(ctx(trace, 0))).toBe(acceptingAt);
    expect(steps[1]!.pauseAt!(ctx(null))).toBeNull();
    for (const i of [0, 3, 4]) expect(steps[i]!.pauseAt, String(i)).toBeUndefined();
    const moment = trace.steps[pairAt]!;
    expect(moment).toMatchObject({ subset: ['q_0'], symbol: '0', isNew: true });
    expect(moment.moved).toEqual(['q_0', 'q_1']);
  });

  it('lands on the first stop when the walkthrough was opened during the idea step', () => {
    expect(pacingStep(L, 0)!.id).toBe('convert/open');
    expect(pacingStep(L, 0)!.pauseAt!(ctx(trace, 0))).toBe(1);
    expect(advance(L, 0, idea, ctx(trace, pairAt), 0).current).toBe(2);
    expect(steps[2]!.id).toBe('convert/pair');
  });

  it('keeps saying to press Convert to DFA until the first stop', () => {
    expect(advance(L, 0, idea, ctx(trace, 0)).current).toBe(1);
    expect(steps[1]!.instruction(ctx(null))).toBe('Press Convert to DFA at the top.');
  });

  it('explains each moment, with the instruction a plain press', () => {
    expect(steps[1]!.explain(ctx(null))).toBeNull();
    expect(steps[2]!.instruction(ctx(null))).toBe('Press Play.');
    expect(steps[2]!.explain(ctx(null))).toBe(
      'After a `0` the NFA could be in «q_0» or «q_1», so the DFA gets the state «{q_0,q_1}».',
    );
    expect(steps[3]!.instruction(ctx(null))).toBe('Press Play to finish.');
    expect(steps[3]!.explain(ctx(null))).toBe(
      '«{q_0,q_2}» holds «q_2», which accepts, so this DFA state accepts too.',
    );
    expect(steps[4]!.instruction(ctx(null))).toBe('Press Save as new automaton to keep the DFA.');
    expect(steps[4]!.explain(ctx(null))).toBe(
      'Every set the NFA can reach is now a state: four in all.',
    );
  });

  it('asks to press Convert to DFA again once the walkthrough is closed, without losing steps', () => {
    const p = advance(L, 0, idea, ctx(trace, 0));
    const pair = advance(L, p.progress, p.latched, ctx(trace, pairAt));
    expect(pair.current).toBe(2);
    const closed = advance(L, pair.progress, pair.latched, ctx(null));
    expect(closed.current).toBe(2);
    for (const id of ['convert/idea', 'convert/open']) {
      expect(closed.latched.has(id), id).toBe(true);
    }
    const again = { kind: 'first', text: 'First, press Convert to DFA again.' };
    for (const i of [2, 3, 4]) expect(steps[i]!.hint(ctx(null))).toEqual(again);
    expect(steps[2]!.hint(ctx(trace, 0))).toBeNull();
    const reopened = advance(L, closed.progress, closed.latched, ctx(trace, 0));
    expect(reopened.current).toBe(2);
  });

  it('stops asking for Convert to DFA on the save step once a DFA is saved', () => {
    expect(steps[4]!.hint(ctx(null, 0, SAVED))).toBeNull();
    expect(steps[4]!.hint(ctx(null))).not.toBeNull();
  });

  it('ignores a walkthrough of an automaton it does not own', () => {
    const other = subsetConstruction({ ...CONTAINS_01, id: 'someone-else' });
    expect(advance(L, 0, idea, ctx(other, 0)).current).toBe(1);
  });

  it('points at the Convert button, the dock, then the save button', () => {
    expect(steps[0]!.target(ctx(null))).toBeNull();
    expect(steps[1]!.target(ctx(null))).toBe('button[aria-label="Convert to DFA"]');
    for (const i of [2, 3]) expect(steps[i]!.target(ctx(null))).toBe('[data-testid="dock"]');
    expect(steps[4]!.target(ctx(null))).toBe('[data-testid="save-trace-result"]');
  });

  it('asks to press Play to reach the end on the save step', () => {
    const text = 'First, press Play to reach the end.';
    expect(steps[4]!.hint(ctx(trace, 0))).toEqual({ kind: 'first', text });
    expect(steps[4]!.hint(ctx(trace, last))).toBeNull();
    expect(steps[4]!.hint(ctx(trace, 0, SAVED))).toBeNull();
  });
});
