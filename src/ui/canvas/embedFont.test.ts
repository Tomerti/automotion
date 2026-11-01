import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearFontCache, fontCssUrl, withEmbeddedFont } from './embedFont';

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg"><style>.a { fill: red; }</style>' +
  '<g><text>q<tspan>1</tspan></text><text>a, b</text></g></svg>';
const FONT_URL = 'https://fonts.gstatic.com/l/font?kit=abc';
const CSS = `@font-face { font-family: 'Geist'; src: url(${FONT_URL}) format('woff2'); }`;
const FONT_BYTES = new Uint8Array([1, 2, 3, 250]);

let fetchMock: ReturnType<typeof vi.fn>;

/** fetch answering the Google Fonts CSS and the font file. */
function stubFetch(fail?: 'css' | 'font' | 'network'): void {
  fetchMock = vi.fn(async (url: string) => {
    if (fail === 'network') throw new TypeError('Failed to fetch');
    if (url.startsWith('https://fonts.googleapis.com/')) {
      return new Response(CSS, { status: fail === 'css' ? 400 : 200 });
    }
    if (url === FONT_URL) return new Response(FONT_BYTES, { status: fail === 'font' ? 404 : 200 });
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(clearFontCache);
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('withEmbeddedFont', () => {
  it('asks for Geist 500 cut down to the characters the labels draw', async () => {
    stubFetch();
    await withEmbeddedFont(SVG);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(fontCssUrl(',1abq'));
    expect(fontCssUrl(',1abq')).toBe(
      'https://fonts.googleapis.com/css2?family=Geist:wght@500&text=%2C1abq',
    );
  });

  it('puts the font into the stylesheet as a data URL, keeping the rest', async () => {
    stubFetch();
    const text = await withEmbeddedFont(SVG);
    const face =
      "@font-face { font-family: 'Geist'; font-style: normal; font-weight: 500; " +
      `src: url(data:font/woff2;base64,${btoa(String.fromCharCode(...FONT_BYTES))}) format('woff2'); }`;
    expect(text).toContain(`<style>${face}\n.a { fill: red; }</style>`);
    expect(text).toContain('<text>q<tspan>1</tspan></text>');
    expect(text.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  });

  it('fetches a font once per set of characters', async () => {
    stubFetch();
    await withEmbeddedFont(SVG);
    await withEmbeddedFont(SVG);
    expect(fetchMock).toHaveBeenCalledTimes(2); // the CSS and the font, once
  });

  it.each(['css', 'font', 'network'] as const)(
    'leaves the SVG as it was when the %s fetch fails, and tries again next time',
    async (fail) => {
      stubFetch(fail);
      expect(await withEmbeddedFont(SVG)).toBe(SVG);
      const calls = fetchMock.mock.calls.length;
      await withEmbeddedFont(SVG);
      expect(fetchMock.mock.calls.length).toBeGreaterThan(calls);
    },
  );

  it('fetches nothing for a diagram without labels', async () => {
    stubFetch();
    const empty = '<svg xmlns="http://www.w3.org/2000/svg"><style>.a {}</style><g/></svg>';
    expect(await withEmbeddedFont(empty)).toBe(empty);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
