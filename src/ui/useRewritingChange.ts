import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * `onChange` for a controlled text input whose text is rewritten as it is typed (`\eps` → ε),
 * given the caret. A rewrite that shortens the text before the caret would leave React's new
 * value with the caret at the end; this puts it back after the rewritten text before it.
 */
export function useRewritingChange(
  inputRef: RefObject<HTMLInputElement | null>,
  value: string,
  setValue: (text: string) => void,
  rewrite: (text: string, caret: number) => string,
): (e: React.ChangeEvent<HTMLInputElement>) => void {
  /** Caret to restore once the rewritten value is in the input. */
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (caret.current === null) return;
    inputRef.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [inputRef, value]);

  return (e) => {
    const raw = e.target.value;
    const pos = e.target.selectionStart ?? raw.length;
    const next = rewrite(raw, pos);
    if (next !== raw) caret.current = rewrite(raw.slice(0, pos), pos).length;
    setValue(next);
  };
}
