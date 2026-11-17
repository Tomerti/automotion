import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { minimize } from './minimize';
import { startStates } from './model';
import type { Automaton } from './model';
import { printRegex } from './regex';
import { canBuildFromRegex, regexToMinimalDfa } from './regexToDfa';
import { arbRegex } from './testing/arbitraries';
import { accepts, regexToJs, wordsUpTo } from './testing/language';
import { validate } from './validate';

const label = (d: Automaton, id: string): string | undefined =>
  d.states.find((s) => s.id === id)?.label;

describe('regexToMinimalDfa', () => {
  it('(a|b)*abb: 4 states labelled breadth-first', () => {
    const d = regexToMinimalDfa('(a|b)*abb');
    expect(d.kind).toBe('DFA');
    expect(d.name).toBe('(a|b)*abb');
    expect(d.states.map((s) => s.label)).toEqual(['q_0', 'q_1', 'q_2', 'q_3']);
    expect(startStates(d).map((id) => label(d, id))).toEqual(['q_0']);
    expect(d.accepting.map((id) => label(d, id))).toEqual(['q_3']);
    expect(d.states.every((s) => s.mergedFrom === undefined)).toBe(true);
  });

  it('a*b* is complete: 3 states with a dead one', () => {
    expect(regexToMinimalDfa('a*b*').states).toHaveLength(3);
  });

  it('accepts exactly the regex language and is minimal', () => {
    fc.assert(
      fc.property(arbRegex('ab', 3), (r) => {
        const d = regexToMinimalDfa(printRegex(r));
        const js = regexToJs(r);
        for (const w of wordsUpTo(['a', 'b'], 6)) expect(accepts(d, w)).toBe(js.test(w));
        expect(minimize(d).result.states).toHaveLength(d.states.length);
      }),
      { numRuns: 60 },
    );
  });

  it('degenerate regexes give valid DFAs', () => {
    for (const s of ['ε', '∅', 'ε*', '∅*', '\\eps+']) {
      expect(validate(regexToMinimalDfa(s)).filter((i) => i.severity === 'error')).toEqual([]);
    }
    expect(accepts(regexToMinimalDfa('∅'), '')).toBe(false);
    expect(accepts(regexToMinimalDfa('ε*'), '')).toBe(true);
  });

  it('astral and non-Latin symbols', () => {
    expect(regexToMinimalDfa('😀*א').alphabet.slice().sort()).toEqual(['א', '😀'].sort());
    expect(accepts(regexToMinimalDfa('א|ב'), 'ב')).toBe(true);
  });

  it('refusals', () => {
    expect(canBuildFromRegex('')).toBe('Type a regex');
    expect(canBuildFromRegex('a|')).toBe('Nothing after |');
    expect(canBuildFromRegex('a'.repeat(1001))).toBe('Too long: at most 1000 characters');
    expect(canBuildFromRegex('(a|b)*a(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)')).toBe(
      'Too big: the DFA would have more than 64 states',
    );
    expect(canBuildFromRegex('(a|b)*a(a|b)(a|b)(a|b)(a|b)(a|b)')).toBeNull();
    expect(canBuildFromRegex('a'.repeat(40))).toBeNull();
    expect(() => regexToMinimalDfa('a|')).toThrow('Nothing after |');
  });
});
