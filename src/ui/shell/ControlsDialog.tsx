import { useId, useRef, useState } from 'react';
import { GestureChip } from './GestureChip';
import type { Gesture } from './GestureChip';
import type { LessonId } from '../tutorial/engine';
import { LESSONS } from '../tutorial/lessons';
import { finishedLessons } from '../tutorial/lessonsDone';
import { useTutorial } from '../tutorial/tutorialStore';
import { CloseIcon } from './icons';
import { useTouchOnly } from './touch';
import { useModalDialog } from './useModalDialog';

interface Row {
  gesture: Gesture;
  action: string;
  hint?: string;
}

interface Tab {
  id: string;
  title: string;
  rows: Row[];
}

const TABS: Tab[] = [
  {
    id: 'build',
    title: 'Build',
    rows: [
      { gesture: { mouse: 'double', on: 'empty canvas' }, action: 'Add a state' },
      {
        gesture: { keys: ['Shift'], mouse: 'drag', on: 'state to state' },
        action: 'Add a transition',
        hint: 'Drop it on the same state for a self-loop',
      },
      {
        gesture: { mouse: 'double', on: 'a state' },
        action: 'Rename the state',
        hint: 'Type \\emptyset for ∅',
      },
      {
        gesture: { mouse: 'double', on: 'an arrow' },
        action: 'Edit its symbols',
        hint: 'Type \\eps for ε',
      },
      { gesture: { mouse: 'right', on: 'state or arrow' }, action: 'More options' },
    ],
  },
  {
    id: 'arrange',
    title: 'Arrange',
    rows: [
      {
        gesture: { mouse: 'drag', on: 'a state' },
        action: 'Move it',
        hint: 'The rest of the selection moves along. Snaps into line and to equal gaps; hold Alt to place freely',
      },
      {
        gesture: { mouse: 'drag', on: 'an arrow' },
        action: 'Bend it',
        hint: 'A self-loop turns around its state, in 45° steps; hold Alt to turn freely',
      },
      {
        gesture: { mouse: 'drag', on: 'an arrow’s symbols' },
        action: 'Move them to the other side',
        hint: 'Above or below it; inside or outside a curve',
      },
      {
        gesture: { mouse: 'drag', on: 'the start arrow' },
        action: 'Turn it around its state',
        hint: 'Snaps to 45° steps; hold Alt to turn freely',
      },
      { gesture: { mouse: 'drag', on: 'empty canvas' }, action: 'Pan' },
      {
        gesture: { keys: ['Ctrl'], mouse: 'drag', on: 'empty canvas' },
        action: 'Select the states in a box',
      },
      {
        gesture: { keys: ['Ctrl'], mouse: 'click', on: 'state or arrow' },
        action: 'Add it to the selection or take it out',
      },
      { gesture: { mouse: 'scroll' }, action: 'Zoom' },
      { gesture: { mouse: 'click', on: 'empty canvas' }, action: 'Clear the selection' },
    ],
  },
  {
    id: 'run',
    title: 'Run',
    rows: [
      {
        gesture: { keys: ['Enter'], on: 'in “Test a word”' },
        action: 'Run the word',
        hint: 'It plays right away. ε or an empty box is the empty word',
      },
      { gesture: { keys: ['Space'] }, action: 'Pause or play' },
      { gesture: { keys: ['→'] }, action: 'Step forward' },
      { gesture: { keys: ['←'] }, action: 'Step back' },
      { gesture: { keys: ['Esc'] }, action: 'Back to editing' },
    ],
  },
  {
    id: 'keys',
    title: 'Keys',
    rows: [
      { gesture: { keys: ['S'], on: 'selected state' }, action: 'Toggle start state' },
      { gesture: { keys: ['A'], on: 'selected state' }, action: 'Toggle accepting' },
      {
        gesture: { keys: ['Delete'], on: 'selection or history entry' },
        action: 'Delete it',
        hint: 'A history entry asks first. Ctrl+click history entries to delete several at once',
      },
      {
        gesture: { keys: ['Ctrl', 'X'], on: 'selected states' },
        action: 'Cut them',
        hint: 'Copies them and deletes them; Ctrl+V puts them back',
      },
      {
        gesture: { keys: ['Ctrl', 'C'], on: 'selection or history entry' },
        action: 'Copy it',
        hint: 'With nothing selected, the diagram as a picture',
      },
      {
        gesture: { keys: ['Ctrl', 'A'], on: 'canvas or history bar' },
        action: 'Select everything',
        hint: 'Every state and arrow; in the history bar every automaton, which Delete then deletes after asking',
      },
      {
        gesture: { keys: ['Ctrl', 'V'] },
        action: 'Paste',
        hint: 'States at the pointer; an automaton as a new copy; LaTeX (TikZ) code as new automata (also Import → Paste LaTeX…)',
      },
      { gesture: { keys: ['Ctrl', 'Z'] }, action: 'Undo' },
      { gesture: { keys: ['Ctrl', 'Y'] }, action: 'Redo' },
      { gesture: { keys: ['?'] }, action: 'Open this guide' },
    ],
  },
];

