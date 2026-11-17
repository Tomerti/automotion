import type { Sym } from './model';
import { EPSILON } from './model';

export type Regex =
  | { type: 'sym'; sym: Sym }
  | { type: 'eps' }
  | { type: 'empty' }
  | { type: 'concat'; left: Regex; right: Regex }
  | { type: 'union'; branches: Regex[] } // at least 2 branches
  | { type: 'star' | 'plus'; body: Regex };

export const EMPTY_SET = '∅';

const RESERVED = new Set(['|', '+', '*', '(', ')', EPSILON, EMPTY_SET, '\\', ',']);

/** One code point that is not an operator, ε, ∅, a backslash, a comma or whitespace. */
export function isRegexSymbol(ch: string): boolean {
  return [...ch].length === 1 && !RESERVED.has(ch) && !/\s/u.test(ch);
}

/** `\eps` (or `\epsilon`) → ε and `\emptyset` → ∅. */
export function normalizeRegexText(text: string): string {
  return text
    .replaceAll('\\emptyset', EMPTY_SET)
    .replaceAll('\\epsilon', EPSILON)
    .replaceAll('\\eps', EPSILON);
}

export type ParseResult =
  { ok: true; regex: Regex; text: string } | { ok: false; error: string; at: number };

interface Token {
  ch: string;
  start: number;
  end: number;
}

class ParseError {
  readonly error: string;
  readonly at: number;
  constructor(error: string, at: number) {
    this.error = error;
    this.at = at;
  }
}

/** Parse a regex; never throws. Error offsets index the normalised `text`. */
export function parseRegex(input: string): ParseResult {
  const text = normalizeRegexText(input);
  const tokens: Token[] = [];
  let offset = 0;
  for (const ch of text) {
    const end = offset + ch.length;
    if (!/\s/u.test(ch)) tokens.push({ ch, start: offset, end });
    offset = end;
  }
  if (tokens.length === 0) return { ok: false, error: 'Type a regex', at: 0 };

  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];

  function parseUnion(): Regex {
    const branches = [parseConcat(undefined)];
    for (let t = peek(); t?.ch === '|'; t = peek()) {
      pos++;
      branches.push(parseConcat(t.start));
    }
    const first = branches[0] as Regex;
    if (branches.length === 1) return first;
    return { type: 'union', branches };
  }

  function parseConcat(afterBar: number | undefined): Regex {
    let acc: Regex | undefined;
    while (startsAtom(peek())) {
      const next = parsePostfix();
      acc = acc ? { type: 'concat', left: acc, right: next } : next;
    }
    if (acc) return acc;
    const t = peek();
    if (t?.ch === '|') throw new ParseError('Nothing before |', t.start);
    if (t?.ch === '*' || t?.ch === '+')
      throw new ParseError(`Nothing to repeat before ${t.ch}`, t.start);
    if (afterBar !== undefined) throw new ParseError('Nothing after |', afterBar);
    if (t) throw new ParseError('Unexpected )', t.start);
    throw new ParseError('Missing )', text.length);
  }

  function parsePostfix(): Regex {
    let body = parseAtom();
    for (let t = peek(); t && (t.ch === '*' || t.ch === '+'); t = peek()) {
      pos++;
      body = { type: t.ch === '*' ? 'star' : 'plus', body };
    }
    return body;
  }

  function parseAtom(): Regex {
    const t = tokens[pos++] as Token;
    if (t.ch === EPSILON) return { type: 'eps' };
    if (t.ch === EMPTY_SET) return { type: 'empty' };
    if (t.ch === '(') {
      if (peek()?.ch === ')') throw new ParseError('Empty ( )', t.start);
      const inner = parseUnion();
      const close = peek();
      if (close?.ch !== ')') throw new ParseError('Missing )', text.length);
      pos++;
      return inner;
    }
    if (t.ch === '\\') throw new ParseError('Unknown \\ command', t.start);
    if (t.ch === ',') throw new ParseError("',' can't be a symbol", t.start);
    return { type: 'sym', sym: t.ch };
  }

  try {
    const regex = parseUnion();
    const rest = peek();
    if (rest) throw new ParseError('Unexpected )', rest.start);
    return { ok: true, regex, text };
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.error, at: e.at };
    // Thousands of nested ( overflow the recursive descent's stack.
    if (e instanceof RangeError) return { ok: false, error: 'Nested too deeply', at: 0 };
    throw e;
  }
}

function startsAtom(t: Token | undefined): boolean {
  return t !== undefined && !['|', '*', '+', ')'].includes(t.ch);
}

const PREC = { union: 0, concat: 1, star: 2, plus: 2, sym: 3, eps: 3, empty: 3 } as const;

/** Print with the fewest parentheses. */
export function printRegex(r: Regex): string {
  const child = (c: Regex, min: number): string =>
    PREC[c.type] >= min ? printRegex(c) : `(${printRegex(c)})`;
  switch (r.type) {
    case 'sym':
      return r.sym;
    case 'eps':
      return EPSILON;
    case 'empty':
      return EMPTY_SET;
    case 'concat':
      return child(r.left, PREC.concat) + child(r.right, PREC.concat);
    case 'union':
      return r.branches.map((b) => printRegex(b)).join('|');
    case 'star':
      return child(r.body, PREC.star) + '*';
    case 'plus':
      return child(r.body, PREC.star) + '+';
  }
}

/**
 * Regex text for an explanation: quoted like a symbol ('a') and without whitespace, so the
 * player's `LabelText` shows it literally (a `_` symbol is not read as a label subscript).
 */
export function quoteRegex(regexText: string): string {
  return `'${regexText.replace(/\s+/gu, '')}'`;
}

/** The symbols used, sorted and unique. */
export function regexSymbols(r: Regex): Sym[] {
  const out = new Set<Sym>();
  const walk = (n: Regex): void => {
    switch (n.type) {
      case 'sym':
        out.add(n.sym);
        break;
      case 'concat':
        walk(n.left);
        walk(n.right);
        break;
      case 'union':
        n.branches.forEach(walk);
        break;
      case 'star':
      case 'plus':
        walk(n.body);
        break;
      default:
    }
  };
  walk(r);
  return [...out].sort();
}
