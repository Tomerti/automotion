import type { Lesson, LessonId } from '../engine';
import { BASICS } from './basics';
import { CONVERT_LESSON } from './convert';
import { EPSILON_LESSON } from './epsilon';
import { MINIMIZE_LESSON } from './minimize';
import { NFA_LESSON } from './nfa';
import { SHARE_LESSON } from './share';

/** A lesson that is listed: it has a real id, unlike the tests' own lessons. */
export type ListedLesson = Lesson & { id: LessonId };

/** Every lesson, in the order the list shows them. */
export const LESSONS: readonly ListedLesson[] = [
  BASICS,
  NFA_LESSON,
  EPSILON_LESSON,
  CONVERT_LESSON,
  MINIMIZE_LESSON,
  SHARE_LESSON,
];

/**
 * The first lesson not in `done`, or null when every one is finished. Never Basics: it is the
 * tutorial, offered by the welcome and the Lessons tab, not as the next lesson.
 */
export function nextLesson(done: readonly string[]): ListedLesson | null {
  return LESSONS.find((l) => l !== BASICS && !done.includes(l.id)) ?? null;
}

export function lessonById(id: LessonId): Lesson {
  const lesson = LESSONS.find((l) => l.id === id);
  if (!lesson) throw new Error(`No lesson ${id}`);
  return lesson;
}
