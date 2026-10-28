import { useLayoutEffect, useRef, useState } from 'react';
import type { Point } from './geometry';

export interface InlineInputProps {
  testId: string;
  label: string;
  initial: string;
  /** Canvas-relative screen position the input is centered on. */
  at: Point;
  /** On-screen font size (px), so the text matches the label it replaces. */
  fontSize: number;
  /** Live rewrite of the text as it is typed (e.g. `\epsilon` → ε). */
  normalize?(text: string): string;
  /** Enter pressed. Returns an error to show (the input stays open) or null when done. */
  onSubmit(text: string): string | null;
  /** Escape pressed. */
  onCancel(): void;
  /** Focus left the input: it commits what was typed and closes either way. */
  onBlur(text: string): void;
}

/**
 * Borderless text input set in place of a diagram label: same font and size, as wide as its
 * text. Enter or blur commits, Escape cancels.
 */
export function InlineInput(props: InlineInputProps): React.JSX.Element {
  const { testId, label, initial, at, fontSize, normalize, onSubmit, onCancel, onBlur } = props;
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Caret to restore after a normalization shortened the text before it. */
  const caret = useRef<number | null>(null);
  /** Set once Enter or Escape closed the input, so a blur on unmount does nothing. */
  const closed = useRef(false);

  useLayoutEffect(() => {
    if (caret.current === null) return;
    inputRef.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [value]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const raw = e.target.value;
    const next = normalize ? normalize(raw) : raw;
    if (next !== raw) {
      const pos = e.target.selectionStart ?? raw.length;
      caret.current = (normalize ? normalize(raw.slice(0, pos)) : raw.slice(0, pos)).length;
    }
    setValue(next);
    setError(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Closing hands focus back to the canvas, which blurs the input before it unmounts.
      closed.current = true;
      const result = onSubmit(value);
      if (result !== null) {
        closed.current = false;
        setError(result);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closed.current = true;
      onCancel();
    }
  };

  return (
    <div
      className="av-inline"
      data-invalid={error !== null}
      style={{ left: at.x, top: at.y, fontSize }}
    >
      {/* The hidden copy of the text sizes the input to its content. */}
      <span className="av-inline-sizer" aria-hidden="true">
        {value === '' ? ' ' : value}
      </span>
      <input
        ref={inputRef}
        data-testid={testId}
        aria-label={label}
        aria-invalid={error !== null}
        autoFocus
        spellCheck={false}
        autoComplete="off"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (!closed.current) onBlur(value);
        }}
      />
      {error !== null && <div role="alert">{error}</div>}
    </div>
  );
}
