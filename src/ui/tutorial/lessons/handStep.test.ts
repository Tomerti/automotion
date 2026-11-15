import { describe, expect, it } from 'vitest';
import { runWord } from '../../../core/run';
import type { TutorialContext } from '../engine';
import { atMoment } from './handStep';
import { NFA_LESSON } from './nfa';

const start = NFA_LESSON.start!;

function ctx(word: string | null, stepIndex: number): TutorialContext {
  return {
    automaton: start,
    isActive: true,
    trace: word === null ? null : runWord(start, word),
    stepIndex,
    selected: [],
    owned: [start.id],
    actions: new Set(),
  };
}

describe('atMoment', () => {
  const m = atMoment('001', 2);

  it('stops at the moment while the run is before it, and one on once it is there', () => {
    expect(m.pauseAt(ctx('001', 0))).toBe(2);
    expect(m.pauseAt(ctx('001', 1))).toBe(2);
    expect(m.pauseAt(ctx('001', 2))).toBe(3);
    expect(m.pauseAt(ctx('001', 3))).toBe(3);
  });

  it('the final card stops only before its moment: the end of the run stops it otherwise', () => {
    const f = atMoment('001', 3, true);
    expect(f.pauseAt(ctx('001', 0))).toBe(3);
    expect(f.pauseAt(ctx('001', 2))).toBe(3);
    expect(f.pauseAt(ctx('001', 3))).toBeNull();
    expect(f.pauseAt(ctx('001', 4))).toBeNull();
  });

  it('does not pause for another word or without a run', () => {
    expect(m.pauseAt(ctx('01', 0))).toBeNull();
    expect(m.pauseAt(ctx(null, 0))).toBeNull();
  });

  it('asks to rerun, or to step forward to the moment', () => {
    expect(m.first(ctx(null, 0))).toBe('First, run `001` again.');
    expect(m.first(ctx('01', 0))).toBe('First, run `001` again.');
    expect(m.first(ctx('001', 1))).toBe('First, press [→] to get back to this point.');
    expect(m.first(ctx('001', 2))).toBeNull();
    expect(m.first(ctx('001', 4))).toBeNull();
  });
});
