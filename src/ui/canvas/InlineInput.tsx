import { useState } from 'react';
import type { Point } from './geometry';

export interface InlineInputProps {
  testId: string;
  label: string;
  initial: string;
  /** Canvas-relative screen position the input is centered on. */
  at: Point;
  /** Returns an error to show (the input stays open) or null when done. */
  onSubmit(text: string): string | null;
  onCancel(): void;
}

/** Small text input floating over the canvas: Enter submits, Escape or blur cancels. */
export function InlineInput(props: InlineInputProps): React.JSX.Element {
  const { testId, label, initial, at, onSubmit, onCancel } = props;
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const result = onSubmit(value);
      if (result !== null) setError(result);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="av-inline" style={{ left: at.x, top: at.y }}>
      <input
        data-testid={testId}
        aria-label={label}
        aria-invalid={error !== null}
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={onKeyDown}
        onBlur={onCancel}
      />
      {error !== null && <div role="alert">{error}</div>}
    </div>
  );
}
