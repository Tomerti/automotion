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

/** Subscripts are set at this share of the label size, lowered by SUB_SHIFT of the label size. */
export const SUB_SCALE = 0.7;
export const SUB_SHIFT = 0.25;

/**
 * How far each glyph's ink reaches above and below the baseline, in thousandths of an em, as
 * measured in Geist 500 (the diagram's label font). Characters not listed count as capitals.
 */
const INK_GROUPS: [chars: string, above: number, below: number][] = [
  ['aceos', 547, 16],
  ['mn', 547, 0],
  ['u', 531, 16],
  ['rvwxz', 531, 0],
  ['pq', 547, 156],
  ['g', 547, 172],
  ['y', 531, 156],
  ['j', 719, 156],
  ['t', 656, 0],
  ['bdJU', 719, 16],
  ['0356789CGOS', 734, 16],
  ['2', 734, 0],
  ['Q', 734, 78],
  ['{}', 766, 125],
  ['()[]', 750, 109],
  ['∅', 719, 94],
  ["'′", 719, -437],
  [',', 125, 156],
  ['.', 125, 0],
  ['-', 344, -234],
  ['+', 531, -47],
  ['ε', 469, 16],
  ['δ', 703, 16],
];
const CAPITAL_INK: [number, number] = [719, 0];
const INK = new Map<string, [number, number]>(
  INK_GROUPS.flatMap(([chars, above, below]) =>
    Array.from(chars).map((ch): [string, [number, number]] => [ch, [above, below]]),
  ),
);

/**
 * The most of a glyph's ink below the baseline that counts: a round letter's overshoot. A
 * descender (the tail of `y`, `q`, `j`, a comma) hangs below the letters and the eye centres
 * them without it.
 */
const MAX_BODY_BELOW = 16;

/**
 * Where to put a label's alphabetic baseline, in ems below the point it is centred on, so that
 * the body of its main letters is centred there vertically: from the tallest letter's top down
 * to the baseline. Descenders and subscripts hang below, so `q₀` puts its `q` where `a` would
 * be, whatever its subscript (a label that is all subscript is centred on that). Centring the
 * font's em box instead (`dominant-baseline: central`) leaves a `q₀` low: its letters sit low
 * in the box. Centring all the ink leaves `any` high: the `y`'s tail pulls the letters up.
 */
export function labelBaselineOffset(label: string): number {
  const segments = parseLabel(label);
  const main = segments.filter((s) => !s.sub && s.text.trim() !== '');
  let above = -Infinity;
  let below = -Infinity;
  for (const seg of main.length > 0 ? main : segments) {
    const scale = seg.sub ? SUB_SCALE : 1;
    const shift = seg.sub ? SUB_SHIFT : 0;
    for (const ch of seg.text) {
      if (ch.trim() === '') continue;
      const [a, b] = INK.get(ch) ?? CAPITAL_INK;
      above = Math.max(above, (scale * a) / 1000 - shift);
      below = Math.max(below, (scale * Math.min(b, MAX_BODY_BELOW)) / 1000 + shift);
    }
  }
  return above === -Infinity ? 0 : (above - below) / 2;
}
