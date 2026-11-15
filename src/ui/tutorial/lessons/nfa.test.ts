import { describe, expect, it } from 'vitest';
import { runWord } from '../../../core/run';
import type { RunTrace } from '../../../core/trace';
import { advance, countedSteps, lessonSteps } from '../engine';
import type { TutorialContext } from '../engine';
import { NFA_LESSON } from './nfa';

const start = NFA_LESSON.start!;
const steps = lessonSteps(NFA_LESSON);

function ctx(trace: RunTrace | null, stepIndex = 0, more: Partial<TutorialContext> = {}) {
  return {
    automaton: start,
    isActive: true,
    trace,
    stepIndex,
    selected: [],
    owned: [start.id],
    actions: new Set(),
    ...more,
  } satisfies TutorialContext;
}

const at = (word: string, i: number): TutorialContext => ctx(runWord(start, word), i);

const idea = new Set(['nfa/idea']);
const BACK = { kind: 'first', text: 'First, press [→] to get back to this point.' };
const RERUN = { kind: 'first', text: 'First, run `001` again.' };

describe('the NFAs lesson', () => {
  it('runs 001 over five steps, guessing and losing a branch, and accepts', () => {
    const t = runWord(start, '001');
    expect(t.steps.map((s) => s.active)).toEqual([
      ['q_0'],
      ['q_0', 'q_1'],
      ['q_0', 'q_1'],
      ['q_0', 'q_2'],
      ['q_0', 'q_2'],
    ]);
    expect(t.accepted).toBe(true);
  });

  it('states its goal in words, with no examples or picture, and stays within six counted steps', () => {
    const goal = NFA_LESSON.parts[0]!.goal;
    expect(goal.text).toBe('This NFA accepts words ending in `01`. Watch it guess.');
    expect(goal.examples).toEqual([]);
    expect(goal.automaton).toBeUndefined();
    expect(countedSteps(NFA_LESSON)).toBe(6);
    expect(NFA_LESSON.pausedRuns).toEqual(['001']);
  });

  it('walks idea, run, then one step per index, then the closing card', () => {
    expect(advance(NFA_LESSON, 0, new Set(), ctx(null)).current).toBe(0);
    const ideaDone = advance(NFA_LESSON, 0, idea, ctx(null));
    expect(ideaDone.current).toBe(1);
    let p = advance(NFA_LESSON, 0, idea, at('001', 0));
    expect(p.current).toBe(2);
    for (const i of [1, 2, 3, 4]) {
      p = advance(NFA_LESSON, p.progress, p.latched, at('001', i));
      expect(p.current).toBe(i + 2);
    }
    expect(steps[p.current]!.id).toBe('done');
  });

  it('pauses at the explained moment, only for an owned run of 001', () => {
    expect([2, 3, 4].map((i) => steps[i]!.pauseAt!(at('001', 0)))).toEqual([1, 1, 2]);
    expect(steps[4]!.pauseAt!(at('001', 1))).toBe(2);
    expect(steps[4]!.pauseAt!(at('001', 2))).toBe(3);
    for (const i of [2, 3, 4]) {
      expect(steps[i]!.pauseAt!(ctx(null))).toBeNull();
      expect(steps[i]!.pauseAt!(at('01', 0))).toBeNull();
    }
    for (const i of [0, 1]) expect(steps[i]!.pauseAt, String(i)).toBeUndefined();
  });

  it('stops at the explained moment, not past it, after stepping back or rerunning', () => {
    expect(steps[3]!.pauseAt!(at('001', 0))).toBe(1);
    expect(steps[4]!.pauseAt!(at('001', 0))).toBe(2);
    expect(steps[4]!.pauseAt!(at('001', 1))).toBe(2);
    expect(steps[5]!.pauseAt!(at('001', 0))).toBe(3);
    expect(steps[5]!.pauseAt!(at('001', 2))).toBe(3);
    expect(steps[5]!.pauseAt!(at('001', 3))).toBeNull();
  });

  it('keeps the card when the run is stepped back below its moment', () => {
    const latched = new Set(['nfa/idea', 'nfa/run', 'nfa/read-0', 'nfa/guess', 'nfa/dies']);
    const ahead = advance(NFA_LESSON, 5, latched, at('001', 3), 5);
    expect(steps[ahead.current]!.id).toBe('nfa/reach');
    const back = advance(NFA_LESSON, 5, latched, at('001', 1), ahead.current);
    expect(back.current).toBe(ahead.current);
    expect(back.latched).toEqual(latched);
  });

  it('playing from the start stops at 1, 2, 3, 4 in turn', () => {
    let p = advance(NFA_LESSON, 0, idea, at('001', 0));
    const stops: (number | null)[] = [];
    for (let i = 1; i <= 4; i++) {
      stops.push(steps[p.current]!.pauseAt?.(at('001', i - 1)) ?? null);
      p = advance(NFA_LESSON, p.progress, p.latched, at('001', i));
    }
    expect(stops).toEqual([1, 2, 3, null]);
    expect(steps[p.current]!.id).toBe('done');
  });

  it('hints how to get back to the explained moment', () => {
    expect(steps[4]!.hint(at('001', 1))).toEqual(BACK);
    expect(steps[4]!.hint(ctx(null))).toEqual(RERUN);
    expect(steps[4]!.hint(at('01', 0))).toEqual(RERUN);
    expect(steps[4]!.hint(at('001', 2))).toBeNull();
    expect(steps[2]!.hint(ctx(null))).toEqual(RERUN);
    expect(steps[2]!.hint(at('001', 0))).toBeNull();
    expect(steps[3]!.hint(at('001', 0))).toEqual(BACK);
    expect(steps[5]!.hint(at('001', 2))).toEqual(BACK);
    expect(steps[5]!.hint(at('001', 3))).toBeNull();
  });

  it('says which word is open on the run step', () => {
    expect(steps[1]!.hint(at('01', 0))).toEqual({
      kind: 'text',
      text: 'That was `01`. Press [Esc] and run `001`.',
    });
    expect(steps[1]!.hint(at('', 0))).toEqual({
      kind: 'text',
      text: 'That was `ε`. Press [Esc] and run `001`.',
    });
    expect(steps[1]!.hint(at('001', 0))).toBeNull();
    expect(steps[1]!.hint(ctx(null))).toBeNull();
  });

  it('a run of 01 latches nothing past the run step', () => {
    const p = advance(NFA_LESSON, 0, idea, at('01', 3));
    expect(p.current).toBe(1);
    expect(p.latched.has('nfa/run')).toBe(false);
  });

  it('explains each moment, with no why and no target', () => {
    const c = ctx(null);
    expect(steps[0]!.idea).toBe(true);
    expect(steps[2]!.explain(c)).toBe('It starts in «q_0», with nothing guessed yet.');
    expect(steps[3]!.explain(c)).toBe(
      'It guessed this `0` starts the final `01`, so it follows both «q_0» and «q_1».',
    );
    expect(steps[4]!.explain(c)).toBe(
      '«q_1» had no arrow on `0`, so that guess died; «q_0» made the same guess again.',
    );
    expect(steps[5]!.explain(c)).toBe('The guess in «q_1» read `1` and reached «q_2».');
    for (const s of steps) {
      expect(s.target(c), s.id).toBeNull();
      expect(s.why(c), s.id).toBeNull();
    }
    expect(steps[1]!.explain(c)).toBeNull();
  });
});
