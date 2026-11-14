import { useRef } from 'react';
import { CloseIcon } from '../shell/icons';
import { ThemeSwitch } from '../shell/ThemeSwitch';
import { useModalDialog } from '../shell/useModalDialog';
import { WelcomeDemo } from './WelcomeDemo';
import './tutorial.css';

/** What the tutorial covers, one row each, like the Controls popup's rows. */
const PLAN: { what: string; how: string }[] = [
  { what: 'Build', how: 'a DFA that accepts the words with an even number of zeros' },
  { what: 'Run', how: 'words on it and watch it read them, one symbol at a time' },
  { what: 'Change', how: 'it to accept every word' },
  { what: 'Convert', how: 'an NFA to a DFA and shrink it' },
];

/**
 * The first visit's welcome: an offer of the tutorial, centred over the canvas (in line with the
 * run pill, covering the empty canvas's hint). Escape, the backdrop, the close button and Not now
 * dismiss it. Under the demo, a switch picks the theme (the top bar's theme menu does the same),
 * restyling the demo as you choose.
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
      className="av-modal-backdrop av-welcome-backdrop"
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
        <WelcomeDemo />
        <div className="av-welcome-theme">
          <span className="av-welcome-text">Theme</span>
          <ThemeSwitch />
        </div>
        <p className="av-welcome-text">A short tutorial:</p>
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
