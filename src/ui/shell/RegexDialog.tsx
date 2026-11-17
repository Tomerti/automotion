import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { normalizeRegexText, parseRegex } from '../../core/regex';
import { canBuildFromRegex } from '../../core/regexToDfa';
import { createFromRegex } from '../../store/regexActions';
import { CloseIcon } from './icons';
import { closeRegexDialog, useRegexDialog } from './regexDialogStore';
import { toast } from './toastStore';
import { useModalDialog } from './useModalDialog';

/** The open regex dialog, if any (rendered once, in `App`). */
export function RegexDialog(): React.JSX.Element | null {
  const open = useRegexDialog((s) => s.open);
  return open ? <RegexModal /> : null;
}

/**
 * Create → From regex…: a box for a regular expression. Create DFA adds the regex's
 * minimal DFA as a new automaton; a syntax error is shown under the offending character.
 */
function RegexModal(): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const id = useId();
  useModalDialog(dialogRef, closeRegexDialog);
  // After the dialog's own focus (effects run in order): the box is what to use first.
  useEffect(() => inputRef.current?.focus(), []);

  const refusal = useMemo(() => canBuildFromRegex(text), [text]);
  const parsed = text === '' ? null : parseRegex(text);
  const error = parsed && !parsed.ok ? parsed : null;
  // Parses but can't be built (too long, too many states): said under the box too, not only as a tooltip.
  const tooLong = parsed?.ok && refusal !== null ? refusal : null;

  const submit = (): void => {
    if (refusal !== null) return;
    closeRegexDialog();
    void createFromRegex(text, (m) => toast(m, 'error'));
  };

  return (
    <div
      className="av-modal-backdrop"
      data-testid="modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) closeRegexDialog();
      }}
    >
      <div
        ref={dialogRef}
        className="av-modal av-regex"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
      >
        <header className="av-modal-head">
          <h2 id={`${id}-title`}>Create a DFA from a regex</h2>
          <button
            type="button"
            className="av-icon-button"
            aria-label="Close"
            title="Close (Esc)"
            data-focus-stop
            onClick={closeRegexDialog}
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
          <input
            ref={inputRef}
            className="av-regex-input"
            data-testid="regex-input"
            aria-label="Regex"
            aria-invalid={error !== null || tooLong !== null}
            aria-describedby={error || tooLong ? `${id}-error` : `${id}-syntax`}
            data-focus-stop
            spellCheck={false}
            autoComplete="off"
            placeholder="(a|b)*abb"
            value={text}
            onChange={(e) => setText(normalizeRegexText(e.target.value))}
            onScroll={(e) => {
              if (caretRef.current) caretRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }}
          />
          {error && (
            <div
              id={`${id}-error`}
              className="av-regex-error"
              data-testid="regex-error"
              role="alert"
            >
              <div
                ref={caretRef}
                className="av-regex-caret"
                data-testid="regex-caret"
                aria-hidden="true"
              >
                {/* The text before the error, invisible: same glyphs and widths as the box. */}
                <span data-testid="regex-caret-pad">{text.slice(0, error.at)}</span>
                <span data-testid="regex-caret-mark">^</span>
              </div>
              <p>{error.error}</p>
            </div>
          )}
          {tooLong && (
            <div
              id={`${id}-error`}
              className="av-regex-error"
              data-testid="regex-error"
              role="alert"
            >
              <p>{tooLong}</p>
            </div>
          )}
          {/* Each operator in a chip, commas between: a · could be read as concatenation. */}
          <p id={`${id}-syntax`} className="av-regex-syntax">
            <code>|</code> or, <code>+</code> one or more, <code>*</code> any number, ε as{' '}
            <code>{String.raw`\eps`}</code>, ∅ as <code>{String.raw`\emptyset`}</code>
          </p>
          <div className="av-regex-foot">
            <button
              type="submit"
              className="av-primary"
              data-testid="regex-build"
              data-focus-stop
              disabled={refusal !== null}
              title={refusal ?? undefined}
            >
              Create DFA
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
