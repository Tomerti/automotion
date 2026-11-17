import { describe, expect, it } from 'vitest';
import { printRegex } from './regex';
import { EMPTY, EPS, mkConcat, mkStar, mkSym, mkUnion } from './regexSimplify';

const A = mkSym('a');
const B = mkSym('b');

describe('regexSimplify', () => {
  it.each([
    [() => mkConcat(EPS, A), 'a'],
    [() => mkConcat(A, EPS), 'a'],
    [() => mkUnion(EMPTY, A), 'a'],
    [() => mkUnion(A, EMPTY), 'a'],
    [() => mkConcat(EMPTY, A), '∅'],
    [() => mkConcat(A, EMPTY), '∅'],
    [() => mkStar(EPS), 'ε'],
    [() => mkStar(EMPTY), 'ε'],
    [() => mkStar(mkStar(A)), 'a*'],
    [() => mkUnion(A, A), 'a'],
    [() => mkUnion(mkUnion(A, B), A), 'a|b'],
  ])('rule %#', (f, out) => expect(printRegex(f())).toBe(out));

  it('flattens unions into one node and prints minimal parentheses', () => {
    const u = mkUnion(mkUnion(A, B), mkSym('c'));
    expect(u.type === 'union' && u.branches.length).toBe(3);
    expect(printRegex(mkStar(mkUnion(A, B)))).toBe('(a|b)*');
    expect(printRegex(mkConcat(mkUnion(A, B), A))).toBe('(a|b)a');
  });
});
