import { describe, expect, it } from 'vitest';
import { EPSILON } from '../core/model';
import { labelToTex, symbolsToTex, texToSymbols, texToText } from './latexText';

describe('labelToTex', () => {
  it.each([
    ['q_0', '$q_0$'],
    ['q_{12}', '$q_{12}$'],
    ["q_1'", "$q_1'$"],
    ['{q_0,q_1}', '$\\{q_0,q_1\\}$'],
    ['∅', '$\\emptyset$'],
    ['even', '$\\mathit{even}$'],
    ['q_s', '$q_s$'],
    ['a b', '$a\\ b$'],
    ['x#1', '$x\\#1$'],
    ['', ''],
  ])('%s → %s', (label, tex) => {
    expect(labelToTex(label)).toBe(tex);
  });

  it.each([
    'q_0',
    'q_{12}',
    "q_1'",
    '{q_0,q_1}',
    '∅',
    'even',
    'dead state',
    'x#1',
    'q_{ab}',
    'λ_2',
  ])('reads %s back', (label) => {
    expect(texToText(labelToTex(label))).toBe(label);
  });
});

describe('texToText', () => {
  it.each([
    ['$q_0$', 'q_0'],
    ['$q_{10}$', 'q_{10}'],
    ['$q_{\\mathit{acc}}$', 'q_{acc}'],
    ['$q_0^\\prime$', "q_0'"],
    ['$q_0^{\\prime\\prime}$', "q_0''"],
    ['$\\varnothing$', '∅'],
    ['\\textit{start}', 'start'],
    ['$\\text{dead}$', 'dead'],
    ['$s_{\\text{ok}}$', 's_{ok}'],
    ['$\\{1, 2\\}$', '{1, 2}'],
    ['$\\{1,\\,2\\}$', '{1,2}'],
  ])('%s → %s', (tex, text) => {
    expect(texToText(tex)).toBe(text);
  });
});

describe('symbols', () => {
  it('writes ε as \\varepsilon and a comma as {,}', () => {
    expect(symbolsToTex(['0', '1'])).toBe('$0,1$');
    expect(symbolsToTex([EPSILON])).toBe('$\\varepsilon$');
    expect(symbolsToTex(['a', ','])).toBe('$a,{,}$');
  });

  it.each([
    ['$0,1$', ['0', '1']],
    ['$0, 1$', ['0', '1']],
    ['0,1', ['0', '1']],
    ['$a$, $b$', ['a', 'b']],
    ['$a$ $b$', ['a', 'b']],
    ['$\\epsilon$', [EPSILON]],
    ['$\\varepsilon$', [EPSILON]],
    ['ε', [EPSILON]],
    ['$\\mathtt{a},\\mathtt{b}$', ['a', 'b']],
    ['$a,{,}$', ['a', ',']],
    ['$\\#$', ['#']],
    ['$a,a$', ['a']],
    ['$\\sigma$', ['σ']],
  ])('reads %s', (tex, symbols) => {
    expect(texToSymbols(tex)).toEqual(symbols);
  });

  it('round-trips awkward symbols', () => {
    const symbols = [EPSILON, ',', '#', '$', '%', '&', '_', '{', '}', '\\', '^', '~', 'α', '0'];
    expect(texToSymbols(symbolsToTex(symbols))).toEqual(symbols);
  });

  it('rejects symbols longer than one character, and unknown commands', () => {
    expect(() => texToSymbols('$ab$')).toThrow('“ab” is not a single symbol');
    expect(() => texToSymbols('$\\foo$')).toThrow('“\\foo” is not a symbol');
  });
});
