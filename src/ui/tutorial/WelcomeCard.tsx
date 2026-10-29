import { useRef } from 'react';
import { CloseIcon } from '../shell/icons';
import { useModalDialog } from '../shell/useModalDialog';
import './tutorial.css';

/** What the tutorial covers, one row each, like the Controls popup's rows. */
const PLAN: { what: string; how: string }[] = [
  { what: 'Build', how: 'a DFA for words with an even number of 0s' },
  { what: 'Run', how: 'words on it and watch every step' },
  { what: 'Change', how: 'it to accept every word' },
];

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
        <p className="av-welcome-tagline">Watch automata come to life.</p>
        <p className="av-welcome-text">A two-minute tutorial:</p>
        <ol className="av-welcome-plan">
          {PLAN.map((p, i) => (
            <li key={p.what} className="av-welcome-row">
              <span className="av-welcome-num" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <b>{p.what}</b> {p.how}
              </span>
            </li>
          ))}
        </ol>
        <div className="av-welcome-actions">
          <button type="button" data-focus-stop onClick={onClose}>
            Not now
          </button>
          <button type="button" className="av-go" data-focus-stop onClick={onStart}>
            Start tutorial
          </button>
        </div>
        <p className="av-welcome-note">Press ? at any time for all the controls.</p>
      </div>
    </div>
  );
}
