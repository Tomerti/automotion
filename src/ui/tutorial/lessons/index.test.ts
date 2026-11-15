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
      expect(s.instruction(ctx).length, s.id).toBeLessThanOrEqual(100);
      expect(s.why(ctx)?.length ?? 0, s.id).toBeLessThanOrEqual(whyCap);
    }
  });

  it('follows a step that pauses playback with one that says to press Play', () => {
    const steps = lessonSteps(lesson);
    steps.forEach((s, i) => {
      if (s.pauseAt) expect(steps[i + 1]?.instruction(ctx), s.id).toMatch(/^Press Play to /);
    });
  });

  it('has at most six counted steps, unless it is Basics', () => {
    if (id !== 'basics') expect(countedSteps(lesson)).toBeLessThanOrEqual(6);
  });

  it('shows goal examples its goal automaton agrees with', () => {
    for (const part of lesson.parts) {
      for (const e of part.goal.examples) {
        expect(runWord(part.goal.automaton, e.word).accepted, e.word).toBe(e.accepted);
      }
    }
  });
});
