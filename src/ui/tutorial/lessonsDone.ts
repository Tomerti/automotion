import { LESSON_IDS } from './engine';
import type { LessonId } from './engine';

export const LESSONS_DONE_KEY = 'automotion:lessons-done';

/** A real lesson id (not the tests' own). */
export function isLessonId(id: unknown): id is LessonId {
  return typeof id === 'string' && (LESSON_IDS as readonly string[]).includes(id);
}

/** The lessons finished so far, in the order they were finished. Never throws. */
export function finishedLessons(): LessonId[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(LESSONS_DONE_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter(isLessonId) : [];
  } catch {
    return [];
  }
}

/** Remember `id` as finished (best effort: storage may be blocked or full). */
export function markLessonFinished(id: LessonId): void {
  try {
    const done = finishedLessons();
    if (done.includes(id)) return;
    localStorage.setItem(LESSONS_DONE_KEY, JSON.stringify([...done, id]));
  } catch {
    /* not remembered */
  }
}
