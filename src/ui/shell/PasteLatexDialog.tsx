import { useEffect, useId, useRef, useState } from 'react';
import { CloseIcon } from './icons';
import { importLatexFromDialog } from './importFile';
import { useModalDialog } from './useModalDialog';

const PLACEHOLDER = String.raw`% For example:
\begin{tikzpicture}[auto, node distance=2cm]
  \node[state, initial] (q0) {$q_0$};
  \node[state, accepting, right=of q0] (q1) {$q_1$};
  \path[->] (q0) edge node {a} (q1);
\end{tikzpicture}`;

/**
 * Import → Paste LaTeX…: a box to paste TikZ into (from Overleaf, lecture notes, …). Each
 * `tikzpicture` becomes an automaton, as with a `.tex` file; an error stays in the dialog.
 * It also says that Ctrl+V on the canvas does the same, so the shortcut is learned here.
 */
export function PasteLatexDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  useModalDialog(dialogRef, onClose);
  // After the dialog's own focus (effects run in order): the box is what to use first.
  useEffect(() => textRef.current?.focus(), []);

  const submit = (): void => {
    const problem = importLatexFromDialog(text);
    if (problem === null) onClose();
    else {
      setError(problem);
      textRef.current?.focus();
    }
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
        className="av-modal av-paste-latex"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
      >
        <header className="av-modal-head">
          <h2 id={`${id}-title`}>Paste LaTeX</h2>
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="av-paste-latex-label" htmlFor={`${id}-text`}>
            Paste a TikZ picture: each <code>tikzpicture</code> becomes an automaton, with its
            states, arrows, start and accepting states.
          </label>
          <textarea
            ref={textRef}
            id={`${id}-text`}
            className="av-paste-latex-text"
            data-focus-stop
            spellCheck={false}
            placeholder={PLACEHOLDER}
            value={text}
            aria-invalid={error !== null}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submit();
              }
            }}
          />
          {error && (
            <p id={`${id}-error`} className="av-paste-latex-error" role="alert">
              {error}
            </p>
          )}
          <div className="av-paste-latex-foot">
            <p className="av-paste-latex-tip">
              Tip: copy a <code>tikzpicture</code> anywhere, then press <kbd>Ctrl</kbd>+<kbd>V</kbd>{' '}
              on the canvas to skip this box.
            </p>
            <button type="submit" className="av-primary" data-focus-stop>
              Add automata
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
