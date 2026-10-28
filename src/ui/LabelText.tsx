import { Fragment } from 'react';
import { parseLabel } from '../core/label';

/**
 * Whitespace runs and quoted symbols ('a', '_') are kept as they are; everything else is a word
 * that may carry a label subscript.
 */
const LITERAL = /(\s+|'[^']*')/;

/**
 * Free-form text in which state labels show their subscripts: "Read 'a': {q_0} → {q_{12}}"
 * renders q₀ and q₁₂ as <sub>. Each word goes through `parseLabel`, like the canvas labels.
 */
export function LabelText({
  text,
  className,
}: {
  text: string;
  className?: string;
}): React.JSX.Element {
  const parts = text.split(LITERAL);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 || !part.includes('_') ? (
          <Fragment key={i}>{part}</Fragment>
        ) : (
          <Fragment key={i}>
            {parseLabel(part).map((seg, j) =>
              seg.sub ? <sub key={j}>{seg.text}</sub> : <Fragment key={j}>{seg.text}</Fragment>,
            )}
          </Fragment>
        ),
      )}
    </span>
  );
}
