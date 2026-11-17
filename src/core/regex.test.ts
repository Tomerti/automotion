import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseRegex, printRegex, regexSymbols } from './regex';
import { arbRegex } from './testing/arbitraries';

const ok = (s: string) => {
  const r = parseRegex(s);
  if (!r.ok) throw new Error(r.error);
  return r.regex;
};

describe('regex parser and printer', () => {
  it('precedence: star binds tighter than concat, concat tighter than union', () => {
    expect(printRegex(ok('ab*|c'))).toBe('ab*|c');
    expect(ok('ab*|c')).toMatchObject({
      type: 'union',
      branches: [{ type: 'concat' }, { type: 'sym', sym: 'c' }],
    });
  });
  it('a union is one node with all its branches', () => {
    expect(ok('a|b|c')).toMatchObject({
      type: 'union',
      branches: [{ sym: 'a' }, { sym: 'b' }, { sym: 'c' }],
    });
  });
  it('concat is left-associative', () => {
    expect(ok('abc')).toMatchObject({
      type: 'concat',
      left: { type: 'concat' },
      right: { sym: 'c' },
    });
  });
  it('postfix operators stack', () =>
    expect(ok('a*+')).toMatchObject({ type: 'plus', body: { type: 'star' } }));
  it('whitespace is ignored and spans index the normalised text', () => {
    const r = parseRegex('(a | \\eps)*');
    expect(r).toMatchObject({ ok: true, text: '(a | ε)*' });
    expect(r.ok && r.regex.span).toEqual({ start: 0, end: 8 });
  });
  it('astral symbol is one symbol', () => {
    const r = parseRegex('😀*א');
    expect(r.ok && regexSymbols(r.regex)).toEqual(['א', '😀'].sort());
  });
  it.each([
    ['', 'Type a regex', 0],
    ['   ', 'Type a regex', 0],
    ['*a', 'Nothing to repeat before *', 0],
    ['a|+', 'Nothing to repeat before +', 2],
    ['(a', 'Missing )', 2],
    ['a)', 'Unexpected )', 1],
    ['()', 'Empty ( )', 0],
    ['a|', 'Nothing after |', 1],
    ['|a', 'Nothing before |', 0],
    ['a||b', 'Nothing before |', 2],
    ['\\x', 'Unknown \\ command', 0],
    ['a,b', "',' can't be a symbol", 1],
  ])('error for %j', (input, error, at) =>
    expect(parseRegex(input)).toEqual({ ok: false, error, at }),
  );
  it('printing minimal parentheses', () => {
    expect(printRegex(ok('(a|b)*abb'))).toBe('(a|b)*abb');
    expect(printRegex(ok('((a))(b)'))).toBe('ab');
    expect(printRegex(ok('(ab)*'))).toBe('(ab)*');
    expect(printRegex(ok('(a*)+'))).toBe('a*+');
  });
  it('print is a fixed point of parse ∘ print', () => {
    fc.assert(
      fc.property(arbRegex(), (r) => {
        const once = printRegex(r);
        expect(printRegex(ok(once))).toBe(once);
      }),
    );
  });
});
