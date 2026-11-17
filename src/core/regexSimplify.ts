import type { Sym } from './model';
import { printRegex } from './regex';
import type { Regex } from './regex';

/** Smart constructors applying exactly the simplifications of the state-elimination labels. */

export const EPS: Regex = { type: 'eps' };
export const EMPTY: Regex = { type: 'empty' };

export function mkSym(s: Sym): Regex {
  return { type: 'sym', sym: s };
}

/** The body `r` of a branch that is `rr*` or `r*r`, else null. */
function plusBody(branch: Regex): Regex | null {
  if (branch.type !== 'concat') return null;
  const { left, right } = branch;
  if (right.type === 'star' && printRegex(right.body) === printRegex(left)) return left;
  if (left.type === 'star' && printRegex(left.body) === printRegex(right)) return right;
  return null;
}

/** `ε|rr* = ε|r*r = r*`: each `rr*` / `r*r` branch becomes `r*` when `ε` is present. */
function absorbEpsIntoPlus(branches: Regex[]): Regex[] {
  if (!branches.some((b) => b.type === 'eps')) return branches;
  let changed = false;
  const out = branches.map((b) => {
    const body = plusBody(b);
    if (body === null) return b;
    changed = true;
    return { type: 'star', body } as Regex;
  });
  return changed ? out.filter((b) => b.type !== 'eps') : branches;
}

/** `ε|r* = r|r* = r*`: a star swallows `ε` and the branches equal to its body. */
function absorbIntoStars(branches: Regex[]): Regex[] {
  const bodies = new Set<string>();
  for (const b of branches) if (b.type === 'star') bodies.add(printRegex(b.body));
  if (bodies.size === 0) return branches;
  return branches.filter(
    (b) => b.type === 'star' || (b.type !== 'eps' && !bodies.has(printRegex(b))),
  );
}

function dedupe(branches: Regex[]): Regex[] {
  const seen = new Set<string>();
  return branches.filter((b) => {
    const text = printRegex(b);
    if (seen.has(text)) return false;
    seen.add(text);
    return true;
  });
}

/** `∅|r = r|∅ = r`, `r|r = r` (equal printed text), `ε|rr* = ε|r*r = ε|r* = r|r* = r*`; flat unions. */
export function mkUnion(a: Regex, b: Regex): Regex {
  let branches: Regex[] = [];
  for (const part of [a, b]) {
    for (const branch of part.type === 'union' ? part.branches : [part]) {
      if (branch.type !== 'empty') branches.push(branch);
    }
  }
  branches = dedupe(absorbIntoStars(dedupe(absorbEpsIntoPlus(dedupe(branches)))));
  if (branches.length === 0) return EMPTY;
  if (branches.length === 1) return branches[0] as Regex;
  return { type: 'union', branches };
}

/** The `r` of an `ε|r` union (`r` may itself be a union), else null. */
function optionalBody(r: Regex): Regex | null {
  if (r.type !== 'union' || !r.branches.some((b) => b.type === 'eps')) return null;
  return mkUnion({ type: 'union', branches: r.branches.filter((b) => b.type !== 'eps') }, EMPTY);
}

function lastFactor(r: Regex): Regex {
  return r.type === 'concat' ? r.right : r;
}

function firstFactor(r: Regex): Regex {
  return r.type === 'concat' ? firstFactor(r.left) : r;
}

/** `r` without its last factor, or null when it has one factor. */
function dropLast(r: Regex): Regex | null {
  return r.type === 'concat' ? r.left : null;
}

/** `r` without its first factor, or null when it has one factor. */
function dropFirst(r: Regex): Regex | null {
  if (r.type !== 'concat') return null;
  const rest = dropFirst(r.left);
  return rest === null ? r.right : { type: 'concat', left: rest, right: r.right };
}

/** `r*r* = (ε|r)r* = r*(ε|r) = r*` for two adjacent factors, else null. */
function collapseFactors(x: Regex, y: Regex): Regex | null {
  if (x.type === 'star' && y.type === 'star' && printRegex(x.body) === printRegex(y.body)) return x;
  const ox = optionalBody(x);
  if (ox !== null && y.type === 'star' && printRegex(ox) === printRegex(y.body)) return y;
  const oy = optionalBody(y);
  if (oy !== null && x.type === 'star' && printRegex(oy) === printRegex(x.body)) return x;
  return null;
}

/** `εr = rε = r`, `∅r = r∅ = ∅`, and the adjacent-factor collapses of `collapseFactors`. */
export function mkConcat(a: Regex, b: Regex): Regex {
  if (a.type === 'empty' || b.type === 'empty') return EMPTY;
  if (a.type === 'eps') return b;
  if (b.type === 'eps') return a;
  const star = collapseFactors(lastFactor(a), firstFactor(b));
  if (star !== null) {
    const head = dropLast(a);
    const tail = dropFirst(b);
    const front: Regex = head === null ? star : { type: 'concat', left: head, right: star };
    return tail === null ? front : { type: 'concat', left: front, right: tail };
  }
  return { type: 'concat', left: a, right: b };
}

/** `ε* = ∅* = ε`, `(r*)* = r*`, `(ε|r)* = r*`. */
export function mkStar(r: Regex): Regex {
  if (r.type === 'eps' || r.type === 'empty') return EPS;
  if (r.type === 'star') return r;
  const body = optionalBody(r);
  if (body !== null) return mkStar(body);
  return { type: 'star', body: r };
}
