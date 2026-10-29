import { useEffect, useRef } from 'react';
import { CloseIcon } from '../shell/icons';
import './tutorial.css';

/**
 * The first visit's welcome: an offer of the tutorial. Escape, the backdrop, the close button and
 * Not now dismiss it.
 */
export function WelcomeCard({
  onStart,
  onClose,
}: {
  onStart: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  const latestClose = useRef(onClose);
  useEffect(() => {
    latestClose.current = onClose;
  });

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      // Keep Escape from also reaching the canvas underneath.
      e.stopPropagation();
      latestClose.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

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
        className="av-modal av-welcome"
        role="dialog"
        aria-modal="true"
        aria-label="Welcome"
        tabIndex={-1}
      >
        <header className="av-modal-head">
          <h2>Welcome to AutoMotion</h2>
          <button
            type="button"
            className="av-icon-button"
            aria-label="Close"
            title="Close (Esc)"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>
        <p className="av-welcome-text">
          Learn the basics by building a small automaton, about two minutes.
        </p>
        <div className="av-welcome-actions">
          <button type="button" onClick={onClose}>
            Not now
          </button>
          <button type="button" className="av-primary" onClick={onStart}>
            Start tutorial
          </button>
        </div>
        <p className="av-welcome-note">Press ? at any time for all the controls.</p>
      </div>
    </div>
  );
}
