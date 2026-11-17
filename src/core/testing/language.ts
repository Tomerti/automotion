import type { Automaton } from '../model';
import type { Regex } from '../regex';
import { runWord } from '../run';

/** Every word over `alphabet` of length 0 … `maxLength`. */
export function wordsUpTo(alphabet: string[], maxLength: number): string[] {
  const out = [''];
  let layer = [''];
  for (let n = 1; n <= maxLength; n++) {
    layer = layer.flatMap((w) => alphabet.map((c) => w + c));
    out.push(...layer);
  }
  return out;
}

function source(r: Regex): string {
  switch (r.type) {
    case 'sym':
      return r.sym.replace(/[.*+?^${}()|[\]\\/-]/gu, '\\$&');
    case 'eps':
      return '(?:)';
    case 'empty':
      return '[^\\s\\S]';
    case 'concat':
      return `(?:${source(r.left)})(?:${source(r.right)})`;
    case 'union':
      return `(?:${r.branches.map(source).join('|')})`;
    case 'star':
      return `(?:${source(r.body)})*`;
    case 'plus':
      return `(?:${source(r.body)})+`;
  }
}

/** An anchored JS RegExp for the same language. */
export function regexToJs(r: Regex): RegExp {
  return new RegExp(`^(?:${source(r)})$`, 'u');
}

export function accepts(a: Automaton, word: string): boolean {
  // A word with a symbol outside the alphabet is not in the language (and can't be run).
  if ([...word].some((c) => !a.alphabet.includes(c))) return false;
  return runWord(a, word).accepted;
}
