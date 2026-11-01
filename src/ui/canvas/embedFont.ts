/**
 * An exported picture is drawn from a standalone SVG, which can't use the page's web fonts:
 * without help its labels fall back to the system font (Segoe UI on Windows). This embeds Geist,
 * in the one weight the diagram uses, cut down by Google Fonts to just the characters drawn
 * (usually 2 to 3 KB), as a data URL in the SVG's stylesheet. The page loads Geist from Google
 * Fonts too, so the glyphs match the canvas. Offline, or when the font can't be had in time,
 * the picture keeps the system font, as before.
 */

export const FONT_FAMILY = 'Geist';
export const FONT_WEIGHT = 500;
const FETCH_TIMEOUT_MS = 4000;

/** @font-face rules by the characters they cover; failures are dropped, so they are retried. */
const faces = new Map<string, Promise<string | null>>();

export function fontCssUrl(chars: string): string {
  return (
    `https://fonts.googleapis.com/css2?family=${FONT_FAMILY}:wght@${FONT_WEIGHT}` +
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

async function fetchFace(chars: string): Promise<string | null> {
  try {
    const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const css = await fetch(fontCssUrl(chars), { signal });
    if (!css.ok) return null;
    const src = /url\((https:[^)\s]+)\)\s*format\(['"]?([\w-]+)['"]?\)/.exec(await css.text());
    if (!src?.[1] || !src[2]) return null;
    const font = await fetch(src[1], { signal });
    if (!font.ok) return null;
    const data = toBase64(new Uint8Array(await font.arrayBuffer()));
    const format = src[2];
    return (
      `@font-face { font-family: '${FONT_FAMILY}'; font-style: normal; font-weight: ${FONT_WEIGHT}; ` +
      `src: url(data:font/${format};base64,${data}) format('${format}'); }`
    );
  } catch {
    return null;
  }
}

function fontFace(chars: string): Promise<string | null> {
  let face = faces.get(chars);
  if (!face) {
    face = fetchFace(chars);
    faces.set(chars, face);
    void face.then((f) => {
      if (f === null) faces.delete(chars);
    });
  }
  return face;
}

/** Forget fetched fonts (for tests). */
export function clearFontCache(): void {
  faces.clear();
}

/**
 * Standalone SVG text (from `diagramToSvgString`) with Geist embedded for the characters its
 * labels use; the text unchanged when there are none or the font can't be fetched.
 */
export async function withEmbeddedFont(svgText: string): Promise<string> {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const style = doc.querySelector('style');
  const drawn = Array.from(doc.querySelectorAll('text'), (t) => t.textContent).join('');
  const chars = [...new Set(drawn)]
    .filter((c) => c.trim() !== '')
    .sort()
    .join('');
  if (!style || chars === '') return svgText;
  const face = await fontFace(chars);
  if (face === null) return svgText;
  style.textContent = `${face}\n${style.textContent}`;
  return new XMLSerializer().serializeToString(doc.documentElement);
}
