import { useRef } from 'react';
import { CloseIcon } from '../shell/icons';
import { useModalDialog } from '../shell/useModalDialog';
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
  useModalDialog(dialogRef, onClose);

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
            data-focus-stop
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>
        <p className="av-welcome-text">
          Learn the basics by building a small automaton, about two minutes.
        </p>
        <div className="av-welcome-actions">
          <button type="button" data-focus-stop onClick={onClose}>
            Not now
          </button>
          <button type="button" className="av-primary" data-focus-stop onClick={onStart}>
            Start tutorial
          </button>
        </div>
        <p className="av-welcome-note">Press ? at any time for all the controls.</p>
      </div>
    </div>
  );
}
