/** One run of a state label: plain text, or a subscript written as `_x` or `_{xyz}`. */
export interface LabelSegment {
  text: string;
  sub: boolean;
}

/**
 * Split a label into display segments: `q_1` is q with subscript 1, `q_{12}` is q with
 * subscript 12. An underscore with nothing usable after it stays literal.
 */
export function parseLabel(label: string): LabelSegment[] {
  const out: LabelSegment[] = [];
  const push = (text: string, sub: boolean): void => {
    if (text === '') return;
    const last = out[out.length - 1];
    if (last && last.sub === sub) last.text += text;
    else out.push({ text, sub });
  };
  const chars = Array.from(label);
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i] as string;
    if (ch === '_' && i + 1 < chars.length) {
      if (chars[i + 1] === '{') {
        const close = chars.indexOf('}', i + 2);
        if (close > i + 2) {
          push(chars.slice(i + 2, close).join(''), true);
          i = close + 1;
          continue;
        }
      } else {
        push(chars[i + 1] as string, true);
        i += 2;
        continue;
      }
    }
    push(ch, false);
    i++;
  }
  return out;
}

/** The label as it reads once rendered (`q_{12}` → `q12`), e.g. for sizing text. */
export function labelDisplayText(label: string): string {
  return parseLabel(label)
    .map((s) => s.text)
    .join('');
}
