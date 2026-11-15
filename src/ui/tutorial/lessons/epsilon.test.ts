import { describe, expect, it } from 'vitest';
import { runWord } from '../../../core/run';
import type { RunTrace } from '../../../core/trace';
import { advance, countedSteps, lessonSteps } from '../engine';
import type { TutorialContext } from '../engine';
import { EPSILON_LESSON } from './epsilon';

const start = EPSILON_LESSON.start!;
const steps = lessonSteps(EPSILON_LESSON);

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
const last = (word: string): TutorialContext => {
  const t = runWord(start, word);
  return ctx(t, t.steps.length - 1);
};

const idea = new Set(['epsilon/idea']);
const BACK = { kind: 'first', text: 'First, press [→] to get back to this point.' };
const RERUN = { kind: 'first', text: 'First, run `b` again.' };

describe('the ε-moves lesson', () => {
  it('opens on a*b* and runs b through the ε-closure, the read and the verdict', () => {
    expect(start.id).toBe('epsilon-lesson');
    expect(start.name).toBe('a*b*');
    const t = runWord(start, 'b');
    expect(t.steps.map((s) => s.phase)).toEqual(['start', 'closure', 'read', 'verdict']);
    expect(t.accepted).toBe(true);
    const ba = runWord(start, 'ba');
    expect(ba.accepted).toBe(false);
    expect(ba.steps.at(-1)!.phase).toBe('stuck');
  });

  it('states its goal in words, with no examples or picture, and stays within six counted steps', () => {
    const goal = EPSILON_LESSON.parts[0]!.goal;
    expect(goal.text).toBe('This NFA accepts some a’s, then some b’s. Watch the ε-arrow.');
    expect(goal.examples).toEqual([]);
    expect(goal.automaton).toBeUndefined();
    expect(countedSteps(EPSILON_LESSON)).toBe(6);
    expect(EPSILON_LESSON.pausedRuns).toEqual(['b']);
    expect(EPSILON_LESSON.title).toBe('ε-moves');
  });

  it('walks all six steps to the closing card', () => {
    expect(advance(EPSILON_LESSON, 0, new Set(), ctx(null)).current).toBe(0);
    expect(advance(EPSILON_LESSON, 0, idea, ctx(null)).current).toBe(1);
    let p = advance(EPSILON_LESSON, 0, idea, at('b', 0));
    expect(p.current).toBe(2);
    p = advance(EPSILON_LESSON, p.progress, p.latched, at('b', 1));
    expect(p.current).toBe(3);
    p = advance(EPSILON_LESSON, p.progress, p.latched, at('b', 2));
    expect(p.current).toBe(4);
    p = advance(EPSILON_LESSON, p.progress, p.latched, at('b', 3));
    expect(steps[p.current]!.id).toBe('epsilon/ba');
    p = advance(EPSILON_LESSON, p.progress, p.latched, last('ba'));
    expect(steps[p.current]!.id).toBe('done');
  });

  it('pauses at indices 1 and 2, only for an owned run of b', () => {
    expect([2, 3].map((i) => steps[i]!.pauseAt!(at('b', 0)))).toEqual([1, 1]);
    expect(steps[3]!.pauseAt!(at('b', 1))).toBe(2);
    for (const i of [2, 3]) {
      expect(steps[i]!.pauseAt!(ctx(null))).toBeNull();
      expect(steps[i]!.pauseAt!(at('ba', 0))).toBeNull();
    }
    for (const i of [0, 1, 5]) expect(steps[i]!.pauseAt, String(i)).toBeUndefined();
  });

  it('stops at the explained moment, not past it, after stepping back or rerunning', () => {
    expect(steps[3]!.pauseAt!(at('b', 0))).toBe(1);
    expect(steps[4]!.pauseAt!(at('b', 0))).toBe(2);
    expect(steps[4]!.pauseAt!(at('b', 1))).toBe(2);
    expect(steps[4]!.pauseAt!(at('b', 2))).toBeNull();
    expect(steps[4]!.pauseAt!(ctx(null))).toBeNull();
  });

  it('hints how to get back to the explained moment', () => {
    expect(steps[2]!.hint(ctx(null))).toEqual(RERUN);
    expect(steps[2]!.hint(at('b', 0))).toBeNull();
    expect(steps[3]!.hint(at('b', 0))).toEqual(BACK);
    expect(steps[3]!.hint(at('b', 1))).toBeNull();
    expect(steps[4]!.hint(at('b', 1))).toEqual(BACK);
    expect(steps[4]!.hint(at('b', 2))).toBeNull();
    expect(steps[4]!.hint(ctx(null))).toEqual(RERUN);
  });

  it('plays ba freely and does not blame the open b run on the last step', () => {
    expect(steps[5]!.hint(last('b'))).toBeNull();
    expect(steps[5]!.hint(last('ab'))).toEqual({
      kind: 'text',
      text: 'That was `ab`. Press [Esc] and run `ba`.',
    });
    expect(steps[5]!.pauseAt).toBeUndefined();
  });

  it('says which word is open on the run step', () => {
    expect(steps[1]!.hint(at('ab', 0))).toEqual({
      kind: 'text',
      text: 'That was `ab`. Press [Esc] and run `b`.',
    });
    expect(steps[1]!.hint(at('b', 0))).toBeNull();
  });

  it('explains each moment, with no why and no target', () => {
    const c = ctx(null);
    expect(steps[0]!.idea).toBe(true);
    expect(steps[2]!.explain(c)).toBe("It starts in «q_0» and hasn't read anything yet.");
    expect(steps[3]!.explain(c)).toBe(
      "It took the ε-arrow for free: it's in «q_0» and «q_1» before reading a letter.",
    );
    expect(steps[4]!.explain(c)).toBe(
      '«q_0» has no arrow on `b`, but «q_1» does: no `a` was needed.',
    );
    expect(steps[5]!.explain(c)).toBeNull();
    expect(steps[5]!.explain(at('b', 2))).toBeNull();
    expect(steps[5]!.explain(last('ba'))).toBeNull();
    expect(steps[5]!.explain(last('b'))).toBe('It ended in «q_1», which accepts.');
    for (const s of steps) {
      expect(s.target(c), s.id).toBeNull();
      expect(s.why(c), s.id).toBeNull();
    }
  });
});
