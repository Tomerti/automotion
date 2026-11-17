import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EPSILON } from './model';
import { parseRegex } from './regex';
import type { Regex } from './regex';
import { arbRegex } from './testing/arbitraries';
import { accepts, regexToJs, wordsUpTo } from './testing/language';
import { thompsonNfa } from './thompson';
import { validate } from './validate';

const build = (text: string) => {
  const parsed = parseRegex(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return thompsonNfa(parsed.regex);
};

describe('thompsonNfa', () => {
  it('(a|b)*abb has 14 states', () => {
    expect(build('(a|b)*abb').states).toHaveLength(14);
  });
  it('a|b|c is one fan: 8 states', () => {
    expect(build('a|b|c').states).toHaveLength(8);
  });
  it('ab joins with an ε-arrow: 4 states', () => {
    const nfa = build('ab');
    expect(nfa.states).toHaveLength(4);
    expect(nfa.transitions.filter((x) => x.symbols.includes(EPSILON))).toHaveLength(1);
  });
  it('r+ has no skip arrow, r* has one', () => {
    expect(build('a*').transitions).toHaveLength(build('a+').transitions.length + 1);
  });
  it('states are numbered in creation order', () => {
    expect(build('a|b').states.map((s) => s.label)).toEqual([
      'q_0',
      'q_1',
      'q_2',
      'q_3',
      'q_4',
      'q_5',
    ]);
  });
  it('one start, one accepting state; never two arrows for one (from, to) pair', () => {
    fc.assert(
      fc.property(arbRegex(), (r: Regex) => {
        const nfa = thompsonNfa(r);
        expect(nfa.starts).toHaveLength(1);
        expect(nfa.accepting).toHaveLength(1);
        const pairs = nfa.transitions.map((x) => `${x.from}>${x.to}`);
        expect(new Set(pairs).size).toBe(pairs.length);
      }),
    );
  });
  it('accepts exactly the regex language (words up to length 6)', () => {
    fc.assert(
      fc.property(arbRegex('ab', 3), (r) => {
        const nfa = thompsonNfa(r);
        const js = regexToJs(r);
        for (const w of wordsUpTo(['a', 'b'], 6)) expect(accepts(nfa, w)).toBe(js.test(w));
      }),
      { numRuns: 60 },
    );
  });
  it('degenerate regexes build valid NFAs', () => {
    for (const s of ['ε', '∅', 'ε*', '∅*', '\\eps+']) {
      expect(validate(build(s)).filter((i) => i.severity === 'error')).toEqual([]);
    }
    expect(accepts(build('∅'), '')).toBe(false);
    expect(accepts(build('∅*'), '')).toBe(true);
  });
});
