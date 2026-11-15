/**
 * An exported picture is drawn from a standalone SVG, which can't use the page's web fonts:
 * without help its labels fall back to the system font (Segoe UI on Windows). This embeds the
 * diagram's fonts, in the one weight it uses, cut down by Google Fonts to just the characters
 * drawn (usually 2 to 3 KB each), as data URLs in the SVG's stylesheet: Geist for every label,
 * and IBM Plex Mono for the edge labels' symbols (its dotted 0 neither reads as O nor as ∅).
 * Geist gets the edge labels' characters too: Plex Mono has no ε, which falls back to Geist.
 * The page loads both from Google Fonts too, so the glyphs match the canvas. Offline, or when a
 * font can't be had in time, the picture keeps the system font for it, as before.
 */

export const LABEL_FONT = 'Geist';
export const SYMBOL_FONT = 'IBM Plex Mono';
export const FONT_WEIGHT = 500;
const FETCH_TIMEOUT_MS = 4000;
/** The diagram's edge labels, drawn in SYMBOL_FONT (diagramStyles.ts). */
const SYMBOL_TEXT = '.av-edge-label';

/** @font-face rules by family and characters; failures are dropped, so they are retried. */
const faces = new Map<string, Promise<string | null>>();

export function fontCssUrl(family: string, chars: string): string {
  return (
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${FONT_WEIGHT}` +
    `&text=${encodeURIComponent(chars)}`
  );
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function fetchFace(family: string, chars: string): Promise<string | null> {
  try {
    const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const css = await fetch(fontCssUrl(family, chars), { signal });
    if (!css.ok) return null;
    const src = /url\((https:[^)\s]+)\)\s*format\(['"]?([\w-]+)['"]?\)/.exec(await css.text());
    if (!src?.[1] || !src[2]) return null;
    const font = await fetch(src[1], { signal });
    if (!font.ok) return null;
    const data = toBase64(new Uint8Array(await font.arrayBuffer()));
    const format = src[2];
    return (
      `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${FONT_WEIGHT}; ` +
      `src: url(data:font/${format};base64,${data}) format('${format}'); }`
    );
  } catch {
    return null;
  }
}

function fontFace(family: string, chars: string): Promise<string | null> {
  const key = `${family}\n${chars}`;
  let face = faces.get(key);
  if (!face) {
    face = fetchFace(family, chars);
    faces.set(key, face);
    void face.then((f) => {
      if (f === null) faces.delete(key);
    });
  }
  return face;
}

/** Forget fetched fonts (for tests). */
export function clearFontCache(): void {
  faces.clear();
}

/** The distinct visible characters of some elements' text, sorted. */
function charsOf(elements: Iterable<Element>): string {
  const drawn = Array.from(elements, (t) => t.textContent).join('');
  return [...new Set(drawn)]
    .filter((c) => c.trim() !== '')
    .sort()
    .join('');
}

/**
 * Standalone SVG text (from `diagramToSvgString`) with its fonts embedded for the characters its
 * labels use; the text unchanged when there are none or no font can be fetched.
 */
export async function withEmbeddedFont(svgText: string): Promise<string> {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const style = doc.querySelector('style');
  const chars = charsOf(doc.querySelectorAll('text'));
  if (!style || chars === '') return svgText;
  const symbols = charsOf(doc.querySelectorAll(SYMBOL_TEXT));
  const found = await Promise.all([
    fontFace(LABEL_FONT, chars),
    symbols === '' ? null : fontFace(SYMBOL_FONT, symbols),
  ]);
  const embedded = found.filter((f): f is string => f !== null);
  if (embedded.length === 0) return svgText;
  style.textContent = `${embedded.join('\n')}\n${style.textContent}`;
  return new XMLSerializer().serializeToString(doc.documentElement);
}
