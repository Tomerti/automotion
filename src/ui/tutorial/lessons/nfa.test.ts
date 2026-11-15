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

const at = (word: string, i?: number): TutorialContext => {
  const t = runWord(start, word);
  return ctx(t, i ?? t.steps.length - 1);
};

const aab = runWord(start, 'aab');
const firstRead = aab.steps.findIndex((s) => s.phase === 'read');
/** Where the q_1 branch dies: «q_1» has no arrow on `a`. */
const death = aab.steps.findIndex(
  (s) => s.phase === 'read' && s.symbol === 'a' && s.before.includes('q_1'),
);

describe('the NFAs lesson', () => {
  it('holds its goal examples on the start automaton', () => {
    for (const e of NFA_LESSON.parts[0]!.goal.examples) {
      expect(runWord(start, e.word).accepted, e.word).toBe(e.accepted);
    }
  });

  it('stays within six counted steps', () => {
    expect(countedSteps(NFA_LESSON)).toBeLessThanOrEqual(6);
  });

  it('kills the q_1 branch on the first a, with q_0 carrying on', () => {
    const step = aab.steps[death]!;
    expect(death).toBe(firstRead);
    expect(step.active).toEqual(['q_0']);
  });

  it('walks from running aab, to a branch dying, to the verdict, to aba and the closing card', () => {
    const none = advance(NFA_LESSON, 0, new Set(), ctx(null));
    expect(none.current).toBe(0);

    const opened = advance(NFA_LESSON, 0, new Set(), at('aab', 0));
    expect(opened.current).toBe(1);

    const died = advance(NFA_LESSON, opened.progress, opened.latched, at('aab', death));
    expect(died.current).toBe(2);

    const verdict = advance(NFA_LESSON, died.progress, died.latched, at('aab'));
    expect(verdict.current).toBe(3);

    const aba = advance(NFA_LESSON, verdict.progress, verdict.latched, at('aba'));
    expect(aba.current).toBe(4);
    expect(steps[aba.current]!.id).toBe('done');
  });

  it('does not count a branch as dead before its first read', () => {
    const early = advance(NFA_LESSON, 0, new Set(), at('aab', firstRead - 1));
    expect(early.current).toBe(1);
  });

  it('asks to run aab again once the run is closed, and keeps step 1 latched', () => {
    const opened = advance(NFA_LESSON, 0, new Set(), at('aab', 0));
    const closed = advance(NFA_LESSON, opened.progress, opened.latched, ctx(null));
    expect(closed.current).toBe(1);
    expect(closed.latched.has('nfa/run')).toBe(true);
    expect(steps[1]!.hint(ctx(null))).toEqual({ kind: 'first', text: 'First, run `aab` again.' });
    expect(steps[1]!.hint(at('aab', 0))).toBeNull();
    expect(steps[2]!.hint(ctx(null))).toEqual({ kind: 'first', text: 'First, run `aab` again.' });
  });

  it('says which word is open when another word than aab is run on the first step', () => {
    expect(steps[0]!.hint(at('ab', 0))).toEqual({
      kind: 'text',
      text: 'That was `ab`. Press [Esc] and run `aab`.',
    });
    expect(steps[0]!.hint(at('aab', 0))).toBeNull();
    expect(steps[0]!.hint(ctx(null))).toBeNull();
    expect(steps[0]!.hint(at('', 0))).toEqual({
      kind: 'text',
      text: 'That was `ε`. Press [Esc] and run `aab`.',
    });
  });

  it('pauses the aab run where the branch dies, the step it latches on', () => {
    expect(steps[1]!.pauseAt!(at('aab', 0))).toBe(death);
    expect(steps[1]!.pauseAt!(ctx(null))).toBeNull();
    expect(steps[1]!.pauseAt!(at('ab', 0))).toBeNull();
    const opened = advance(NFA_LESSON, 0, new Set(), at('aab', 0));
    expect(advance(NFA_LESSON, 1, opened.latched, at('aab', death - 1)).current).toBe(1);
    expect(advance(NFA_LESSON, 1, opened.latched, at('aab', death)).current).toBe(2);
    for (const i of [0, 2, 3]) expect(steps[i]!.pauseAt, String(i)).toBeUndefined();
  });

  it('explains the paused moment on the card while paused, and says to press Play', () => {
    expect(steps[2]!.instruction(ctx(null))).toBe('Press Play to see the verdict.');
    expect(steps[2]!.why(ctx(null))).toBe(
      '«q_1» has no arrow on `a`, so that guess dies while «q_0» carries on.',
    );
  });

  it('points at the run pill, then the dock', () => {
    expect(steps[0]!.target(ctx(null))).toContain('Word');
    expect(steps[1]!.target(ctx(null))).toBe('[data-testid="dock"]');
    expect(steps[2]!.target(ctx(null))).toBe('[data-testid="dock"]');
    expect(steps[3]!.target(ctx(null))).toContain('Word');
  });

  it('lets the aba run play to its verdict without asking for Play', () => {
    expect(steps[3]!.instruction(ctx(null))).toBe('Press [Esc], then run `aba`.');
    expect(steps[3]!.hint(at('aba', 0))).toBeNull();
    expect(steps[3]!.hint(at('aba'))).toBeNull();
  });

  it('says every branch has died by the last a of aba, as the run shows', () => {
    const aba = runWord(start, 'aba');
    const end = aba.steps[aba.steps.length - 1]!;
    expect(end.phase).toBe('stuck');
    expect(end.symbol).toBe('a');
    expect(end.active).toEqual([]);
    expect(steps[3]!.why(ctx(null))).toContain('last `a` every branch has died');
  });
});
