import { useLayoutEffect, useRef, useState } from 'react';
import type { Point } from '../../core/geometry';
import { useRewritingChange } from '../useRewritingChange';

export interface InlineInputProps {
  testId: string;
  label: string;
  initial: string;
  /** Canvas-relative screen position the input is centered on. */
  at: Point;
  /** On-screen font size (px), so the text matches the label it replaces. */
  fontSize: number;
  /** Set in the symbol font, like the edge label it replaces (else like a state's name). */
  symbols?: boolean;
  /** Open with the whole text selected, to type a new one (a state's name), not the caret after it. */
  selectAll?: boolean;
  /**
   * Where the drawn label puts its alphabetic baseline for a text, in ems below `at`: the input's
   * text is set on that baseline, so it doesn't jump when the input opens or closes. Without it
   * the input is centred on `at`, which matches a label drawn with `dominant-baseline: central`.
   */
  baseline?(text: string): number;
  /** Live rewrite of the text as it is typed (e.g. `\eps` → ε). */
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
  const {
    testId,
    label,
    initial,
    at,
    fontSize,
    symbols,
    selectAll,
    baseline,
    normalize,
    onSubmit,
    onCancel,
    onBlur,
  } = props;
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  /** How far (px) the box moves down from centred on `at`, to put its text on `baseline`. */
  const [shift, setShift] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const baselineRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rewrite = useRewritingChange(inputRef, value, setValue, normalize ?? ((text) => text));
  /** Set once Enter or Escape closed the input, so a blur on unmount does nothing. */
  const closed = useRef(false);

  // Open with the caret after the text, to type more of it (an arrow's next symbol), or with
  // all of it selected, to replace it.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    if (selectAll) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
    // Only on opening: later renders keep the caret where typing put it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The box centres its line, which puts the text's baseline wherever the font's ascent and
  // descent say; the drawn label puts it to centre its letters (`labelBaselineOffset`). Measure
  // where the baseline sits now (the transform moves both rects alike) and move it there.
  // The drawn label's baseline lands on the nearest device pixel row; HTML text a fraction off
  // it can round to the next row (the text dropped 1 px on opening at some zooms), so the
  // input's baseline goes on that row exactly.
  const applied = useRef(0);
  useLayoutEffect(() => {
    const box = boxRef.current?.getBoundingClientRect();
    const mark = baselineRef.current?.getBoundingClientRect();
    if (!baseline || !box || !mark) return;
    const centred = mark.top - box.top - box.height / 2;
    const middle = box.top + box.height / 2 - applied.current;
    const dpr = window.devicePixelRatio || 1;
    const row = Math.round((middle + fontSize * baseline(value)) * dpr) / dpr;
    applied.current = row - middle - centred;
    setShift(applied.current);
  }, [baseline, value, fontSize]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    rewrite(e);
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
      ref={boxRef}
      className={symbols ? 'av-inline av-inline-symbols' : 'av-inline'}
      data-invalid={error !== null}
      style={{
        left: at.x,
        top: at.y,
        fontSize,
        ...(baseline && { transform: `translate(-50%, calc(-50% + ${shift}px))` }),
      }}
    >
      {/* The hidden copy of the text sizes the input to its content; its mark is on the baseline. */}
      <span className="av-inline-sizer" aria-hidden="true">
        {value === '' ? ' ' : value}
        <span ref={baselineRef} className="av-inline-baseline" />
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
