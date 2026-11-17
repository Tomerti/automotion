import { useRef, useState } from 'react';
import { CloseIcon } from '../shell/icons';
import { useModalDialog } from '../shell/useModalDialog';
import { CHEERS } from './cheers';
import type { Lesson } from './engine';
import { nextLesson } from './lessons';
import { finishedLessons } from './lessonsDone';
import { requestLesson } from './tutorialStore';
import './tutorial.css';

/** Confetti pieces: horizontal position (%), delay (s), colour token. */
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 7) % 10) / 20,
  color: ['--av-run', '--av-green', '--av-accent', '--av-highlighter'][i % 4]!,
}));

/**
 * The popup after Finish: well done, with a joke. Escape, the backdrop, the close button and the
 * button dismiss it.
 */
export function FinishedCard({
  lesson,
  onClose,
  onSeeLessons,
}: {
  lesson: Lesson;
  onClose: () => void;
  /** See the lessons (after the tutorial, or a lesson with none next): open the Lessons tab. */
  onSeeLessons?: () => void;
}): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalDialog(dialogRef, onClose);
  const [cheer] = useState(() => CHEERS[Math.floor(Math.random() * CHEERS.length)]!);
  const tutorial = lesson.noun === 'tutorial';
  // After the tutorial the lessons are pointed to, not started: they're there when wanted.
  const [next] = useState(() => (tutorial ? null : nextLesson([...finishedLessons(), lesson.id])));
  const title = tutorial ? 'Tutorial complete' : 'Lesson complete';
  const seeLessons = (
    <button
      type="button"
      data-focus-stop
      onClick={() => {
        onClose();
        onSeeLessons?.();
      }}
    >
      See the lessons
    </button>
  );

  return (
    <div
      className="av-modal-backdrop av-welcome-backdrop"
      data-testid="modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="av-modal av-welcome av-finished"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="av-confetti" aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              style={{
                left: `${c.left}%`,
                animationDelay: `${c.delay}s`,
                background: `var(${c.color})`,
              }}
            />
          ))}
        </div>
        <header className="av-modal-head">
          <h2>{title}!</h2>
          <button
            type="button"
            className="av-icon-button"
            aria-label="Close"
            title="Close (Esc)"
            data-focus-stop
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>
        <p className="av-finished-cheer" data-testid="tutorial-cheer">
          {cheer}
        </p>
        <div className="av-welcome-actions">
          {tutorial ? (
            <>
              <button type="button" className="av-go" data-focus-stop onClick={onClose}>
                Start building
              </button>
              {seeLessons}
            </>
          ) : (
            <>
              {next && (
                <button
                  type="button"
                  className="av-go"
                  data-testid="next-lesson"
                  data-focus-stop
                  onClick={() => {
                    onClose();
                    void requestLesson(next.id);
                  }}
                >
                  Next: {next.title}
                </button>
              )}
              {/* No lesson left to offer: the list is there for Basics, or to go over one again. */}
              {!next && seeLessons}
              <button
                type="button"
                className={next ? undefined : 'av-go'}
                data-focus-stop
                onClick={onClose}
              >
                Back to building
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
