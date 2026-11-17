import type { Sym } from './model';
import { printRegex } from './regex';
import type { Regex } from './regex';

/** Smart constructors applying exactly the simplifications of the state-elimination labels. */

export const EPS: Regex = { type: 'eps' };
export const EMPTY: Regex = { type: 'empty' };

export function mkSym(s: Sym): Regex {
  return { type: 'sym', sym: s };
}

/** `∅|r = r|∅ = r`, `r|r = r` (equal printed text); unions are flattened into one node. */
export function mkUnion(a: Regex, b: Regex): Regex {
  const branches: Regex[] = [];
  const seen = new Set<string>();
  for (const part of [a, b]) {
    for (const branch of part.type === 'union' ? part.branches : [part]) {
      if (branch.type === 'empty') continue;
      const text = printRegex(branch);
      if (seen.has(text)) continue;
      seen.add(text);
      branches.push(branch);
    }
  }
  if (branches.length === 0) return EMPTY;
  if (branches.length === 1) return branches[0] as Regex;
  return { type: 'union', branches };
}

/** `εr = rε = r`, `∅r = r∅ = ∅`. */
export function mkConcat(a: Regex, b: Regex): Regex {
  if (a.type === 'empty' || b.type === 'empty') return EMPTY;
  if (a.type === 'eps') return b;
  if (b.type === 'eps') return a;
  return { type: 'concat', left: a, right: b };
}

/** `ε* = ∅* = ε`, `(r*)* = r*`. */
export function mkStar(r: Regex): Regex {
  if (r.type === 'eps' || r.type === 'empty') return EPS;
  if (r.type === 'star') return r;
  return { type: 'star', body: r };
}
