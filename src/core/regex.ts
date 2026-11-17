import type { Sym } from './model';
import { EPSILON } from './model';

export interface Span {
  start: number;
  end: number;
}

export type Regex =
  | { type: 'sym'; sym: Sym; span?: Span }
  | { type: 'eps'; span?: Span }
  | { type: 'empty'; span?: Span }
  | { type: 'concat'; left: Regex; right: Regex; span?: Span }
  | { type: 'union'; branches: Regex[]; span?: Span } // at least 2 branches
  | { type: 'star' | 'plus'; body: Regex; span?: Span };

export const EMPTY_SET = '∅';

const RESERVED = new Set(['|', '+', '*', '(', ')', EPSILON, EMPTY_SET, '\\', ',']);

/** One code point that is not an operator, ε, ∅, a backslash, a comma or whitespace. */
export function isRegexSymbol(ch: string): boolean {
  return [...ch].length === 1 && !RESERVED.has(ch) && !/\s/u.test(ch);
}

/** `\eps` → ε and `\emptyset` → ∅. */
export function normalizeRegexText(text: string): string {
  return text.replaceAll('\\emptyset', EMPTY_SET).replaceAll('\\eps', EPSILON);
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

/** Parse a regex; never throws. Offsets in spans and errors index the normalised `text`. */
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
    const last = branches[branches.length - 1] as Regex;
    return {
      type: 'union',
      branches,
      span: { start: first.span!.start, end: last.span!.end },
    };
  }

  function parseConcat(afterBar: number | undefined): Regex {
    let acc: Regex | undefined;
    while (startsAtom(peek())) {
      const next = parsePostfix();
      acc = acc
        ? {
            type: 'concat',
            left: acc,
            right: next,
            span: { start: acc.span!.start, end: next.span!.end },
          }
        : next;
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
      body = {
        type: t.ch === '*' ? 'star' : 'plus',
        body,
        span: { start: body.span!.start, end: t.end },
      };
    }
    return body;
  }

  function parseAtom(): Regex {
    const t = tokens[pos++] as Token;
    const span = { start: t.start, end: t.end };
    if (t.ch === EPSILON) return { type: 'eps', span };
    if (t.ch === EMPTY_SET) return { type: 'empty', span };
    if (t.ch === '(') {
      if (peek()?.ch === ')') throw new ParseError('Empty ( )', t.start);
      const inner = parseUnion();
      const close = peek();
      if (close?.ch !== ')') throw new ParseError('Missing )', text.length);
      pos++;
      return { ...inner, span: { start: t.start, end: close.end } };
    }
    if (t.ch === '\\') throw new ParseError('Unknown \\ command', t.start);
    if (t.ch === ',') throw new ParseError("',' can't be a symbol", t.start);
    return { type: 'sym', sym: t.ch, span };
  }

  try {
    const regex = parseUnion();
    const rest = peek();
    if (rest) throw new ParseError('Unexpected )', rest.start);
    return { ok: true, regex, text };
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.error, at: e.at };
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
