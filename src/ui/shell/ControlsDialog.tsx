import { useEffect, useRef } from 'react';
import { CloseIcon } from './icons';

/** `[Shift]` in a row's text is a key, rendered as <kbd>. */
interface Row {
  how: string;
  what: string;
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'Build',
    rows: [
      { how: 'Double-click empty canvas', what: 'Add a state' },
      { how: 'Double-click a state', what: 'Rename it' },
      { how: 'Double-click an edge', what: 'Edit its symbols' },
      {
        how: '[Shift] + drag from a state to another, or to itself',
        what: 'Add a transition, then type its symbols',
      },
      { how: 'Right-click a state or edge', what: 'More actions' },
    ],
  },
  {
    title: 'Arrange',
    rows: [
      {
        how: 'Drag a state',
        what: 'Move it; it snaps into line with other states ([Alt] to skip)',
      },
      { how: 'Drag an edge', what: 'Bend it; a self-loop rotates' },
      { how: 'Drag the background', what: 'Pan' },
      { how: 'Scroll', what: 'Zoom' },
      { how: 'Click the background', what: 'Clear the selection' },
    ],
  },
  {
    title: 'Keys',
    rows: [
      { how: '[Enter] on the selected state', what: 'Toggle accepting (or [A])' },
      { how: '[Space] on the selected state', what: 'Toggle start (or [S])' },
      { how: '[Delete] or [Backspace]', what: 'Delete the selection' },
      { how: '[Ctrl] + [Z]', what: 'Undo' },
      { how: '[Ctrl] + [Y]', what: 'Redo' },
      { how: '[?]', what: 'Show these controls' },
    ],
  },
];

function Keyed({ text }: { text: string }): React.JSX.Element {
  return (
    <>
      {text
        .split(/\[([^\]]+)\]/)
        .map((part, i) => (i % 2 === 1 ? <kbd key={i}>{part}</kbd> : part))}
    </>
  );
}

/** Modal listing the canvas gestures. Escape, the backdrop or the close button dismiss it. */
export function ControlsDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const latestClose = useRef(onClose);
  useEffect(() => {
    latestClose.current = onClose;
  });

  useEffect(() => {
    const before = document.activeElement;
    // The dialog itself takes focus (no ring on the close button when it opens by itself).
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        // Keep Escape from also closing a trace or a menu underneath.
        e.stopPropagation();
        latestClose.current();
      } else if (e.key === 'Tab') {
        // The close button is the only stop; keep focus inside the dialog.
        e.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (before instanceof HTMLElement) before.focus();
    };
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
        className="av-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Controls"
        tabIndex={-1}
      >
        <header className="av-modal-head">
          <h2>Controls</h2>
          <button
            ref={closeRef}
            type="button"
            className="av-icon-button"
            aria-label="Close controls"
            title="Close (Esc)"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>
        <div className="av-controls">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3>{g.title}</h3>
              <dl>
                {g.rows.map((r) => (
                  <div key={r.how} className="av-controls-row">
                    <dt>
                      <Keyed text={r.how} />
                    </dt>
                    <dd>
                      <Keyed text={r.what} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
