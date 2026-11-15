import { useRef, useState } from 'react';
import { CloseIcon } from '../shell/icons';
import { useModalDialog } from '../shell/useModalDialog';
import { CHEERS } from './cheers';
import type { Lesson } from './engine';
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
}: {
  lesson: Lesson;
  onClose: () => void;
}): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalDialog(dialogRef, onClose);
  const [cheer] = useState(() => CHEERS[Math.floor(Math.random() * CHEERS.length)]!);
  const tutorial = lesson.noun === 'tutorial';
  const title = tutorial ? 'Tutorial complete' : 'Lesson complete';

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
        <p className="av-welcome-note av-finished-note">
          {tutorial
            ? 'Your Tutorial automaton stays in the history.'
            : 'Its automata stay in your history.'}
        </p>
        <div className="av-welcome-actions">
          <button type="button" className="av-go" data-focus-stop onClick={onClose}>
            Back to building
          </button>
        </div>
      </div>
    </div>
  );
}