const TAB_TITLES = [...TABS.map((t) => t.title), 'Lessons'];

/** The last tab lists the lessons instead of gestures. */
const LESSONS_TAB = TABS.length;

/**
 * Modal guide to the controls, one tab per task. Escape, the backdrop or the close button
 * dismiss it; ←/→ move between tabs.
 */
export function ControlsDialog({
  onClose,
  onStartLesson,
  openOnLessons = false,
}: {
  onClose: () => void;
  onStartLesson: (id: LessonId) => void;
  /** Open on the Lessons tab (from the popup after the tutorial) instead of the first. */
  openOnLessons?: boolean;
}): React.JSX.Element {
  const running = useTutorial((s) => (s.active ? s.lessonId : null));
  const touchOnly = useTouchOnly();
  const [done] = useState(finishedLessons);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(openOnLessons ? LESSONS_TAB : 0);
  const baseId = useId();
  useModalDialog(dialogRef, onClose);

  const tabKeys = (e: React.KeyboardEvent): void => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = (tab + delta + TAB_TITLES.length) % TAB_TITLES.length;
    setTab(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  };

  return (
    <div
      className="av-modal-backdrop"
      data-testid="modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="av-modal av-guide"
        role="dialog"
        aria-modal="true"
        aria-label="Controls"
        tabIndex={-1}
      >
        <header className="av-modal-head">
          <h2>Controls</h2>
          <button
            type="button"
            className="av-icon-button"
            aria-label="Close controls"
            title="Close (Esc)"
            data-focus-stop
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>
        <div className="av-guide-tabs" role="tablist" aria-label="Topics" onKeyDown={tabKeys}>
          {TAB_TITLES.map((title, i) => (
            <button
              key={title}
              id={`${baseId}-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={i === tab}
              aria-controls={`${baseId}-panel-${i}`}
              tabIndex={i === tab ? 0 : -1}
              data-focus-stop
              onClick={() => setTab(i)}
            >
              {title}
            </button>
          ))}
        </div>
        {/* The dialog is as tall as the open tab; its top stays put (App.css), so the tabs don't move. */}
        <div className="av-guide-panels">
          {TABS.map((t, i) => (
            <ul
              key={t.id}
              id={`${baseId}-panel-${i}`}
              className="av-guide-list"
              role="tabpanel"
              aria-labelledby={`${baseId}-tab-${i}`}
              hidden={i !== tab}
            >
              {t.rows.map((r) => (
                <li key={r.action} className="av-guide-row">
                  <GestureChip gesture={r.gesture} />
                  <span className="av-guide-what">
                    <span className="av-guide-action">{r.action}</span>
                    {r.hint && <span className="av-guide-hint">{r.hint}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ))}
          <div
            id={`${baseId}-panel-${LESSONS_TAB}`}
            className="av-lessons"
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${LESSONS_TAB}`}
            hidden={tab !== LESSONS_TAB}
          >
            {touchOnly && <p className="av-lessons-note">Lessons need a mouse and keyboard.</p>}
            <ul className="av-guide-list">
              {LESSONS.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className="av-guide-row av-lesson-row"
                    data-testid={`lesson-${l.id}`}
                    disabled={touchOnly}
                    onClick={() => onStartLesson(l.id)}
                  >
                    <span className="av-guide-what">
                      <span className="av-guide-action">{l.title}</span>
                      <span className="av-guide-hint">{l.summary}</span>
                    </span>
                    {done.includes(l.id) && (
                      <span className="av-lesson-done" role="img" aria-label="finished">
                        ✓
                      </span>
                    )}
                    <span className="av-lesson-time">
                      {running === l.id ? 'Restart' : `~${l.minutes} min`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
