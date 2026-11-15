import { describe, expect, it } from 'vitest';
import { runWord } from '../../../core/run';
import { countedSteps, lessonSteps } from '../engine';
import type { TutorialContext } from '../engine';
import { LESSONS } from './index';

describe.each(LESSONS.map((l) => [l.id, l] as const))('the %s lesson', (id, lesson) => {
  const ctx: TutorialContext = {
    automaton: lesson.start ?? undefined,
    isActive: true,
    trace: null,
    stepIndex: 0,
    selected: [],
    owned: lesson.start ? [lesson.start.id] : [],
    actions: new Set(),
  };

  it('keeps its texts within the caps', () => {
    const whyCap = id === 'basics' ? 70 : 110;
    for (const s of lessonSteps(lesson)) {
      expect(s.instruction(ctx).length, s.id).toBeLessThanOrEqual(s.idea ? 240 : 100);
      expect(s.why(ctx)?.length ?? 0, s.id).toBeLessThanOrEqual(whyCap);
      expect(s.explain?.(ctx)?.length ?? 0, s.id).toBeLessThanOrEqual(140);
    }
  });

  it('follows a step that pauses playback with one whose instruction says what to press', () => {
    const steps = lessonSteps(lesson);
    steps.forEach((s, i) => {
      const next = steps[i + 1];
      // A last card's pause is before its own moment: no card follows but the closing one.
      if (s.pauseAt && next && next.part <= lesson.parts.length) {
        expect(next.instruction(ctx), s.id).toMatch(/^Press /);
      }
    });
  });

  it('has at most six counted steps, unless it is Basics', () => {
    if (id !== 'basics') expect(countedSteps(lesson)).toBeLessThanOrEqual(6);
  });

  it('opens every lesson but Basics and Share with an idea step, and no other step is one', () => {
    const steps = lessonSteps(lesson);
    const opens = id !== 'basics' && id !== 'share';
    steps.forEach((s, i) => {
      expect(Boolean(s.idea), s.id).toBe(opens && i === 0);
    });
  });

  it('gives idea steps no why line and no target', () => {
    for (const s of lessonSteps(lesson).filter((x) => x.idea)) {
      expect(s.why(ctx), s.id).toBeNull();
      expect(s.target(ctx), s.id).toBeNull();
    }
  });

  it('shows no goal picture outside Basics', () => {
    if (id === 'basics') return;
    for (const part of lesson.parts) expect(part.goal.automaton).toBeUndefined();
  });

  it('points at nothing on the word box or the dock outside Basics', () => {
    if (id === 'basics') return;
    for (const s of lessonSteps(lesson)) {
      const t = s.target(ctx) ?? '';
      expect(t, s.id).not.toContain('Word');
      expect(t, s.id).not.toContain('data-testid="dock"');
    }
  });

  it('shows goal examples its goal automaton agrees with', () => {
    for (const part of lesson.parts) {
      for (const e of part.goal.examples) {
        expect(runWord((part.goal.automaton ?? lesson.start)!, e.word).accepted, e.word).toBe(
          e.accepted,
        );
      }
    }
  });
});

it('lists the lessons in order', () => {
  expect(LESSONS.map((l) => l.id)).toEqual([
    'basics',
    'nfa',
    'epsilon',
    'convert',
    'minimize',
    'share',
  ]);
});
