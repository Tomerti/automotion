import { afterEach, describe, expect, it, vi } from 'vitest';
import { finishedLessons, LESSONS_DONE_KEY, markLessonFinished } from './lessonsDone';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem(LESSONS_DONE_KEY);
});

describe('finished lessons', () => {
  it('reads nothing before any lesson is finished', () => {
    expect(finishedLessons()).toEqual([]);
  });

  it('round-trips, without repeats', () => {
    markLessonFinished('basics');
    markLessonFinished('nfa');
    markLessonFinished('basics');
    expect(finishedLessons()).toEqual(['basics', 'nfa']);
    expect(JSON.parse(localStorage.getItem(LESSONS_DONE_KEY)!)).toEqual(['basics', 'nfa']);
  });

  it.each(['nope', '{}', '[1]', 'null', '"basics"', '{"length":1}'])(
    'reads %s as nothing',
    (raw) => {
      localStorage.setItem(LESSONS_DONE_KEY, raw);
      expect(finishedLessons()).toEqual([]);
    },
  );

  it('drops unknown ids', () => {
    localStorage.setItem(LESSONS_DONE_KEY, JSON.stringify(['basics', 'test', 'zzz', 3]));
    expect(finishedLessons()).toEqual(['basics']);
  });

  it('never throws when storage does', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(finishedLessons()).toEqual([]);
    expect(() => markLessonFinished('basics')).not.toThrow();
  });
});
