import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearFontCache, fontCssUrl, withEmbeddedFont } from './embedFont';

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg"><style>.a { fill: red; }</style>' +
  '<g><text>q<tspan>1</tspan></text><text>a, b</text></g></svg>';
/** A state label and an edge label, as the diagram draws them. */
const WITH_EDGE =
  '<svg xmlns="http://www.w3.org/2000/svg"><style>.a { fill: red; }</style>' +
  '<g><text class="av-state-label">q</text><text class="av-edge-label">ε,0</text></g></svg>';
const GEIST_URL = 'https://fonts.gstatic.com/l/font?kit=geist';
const PLEX_URL = 'https://fonts.gstatic.com/l/font?kit=plex';
const GEIST_BYTES = new Uint8Array([1, 2, 3, 250]);
const PLEX_BYTES = new Uint8Array([9, 8, 7]);
const base64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

let fetchMock: ReturnType<typeof vi.fn>;

/**
 * fetch answering the Google Fonts CSS and the font files of Geist and IBM Plex Mono; `fail`
 * breaks one step, for `only` that family when given.
 */
function stubFetch(fail?: 'css' | 'font' | 'network', only?: 'Geist' | 'IBM Plex Mono'): void {
  fetchMock = vi.fn(async (url: string) => {
    const plex = url.includes('IBM+Plex+Mono') || url === PLEX_URL;
    const broken =
      fail !== undefined && (only === undefined || only === (plex ? 'IBM Plex Mono' : 'Geist'));
    if (broken && fail === 'network') throw new TypeError('Failed to fetch');
    if (url.startsWith('https://fonts.googleapis.com/')) {
      const family = plex ? 'IBM Plex Mono' : 'Geist';
      const css = `@font-face { font-family: '${family}'; src: url(${plex ? PLEX_URL : GEIST_URL}) format('woff2'); }`;
      return new Response(css, { status: broken && fail === 'css' ? 400 : 200 });
    }
    if (url === GEIST_URL || url === PLEX_URL) {
      return new Response(plex ? PLEX_BYTES : GEIST_BYTES, {
        status: broken && fail === 'font' ? 404 : 200,
      });
    }
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
}

const requested = (): string[] => fetchMock.mock.calls.map((c) => String(c[0]));

const face = (family: string, bytes: Uint8Array): string =>
  `@font-face { font-family: '${family}'; font-style: normal; font-weight: 500; ` +
  `src: url(data:font/woff2;base64,${base64(bytes)}) format('woff2'); }`;

beforeEach(clearFontCache);
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fontCssUrl', () => {
  it('asks Google Fonts for a family in weight 500, cut down to some characters', () => {
    expect(fontCssUrl('Geist', ',1abq')).toBe(
      'https://fonts.googleapis.com/css2?family=Geist:wght@500&text=%2C1abq',
    );
    expect(fontCssUrl('IBM Plex Mono', ',01')).toBe(
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&text=%2C01',
    );
  });
});

describe('withEmbeddedFont', () => {
  it('asks for Geist cut down to the characters the labels draw, and nothing else without edge labels', async () => {
    stubFetch();
    await withEmbeddedFont(SVG);
    expect(requested()).toEqual([fontCssUrl('Geist', ',1abq'), GEIST_URL]);
  });

  it('asks for IBM Plex Mono cut down to the characters the edge labels draw', async () => {
    stubFetch();
    await withEmbeddedFont(WITH_EDGE);
    expect(requested()).toContain(fontCssUrl('IBM Plex Mono', ',0ε'));
  });

  it('asks Geist for the edge labels’ characters too: Plex Mono has no ε, which falls back to it', async () => {
    stubFetch();
    await withEmbeddedFont(WITH_EDGE);
    expect(requested()).toContain(fontCssUrl('Geist', ',0qε'));
  });

  it('puts the font into the stylesheet as a data URL, keeping the rest', async () => {
    stubFetch();
    const text = await withEmbeddedFont(SVG);
    expect(text).toContain(`<style>${face('Geist', GEIST_BYTES)}\n.a { fill: red; }</style>`);
    expect(text).toContain('<text>q<tspan>1</tspan></text>');
    expect(text.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  });

  it('embeds both fonts when there are edge labels, Geist first', async () => {
    stubFetch();
    const text = await withEmbeddedFont(WITH_EDGE);
    expect(text).toContain(
      `<style>${face('Geist', GEIST_BYTES)}\n${face('IBM Plex Mono', PLEX_BYTES)}\n.a { fill: red; }</style>`,
    );
  });

  it('keeps the font it could fetch when the other one fails', async () => {
    stubFetch('css', 'IBM Plex Mono');
    const text = await withEmbeddedFont(WITH_EDGE);
    expect(text).toContain(`<style>${face('Geist', GEIST_BYTES)}\n.a { fill: red; }</style>`);
  });

  it('fetches a font once per set of characters', async () => {
    stubFetch();
    await withEmbeddedFont(WITH_EDGE);
    await withEmbeddedFont(WITH_EDGE);
    expect(fetchMock).toHaveBeenCalledTimes(4); // each font's CSS and file, once
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
