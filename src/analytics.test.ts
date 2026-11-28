import { afterEach, describe, expect, it, vi } from 'vitest';
import { startAnalytics, track } from './analytics';

const SRC = 'https://gc.zgo.at/count.js';
const ENDPOINT = 'https://tomerti.goatcounter.com/count';

const scripts = (doc: Document): HTMLScriptElement[] =>
  [...doc.querySelectorAll('script')].filter((s) => s.src === SRC);

describe('startAnalytics', () => {
  it('loads GoatCounter once on the live site', () => {
    const doc = document.implementation.createHTMLDocument();
    startAnalytics('tomerti.github.io', doc);
    startAnalytics('tomerti.github.io', doc);
    const found = scripts(doc);
    expect(found).toHaveLength(1);
    expect(found[0]?.async).toBe(true);
    expect(found[0]?.dataset.goatcounter).toBe(ENDPOINT);
  });

  it('loads nothing anywhere else', () => {
    for (const host of ['localhost', '127.0.0.1', 'someone.github.io']) {
      const doc = document.implementation.createHTMLDocument();
      startAnalytics(host, doc);
      expect(doc.querySelectorAll('script')).toHaveLength(0);
    }
  });
});

describe('track', () => {
  afterEach(() => {
    delete window.goatcounter;
  });

  it('sends a named event', () => {
    const count = vi.fn();
    window.goatcounter = { count };
    track('run');
    expect(count).toHaveBeenCalledExactlyOnceWith({
      path: 'run',
      title: 'run',
      event: true,
    });
  });

  it('does nothing without GoatCounter', () => {
    expect(() => track('run')).not.toThrow();
  });

  it('never throws when GoatCounter does', () => {
    window.goatcounter = {
      count: () => {
        throw new Error('blocked');
      },
    };
    expect(() => track('run')).not.toThrow();
  });
});
