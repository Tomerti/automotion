import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { StateId } from '../../core/model';
import type { Issue } from '../../core/validate';

export type IssueMark = Issue['severity'];

/**
 * The states the open issues popover points at, marked on the canvas with a ring in the issue's
 * color (an error wins over a warning). Empty while the popover is closed: an incomplete DFA is
 * normal mid-build, so the marks only show when the user asks to see the issues.
 */
export const issueMarksStore = createStore<{ states: Record<StateId, IssueMark> }>()(() => ({
  states: {},
}));

export const useIssueMarks = (): Record<StateId, IssueMark> =>
  useStore(issueMarksStore, (s) => s.states);

export function marksFor(issues: readonly Issue[]): Record<StateId, IssueMark> {
  const marks: Record<StateId, IssueMark> = {};
  for (const issue of issues) {
    if (issue.stateId !== undefined && marks[issue.stateId] !== 'error') {
      marks[issue.stateId] = issue.severity;
    }
  }
  return marks;
}

export function showIssueMarks(issues: readonly Issue[]): void {
  issueMarksStore.setState({ states: marksFor(issues) });
}

export function clearIssueMarks(): void {
  issueMarksStore.setState({ states: {} });
}
