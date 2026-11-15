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
const pairTurn = trace.steps.findIndex(
  (s) => s.phase === 'expand' && s.subset.includes('q_0') && s.subset.includes('q_1'),
);
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
    expect(pairTurn).toBeGreaterThan(pairAt);
  });

  it('holds its goal examples on both pictures', () => {
    const goal = L.parts[0]!.goal;
    for (const e of goal.examples) {
      expect(runWord(goal.automaton, e.word).accepted, e.word).toBe(e.accepted);
      expect(runWord(goal.after!.automaton, e.word).accepted, e.word).toBe(e.accepted);
    }
    expect(goal.after!.automaton.states).toHaveLength(4);
    expect(goal.after!.automaton.kind).toBe('DFA');
  });

  it('stays within six counted steps', () => {
    expect(countedSteps(L)).toBeLessThanOrEqual(6);
  });

  it('walks from Convert to DFA, to the first state, to the pair, to the end, to saving', () => {
    expect(advance(L, 0, new Set(), ctx(null)).current).toBe(0);
    const opened = advance(L, 0, new Set(), ctx(trace, 0));
    expect(opened.current).toBe(1);
    const first = advance(L, opened.progress, opened.latched, ctx(trace, firstInit + 1));
    expect(first.current).toBe(2);
    const pair = advance(L, first.progress, first.latched, ctx(trace, pairTurn));
    expect(pair.current).toBe(3);
    const end = advance(L, pair.progress, pair.latched, ctx(trace, last));
    expect(end.current).toBe(4);
    const saved = advance(L, end.progress, end.latched, ctx(null, 0, SAVED));
    expect(steps[saved.current]!.id).toBe('done');
  });

  it('does not count the first state until it has been looked at, or the pair before it appears', () => {
    const opened = advance(L, 0, new Set(), ctx(trace, 0));
    const early = advance(L, opened.progress, opened.latched, ctx(trace, firstInit));
    expect(early.current).toBe(1);
    const first = advance(L, opened.progress, opened.latched, ctx(trace, firstInit + 1));
    const before = advance(L, first.progress, first.latched, ctx(trace, pairTurn - 1));
    expect(before.current).toBe(2);
  });

  it('asks to press Convert to DFA again once the walkthrough is closed, without losing steps', () => {
    const opened = advance(L, 0, new Set(), ctx(trace, 0));
    const first = advance(L, opened.progress, opened.latched, ctx(trace, firstInit + 1));
    const pair = advance(L, first.progress, first.latched, ctx(trace, pairTurn));
    expect(pair.current).toBe(3);

    const closed = advance(L, pair.progress, pair.latched, ctx(null));
    expect(closed.current).toBe(3);
    for (const id of ['convert/open', 'convert/first', 'convert/pair']) {
      expect(closed.latched.has(id), id).toBe(true);
    }
    const again = { kind: 'first', text: 'First, press Convert to DFA again.' };
    for (const i of [1, 2, 3, 4]) expect(steps[i]!.hint(ctx(null))).toEqual(again);
    expect(steps[3]!.hint(ctx(trace, 0))).toBeNull();

    const reopened = advance(L, closed.progress, closed.latched, ctx(trace, 0));
    expect(reopened.current).toBe(3);
  });

  it('stops asking for Convert to DFA on the save step once a DFA is saved', () => {
    expect(steps[4]!.hint(ctx(null, 0, SAVED))).toBeNull();
    expect(steps[4]!.hint(ctx(null))).not.toBeNull();
  });

  it('ignores a walkthrough of an automaton it does not own', () => {
    const other = subsetConstruction({ ...CONTAINS_01, id: 'someone-else' });
    expect(advance(L, 0, new Set(), ctx(other, 0)).current).toBe(0);
  });

  it('points at the Convert button, the dock, the explanation, then the dock', () => {
    expect(steps[0]!.target(ctx(null))).toBe('button[aria-label="Convert to DFA"]');
    expect(steps[1]!.target(ctx(null))).toBe('[data-testid="dock"]');
    expect(steps[2]!.target(ctx(null))).toBe('.av-player-explanation');
    expect(steps[3]!.target(ctx(null))).toBe('[data-testid="dock"]');
  });

  it('explains why a DFA state is a set', () => {
    expect(steps[1]!.why(ctx(null))).toContain('A DFA can’t guess');
  });
});
