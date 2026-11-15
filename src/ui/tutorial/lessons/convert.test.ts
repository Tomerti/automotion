import { describe, expect, it } from 'vitest';
import { runWord } from '../../../core/run';
import { subsetConstruction } from '../../../core/subset';
import type { SubsetTrace } from '../../../core/trace';
import { advance, countedSteps, lessonSteps } from '../engine';
import type { TutorialContext } from '../engine';
import { CONTAINS_01, CONVERT_LESSON } from './convert';

const L = CONVERT_LESSON;
const steps = lessonSteps(L);
const trace = subsetConstruction(CONTAINS_01);
const firstInit = trace.steps.findIndex((s) => s.phase === 'init');
const pairId = trace.result.states.find((s) => s.label === '{q_0,q_1}')!.id;
const pairAt = trace.steps.findIndex((s) => s.revealedStates.includes(pairId));
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

describe('the Convert NFA → DFA lesson', () => {
  it('opens on an NFA whose DFA has four states, one of them {q_0,q_1}', () => {
    expect(CONTAINS_01.kind).toBe('NFA');
    expect(trace.result.states).toHaveLength(4);
    expect(pairAt).toBe(firstInit + 1);
  });

  it('holds its goal examples on both pictures', () => {
    const goal = L.parts[0]!.goal;
    for (const e of goal.examples) {
      expect(runWord(goal.automaton!, e.word).accepted, e.word).toBe(e.accepted);
      expect(runWord(goal.after!.automaton, e.word).accepted, e.word).toBe(e.accepted);
    }
    expect(goal.after!.automaton.states).toHaveLength(4);
    expect(goal.after!.automaton.kind).toBe('DFA');
  });

  it('stays within six counted steps', () => {
    expect(countedSteps(L)).toBeLessThanOrEqual(6);
  });

  it('walks from Convert to DFA, to the pair appearing, to the end, to saving', () => {
    expect(advance(L, 0, new Set(), ctx(null)).current).toBe(0);
    const opened = advance(L, 0, new Set(), ctx(trace, 0));
    expect(opened.current).toBe(1);
    const early = advance(L, opened.progress, opened.latched, ctx(trace, pairAt - 1));
    expect(early.current).toBe(1);
    const pair = advance(L, opened.progress, opened.latched, ctx(trace, pairAt));
    expect(pair.current).toBe(2);
    const end = advance(L, pair.progress, pair.latched, ctx(trace, last));
    expect(end.current).toBe(3);
    const saved = advance(L, end.progress, end.latched, ctx(null, 0, SAVED));
    expect(steps[saved.current]!.id).toBe('done');
  });

  it('pauses the walkthrough where «{q_0,q_1}» appears, the step it latches on', () => {
    expect(steps[1]!.pauseAt!(ctx(trace, 0))).toBe(pairAt);
    expect(steps[1]!.pauseAt!(ctx(null))).toBeNull();
    for (const i of [0, 2, 3]) expect(steps[i]!.pauseAt, String(i)).toBeUndefined();
    // The moment: {q_0} reads a 0 and reaches the new state {q_0,q_1}.
    const moment = trace.steps[pairAt]!;
    expect(moment).toMatchObject({ subset: ['q_0'], symbol: '0', isNew: true, target: pairId });
    expect(moment.moved).toEqual(['q_0', 'q_1']);
  });

  it('explains the paused moment on the card while paused, and says to press Play', () => {
    expect(steps[2]!.instruction(ctx(null))).toBe('Press Play to finish building it.');
    expect(steps[2]!.why(ctx(null))).toBe(
      'After a `0` the NFA could still be in «q_0» or have moved to «q_1», so the DFA state is both.',
    );
  });

  it('gives the reason a DFA state is a set before the walkthrough starts', () => {
    expect(steps[0]!.why(ctx(null))).toBe(
      'A DFA can’t guess, so each of its states stands for every NFA state you could be in.',
    );
  });

  it('asks to press Convert to DFA again once the walkthrough is closed, without losing steps', () => {
    const opened = advance(L, 0, new Set(), ctx(trace, 0));
    const pair = advance(L, opened.progress, opened.latched, ctx(trace, pairAt));
    expect(pair.current).toBe(2);

    const closed = advance(L, pair.progress, pair.latched, ctx(null));
    expect(closed.current).toBe(2);
    for (const id of ['convert/open', 'convert/pair']) {
      expect(closed.latched.has(id), id).toBe(true);
    }
    const again = { kind: 'first', text: 'First, press Convert to DFA again.' };
    for (const i of [1, 2, 3]) expect(steps[i]!.hint(ctx(null))).toEqual(again);
    expect(steps[2]!.hint(ctx(trace, 0))).toBeNull();

    const reopened = advance(L, closed.progress, closed.latched, ctx(trace, 0));
    expect(reopened.current).toBe(2);
  });

  it('stops asking for Convert to DFA on the save step once a DFA is saved', () => {
    expect(steps[3]!.hint(ctx(null, 0, SAVED))).toBeNull();
    expect(steps[3]!.hint(ctx(null))).not.toBeNull();
  });

  it('ignores a walkthrough of an automaton it does not own', () => {
    const other = subsetConstruction({ ...CONTAINS_01, id: 'someone-else' });
    expect(advance(L, 0, new Set(), ctx(other, 0)).current).toBe(0);
  });

  it('points at the Convert button, then the dock', () => {
    expect(steps[0]!.target(ctx(null))).toBe('button[aria-label="Convert to DFA"]');
    for (const i of [1, 2, 3]) expect(steps[i]!.target(ctx(null))).toBe('[data-testid="dock"]');
  });

  it('asks to play the reopened walkthrough to its end on the save step', () => {
    const text = 'First, let it play to the end.';
    expect(steps[3]!.hint(ctx(trace, 0))).toEqual({ kind: 'first', text });
    expect(steps[3]!.hint(ctx(trace, last))).toBeNull();
    expect(steps[3]!.hint(ctx(trace, 0, SAVED))).toBeNull();
  });
});
