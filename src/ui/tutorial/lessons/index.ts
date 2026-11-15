import type { Lesson, LessonId } from '../engine';
import { BASICS } from './basics';
import { CONVERT_LESSON } from './convert';
import { MINIMIZE_LESSON } from './minimize';
import { NFA_LESSON } from './nfa';

/** A lesson that is listed: it has a real id, unlike the tests' own lessons. */
export type ListedLesson = Lesson & { id: LessonId };

/** Every lesson, in the order the list shows them. */
export const LESSONS: readonly ListedLesson[] = [
  BASICS,
  NFA_LESSON,
  CONVERT_LESSON,
  MINIMIZE_LESSON,
];

/** The first lesson not in `done`, or null when every one is finished. */
export function nextLesson(done: readonly LessonId[]): ListedLesson | null {
  return LESSONS.find((l) => !done.includes(l.id)) ?? null;
}

export function lessonById(id: LessonId): Lesson {
  const lesson = LESSONS.find((l) => l.id === id);
  if (!lesson) throw new Error(`No lesson ${id}`);
  return lesson;
}
