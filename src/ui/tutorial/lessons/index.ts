import type { Lesson, LessonId } from '../engine';
import { BASICS } from './basics';

/** Every lesson, in the order the list shows them. */
export const LESSONS: readonly Lesson[] = [BASICS];

export function lessonById(id: LessonId): Lesson {
  const lesson = LESSONS.find((l) => l.id === id);
  if (!lesson) throw new Error(`No lesson ${id}`);
  return lesson;
}
