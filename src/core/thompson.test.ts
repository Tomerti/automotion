import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EPSILON } from './model';
import { printRegex } from './regex';
import type { Regex } from './regex';
import { arbRegex } from './testing/arbitraries';
import { accepts, regexToJs, wordsUpTo } from './testing/language';
import { canThompson, thompson } from './thompson';
import { validate } from './validate';

/**
 * Only regexes within MAX_THOMPSON_STATES: `thompson` throws on the rest. About 1 in 1000 of
 * `arbRegex()` is over the cap, so the filter costs nothing and a 100-run property never skips out.
 */
const buildable = (arb: fc.Arbitrary<Regex>): fc.Arbitrary<Regex> =>
  arb.filter((r) => canThompson(printRegex(r)) === null);

describe('thompson', () => {
  it('(a|b)*abb: 10 build steps, 14 states', () => {
    const t = thompson('(a|b)*abb');
    expect(t.steps.filter((s) => s.phase === 'build')).toHaveLength(10);
    expect(t.result.states).toHaveLength(14);
    expect(t.steps[0]?.phase).toBe('intro');
    expect(t.steps.at(-1)?.phase).toBe('done');
  });
  it('a|b|c is one fan: 8 states, 4 build steps', () => {
    const t = thompson('a|b|c');
    expect(t.result.states).toHaveLength(8);
    expect(t.steps.filter((s) => s.phase === 'build')).toHaveLength(4);
  });
  it('ab joins with an ε-arrow: 4 states', () => {
    const t = thompson('ab');
    expect(t.result.states).toHaveLength(4);
    expect(t.result.transitions.filter((x) => x.symbols.includes(EPSILON))).toHaveLength(1);
  });
  it('r+ has no skip arrow, r* has one', () => {
    const plus = thompson('a+').result;
    const star = thompson('a*').result;
    expect(star.transitions).toHaveLength(plus.transitions.length + 1);
  });
  it('states are numbered in creation order and steps build inner pieces first', () => {
    const t = thompson('a|b');
    expect(t.result.states.map((s) => s.label)).toEqual(['q_0', 'q_1', 'q_2', 'q_3', 'q_4', 'q_5']);
    const builds = t.steps.filter((s) => s.phase === 'build');
    expect(builds.map((s) => s.span)).toEqual([
      { start: 0, end: 1 },
      { start: 2, end: 3 },
      { start: 0, end: 3 },
    ]);
  });
  it('every piece has one start and one accept; never two arrows for one (from, to) pair', () => {
    fc.assert(
      fc.property(buildable(arbRegex()), (r) => {
        const t = thompson(printRegex(r));
        const pairs = t.result.transitions.map((x) => `${x.from}>${x.to}`);
        expect(new Set(pairs).size).toBe(pairs.length);
        for (const s of t.steps.filter((x) => x.phase === 'build')) {
          expect(s.pieceStates).toContain(s.pieceStart);
          expect(s.pieceStates).toContain(s.pieceAccept);
        }
      }),
    );
  });
  it('accepts exactly the regex language (words up to length 6)', () => {
    fc.assert(
      fc.property(buildable(arbRegex('ab', 3)), (r) => {
        const nfa = thompson(printRegex(r)).result;
        const js = regexToJs(r);
        for (const w of wordsUpTo(['a', 'b'], 6)) expect(accepts(nfa, w)).toBe(js.test(w));
      }),
      { numRuns: 60 },
    );
  });
  it('degenerate regexes build valid NFAs', () => {
    for (const s of ['ε', '∅', 'ε*', '∅*', '\\eps+']) {
      const t = thompson(s);
      expect(validate(t.result).filter((i) => i.severity === 'error')).toEqual([]);
    }
    expect(accepts(thompson('∅').result, '')).toBe(false);
    expect(accepts(thompson('∅*').result, '')).toBe(true);
  });
  it('refuses past 64 states and invalid text', () => {
    expect(canThompson('a'.repeat(33))).toBe(
      'Too long to draw: this regex needs 66 states (at most 64)',
    );
    expect(canThompson('a|')).toBe('Nothing after |');
    expect(canThompson('a'.repeat(32))).toBeNull();
  });
});
