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
const START = 'The DFA starts in «{q_0}»: before reading anything, the NFA can only be in «q_0».';
const TO_PAIR = 'Press [→] to follow `0` from «{q_0}».';
const BETWEEN =
  'Below, it follows each symbol from each set: a set it already has is reused, a new one becomes a state.';

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
      'Every NFA has a DFA that accepts exactly the same words. A DFA can’t guess, so each of its states is a set: all the NFA states you could be in after the same input.',
    );
    expect(advance(L, 0, new Set(), ctx(trace, 0)).current).toBe(0);
    expect(advance(L, 0, idea, ctx(null)).current).toBe(1);
  });

  it('walks from the idea, to Convert to DFA, to each stop, to the end, to saving', () => {
    const first = advance(L, 0, idea, ctx(null));
    expect(first.current).toBe(1);
    // The walkthrough opens paused on «{q_0}»: opening it is the step.
    const opened = advance(L, first.progress, first.latched, ctx(trace, 0));
    expect(opened.current).toBe(2);
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

  it('opens Convert to DFA walkthroughs paused, on «{q_0}»', () => {
    expect(L.pausedConvert).toBe(true);
  });

  it('pauses where «{q_0,q_1}» and «{q_0,q_2}» appear', () => {
    // Opened paused, or stepped back or reopened below the explained moment: stop there first.
    expect(steps[2]!.pauseAt!(ctx(trace, 0))).toBe(pairAt);
    expect(steps[2]!.pauseAt!(ctx(trace, pairAt))).toBe(acceptingAt);
    expect(steps[3]!.pauseAt!(ctx(trace, 0))).toBe(acceptingAt);
    expect(steps[3]!.pauseAt!(ctx(trace, acceptingAt))).toBeNull();
    expect(steps[3]!.pauseAt!(ctx(null))).toBeNull();
    for (const i of [0, 1, 4]) expect(steps[i]!.pauseAt, String(i)).toBeUndefined();
    const moment = trace.steps[pairAt]!;
    expect(moment).toMatchObject({ subset: ['q_0'], symbol: '0', isNew: true });
    expect(moment.moved).toEqual(['q_0', 'q_1']);
  });

  it('lands on «{q_0}» when the walkthrough was opened during the idea step', () => {
    const c = ctx(trace, 0);
    const at0 = { progress: 0, current: 0, latched: new Set<string>() };
    expect(pacingStep(L, at0, c)!.id).toBe('convert/pair');
    expect(pacingStep(L, at0, c)!.pauseAt!(c)).toBe(1);
    expect(advance(L, 0, idea, c, 0).current).toBe(2);
    expect(steps[2]!.id).toBe('convert/pair');
  });

  it('follows the walkthrough back with ←, from saving to the stop it is stepped back to', () => {
    const upToSave = new Set(steps.slice(0, 4).map((s) => s.id));
    const onSave = advance(L, 4, upToSave, ctx(trace, last), 4);
    expect(steps[onSave.current]!.id).toBe('convert/save');
    const toAccepting = advance(L, 4, upToSave, ctx(trace, acceptingAt), 4);
    expect(steps[toAccepting.current]!.id).toBe('convert/accepting');
    const toPair = advance(L, 4, upToSave, ctx(trace, pairAt), 4);
    expect(steps[toPair.current]!.id).toBe('convert/pair');
    // Before the pair's moment it explains the start state: Play stops on the pair.
    expect(steps[toPair.current]!.hint(ctx(trace, 0))).toBeNull();
    expect(steps[toPair.current]!.explain(ctx(trace, 0))).toBe(START);
    expect(steps[toPair.current]!.explain(ctx(trace, pairAt))).toContain('Below, it follows `0`');
    expect(advance(L, 4, upToSave, ctx(null), 4).current).toBe(4);
  });

  it('keeps saying to press Convert to DFA until the walkthrough opens', () => {
    expect(advance(L, 0, idea, ctx(null)).current).toBe(1);
    expect(steps[1]!.instruction(ctx(null))).toBe('Press Convert to DFA at the top.');
    expect(advance(L, 0, idea, ctx(trace, 0)).current).toBe(2);
  });

  it('explains each moment, with the instruction a plain press', () => {
    expect(steps[1]!.explain(ctx(null))).toBeNull();
    // Stepped by hand all the way: on «{q_0}» to the pair, then on to the next stop.
    expect(steps[2]!.instruction(ctx(trace, 0))).toBe(TO_PAIR);
    expect(steps[2]!.instruction(ctx(trace, pairAt))).toBe('Press [→] to go on.');
    expect(steps[2]!.instruction(ctx(null))).toBe('Press [→] to go on.');
    expect(steps[2]!.explain(ctx(trace, 0))).toBe(START);
    expect(steps[2]!.explain(ctx(trace, pairAt))).toBe(
      'Below, it follows `0` from «{q_0}»: «q_0» can stay or move to «q_1», so the new DFA state is «{q_0,q_1}».',
    );
    expect(steps[2]!.explain(ctx(trace, pairAt + 1))).toBe(BETWEEN);
    expect(steps[3]!.instruction(ctx(null))).toBe('Press [→] until the last step.');
    expect(steps[3]!.explain(ctx(trace, acceptingAt))).toBe(
      'Below, `1` from «{q_0,q_1}» leads to «{q_0,q_2}». It holds «q_2», which accepts, so this DFA state accepts too.',
    );
    expect(steps[3]!.explain(ctx(trace, acceptingAt + 1))).toBe(BETWEEN);
    // With no walkthrough open the card asks to reopen it instead.
    expect(steps[2]!.explain(ctx(null))).toBeNull();
    expect(steps[3]!.explain(ctx(null))).toBeNull();
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

  it('points at the Convert button, nothing while playing, then the save button', () => {
    expect(steps[0]!.target(ctx(null))).toBeNull();
    expect(steps[1]!.target(ctx(null))).toBe('button[aria-label="Convert to DFA"]');
    for (const i of [2, 3]) expect(steps[i]!.target(ctx(null))).toBeNull();
    expect(steps[4]!.target(ctx(null))).toBe('[data-testid="save-trace-result"]');
  });

  it('asks to step to the end on the save step', () => {
    const text = 'First, press [→] until the last step.';
    expect(steps[4]!.hint(ctx(trace, 0))).toEqual({ kind: 'first', text });
    expect(steps[4]!.hint(ctx(trace, last))).toBeNull();
    expect(steps[4]!.hint(ctx(trace, 0, SAVED))).toBeNull();
  });
});
