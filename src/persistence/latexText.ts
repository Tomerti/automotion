import { parseLabel } from '../core/label';
import { EPSILON } from '../core/model';
import type { Sym } from '../core/model';

/**
 * LaTeX (TikZ `automata` library) text conventions shared by the exporter
 * (`ui/canvas/exportLatex.ts`) and the importer (`latexImport.ts`).
 */

/** World px per TikZ centimetre: a state (48 px across) comes out close to TikZ's 2.5em. */
export const PX_PER_CM = 50;

/**
 * Apex offset of a TikZ `bend left=θ` edge, as a share of its chord, per unit of sin θ: the
 * control points sit 0.3915 × chord away (looseness 1), and a symmetric cubic's apex is 3/4 of
 * their offset.
 */
export const BEND_APEX = 0.75 * 0.3915;

/** The comment that carries an automaton's kind and name through a round trip. */
export const META_COMMENT = /^[ \t]*%[ \t]*AutoMotion[ \t]+(DFA|NFA)[ \t]*:[ \t]*(.*?)[ \t]*$/gm;

export function metaComment(kind: string, name: string): string {
  return `% AutoMotion ${kind}: ${name.replace(/[\r\n]+/g, ' ')}`;
}

/**
 * The comment before a minimized state's node, saying what it stands for (`mergedFrom`) in
 * labels as typed: `% AutoMotion merged: A = {q_0, q_1, q_2}`. Read back on import.
 */
export const MERGED_COMMENT = /^[ \t]*%[ \t]*AutoMotion merged:[ \t]*(.*?) = \{(.*)\}[ \t]*$/gm;

export function mergedComment(label: string, members: readonly string[]): string {
  const oneLine = (s: string): string => s.replace(/[\r\n]+/g, ' ');
  return `% AutoMotion merged: ${oneLine(label)} = {${members.map(oneLine).join(', ')}}`;
}

/** `mergedComment`'s members back: split at ", " outside braces (`{q_0,q_2}` stays whole). */
export function splitMembers(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth = Math.max(0, depth - 1);
    else if (ch === ',' && text[i + 1] === ' ' && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 2;
    }
  }
  out.push(text.slice(start));
  return out.map((m) => m.trim()).filter((m) => m !== '');
}

const GREEK: Record<string, string> = {
  α: 'alpha',
  β: 'beta',
  γ: 'gamma',
  δ: 'delta',
  ζ: 'zeta',
  η: 'eta',
  θ: 'theta',
  ι: 'iota',
  κ: 'kappa',
  λ: 'lambda',
  μ: 'mu',
  ν: 'nu',
  ξ: 'xi',
  π: 'pi',
  ρ: 'rho',
  σ: 'sigma',
  τ: 'tau',
  υ: 'upsilon',
  φ: 'phi',
  χ: 'chi',
  ψ: 'psi',
  ω: 'omega',
  Γ: 'Gamma',
  Δ: 'Delta',
  Θ: 'Theta',
  Λ: 'Lambda',
  Ξ: 'Xi',
  Π: 'Pi',
  Σ: 'Sigma',
  Φ: 'Phi',
  Ψ: 'Psi',
  Ω: 'Omega',
};

/** Characters written as a math-mode command (or escaped), whether in a label or a symbol. */
const MATH_CHARS: Record<string, string> = {
  [EPSILON]: '\\varepsilon',
  '∅': '\\emptyset',
  '#': '\\#',
  $: '\\$',
  '%': '\\%',
  '&': '\\&',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
  '\\': '\\backslash',
  '^': '\\hat{}',
  '~': '\\sim',
  ' ': '\\ ',
  ...Object.fromEntries(Object.entries(GREEK).map(([ch, name]) => [ch, `\\${name}`])),
};

/** Commands read back as a character (the inverse of MATH_CHARS, plus common synonyms). */
const COMMAND_CHARS: Record<string, string> = {
  varepsilon: EPSILON,
  epsilon: EPSILON,
  emptyset: '∅',
  varnothing: '∅',
  backslash: '\\',
  sim: '~',
  prime: "'",
  lbrace: '{',
  rbrace: '}',
  textunderscore: '_',
  textbackslash: '\\',
  textasciitilde: '~',
  textasciicircum: '^',
  ...Object.fromEntries(Object.entries(GREEK).map(([ch, name]) => [name, ch])),
  varphi: 'φ',
  vartheta: 'θ',
  varrho: 'ρ',
  varsigma: 'σ',
  varpi: 'π',
};

/** Commands whose argument is kept as text: font and box wrappers. */
const WRAPPERS = new Set([
  'mathit',
  'mathrm',
  'mathbf',
  'mathsf',
  'mathtt',
  'mathnormal',
  'boldsymbol',
  'operatorname',
  'text',
  'textit',
  'textrm',
  'textbf',
  'textsf',
  'texttt',
  'textnormal',
  'textup',
  'emph',
  'mbox',
  'hbox',
  'ensuremath',
]);

/** Spacing commands, read as nothing or a space. */
const SPACES: Record<string, string> = {
  quad: ' ',
  qquad: ' ',
  enspace: ' ',
  thinspace: '',
  negthinspace: '',
};

function mathChar(ch: string): string {
  return MATH_CHARS[ch] ?? ch;
}

/** Math mode for a run of label text: words of two or more letters set as `\mathit`. */
function mathRun(text: string): string {
  let out = '';
  for (const part of text.match(/[A-Za-z]{2,}|[^]/gu) ?? []) {
    out += part.length > 1 ? `\\mathit{${part}}` : mathChar(part);
  }
  return out;
}

/** A state label in math mode: `q_1` → `$q_1$`, `{q_0,q_1}` → `$\{q_0,q_1\}$`, `even` → `$\mathit{even}$`. */
export function labelToTex(label: string): string {
  let out = '';
  for (const seg of parseLabel(label)) {
    if (!seg.sub) out += mathRun(seg.text);
    else if (/^[A-Za-z0-9]$/.test(seg.text)) out += `_${seg.text}`;
    else out += `_{${mathRun(seg.text)}}`;
  }
  return out === '' ? '' : `$${out}$`;
}

/** An edge's symbols, in math mode: `$0,1$`, ε as `\varepsilon`, a comma symbol as `{,}`. */
export function symbolsToTex(symbols: readonly Sym[]): string {
  return `$${symbols.map((s) => (s === ',' ? '{,}' : mathChar(s))).join(',')}$`;
}

/** Index just past the group that opens at `open` (`{…}`, `[…]` or `(…)`), nested groups included. */
export function skipGroup(text: string, open: number): number {
  const opener = text[open];
  const closer = opener === '{' ? '}' : opener === '[' ? ']' : ')';
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === opener) depth++;
    else if (ch === closer && --depth === 0) return i + 1;
  }
  return text.length;
}

/** Split at the commas outside `{}`, `[]` and `()`; each part trimmed, empty parts dropped. */
export function splitTopLevel(text: string, sep = ','): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\') i++;
    else if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') depth--;
    else if (ch === sep && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p !== '');
}

/** Thrown for a command the importer can't read as a character. */
export class UnknownCommand extends Error {
  readonly command: string;
  constructor(command: string) {
    super(`\\${command}`);
    this.command = command;
  }
}

/**
 * Read TeX as plain text in the app's label syntax: `$q_{12}$` → `q_{12}`, `\mathit{even}` →
 * `even`, `\{q_0\}` → `{q_0}`, `\varepsilon` → ε. With `strict`, an unknown command throws
 * `UnknownCommand`; otherwise it reads as its name.
 */
export function texToText(tex: string, strict = false): string {
  let out = '';
  let i = 0;
  /** The next argument: a brace group's content, a command, or one character. */
  const argument = (): string => {
    while (tex[i] === ' ') i++;
    if (tex[i] === '{') {
      const end = skipGroup(tex, i);
      const inner = tex.slice(i + 1, end - 1);
      i = end;
      return texToText(inner, strict);
    }
    if (tex[i] === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(tex.slice(i));
      if (m) {
        i += m[0].length;
        return texToText(m[0], strict);
      }
    }
    const ch = Array.from(tex.slice(i))[0] ?? '';
    i += ch.length;
    return ch;
  };
  while (i < tex.length) {
    const ch = tex[i] as string;
    if (ch === '$') {
      i++;
    } else if (ch === '\\') {
      const m = /^\\([A-Za-z]+)\*?|^\\(.)/.exec(tex.slice(i));
      if (!m) {
        i++;
        continue;
      }
      i += m[0].length;
      const word = m[1];
      if (word === undefined) {
        // \{ \} \# \_ and friends are the character; \, \; \! are thin spaces; "\ " a space.
        const sym = m[2] as string;
        if (sym === ' ') out += ' ';
        else if (!',;:!'.includes(sym)) out += sym;
      } else if (WRAPPERS.has(word)) {
        out += argument();
      } else if (word === 'hat' && tex.slice(i).startsWith('{}')) {
        i += 2;
        out += '^';
      } else if (word in SPACES) {
        out += SPACES[word];
      } else if (word in COMMAND_CHARS) {
        out += COMMAND_CHARS[word];
      } else if (strict) {
        throw new UnknownCommand(word);
      } else {
        out += word;
      }
      if (word !== undefined && tex[i] === ' ') i++; // the space ending a command name
    } else if (ch === '{') {
      const end = skipGroup(tex, i);
      out += texToText(tex.slice(i + 1, end - 1), strict);
      i = end;
    } else if (ch === '_') {
      i++;
      const sub = argument();
      out += Array.from(sub).length === 1 ? `_${sub}` : `_{${sub}}`;
    } else if (ch === '^') {
      i++;
      const sup = argument();
      out += /^'+$/.test(sup) ? sup : `^${sup}`;
    } else if (ch === '~') {
      out += ' ';
      i++;
    } else {
      const c = Array.from(tex.slice(i))[0] as string;
      out += c;
      i += c.length;
    }
  }
  return out;
}

/**
 * An edge label's symbols: comma-separated (spaces also separate), ε written as `\varepsilon`
 * or `\epsilon`. Throws with a user-facing message when a symbol isn't a single character.
 */
export function texToSymbols(tex: string): Sym[] {
  const out: Sym[] = [];
  // Commas inside math are commas too, so drop the $ first; a comma symbol is written {,}.
  for (const part of splitTopLevel(tex.replace(/(?<!\\)\$/g, ''))) {
    let text: string;
    try {
      text = texToText(part, true);
    } catch (e) {
      if (e instanceof UnknownCommand) {
        throw new Error(`“\\${e.command}” is not a symbol`, { cause: e });
      }
      throw e;
    }
    const pieces = text === ' ' ? [' '] : text.split(/\s+/).filter((p) => p !== '');
    for (const p of pieces) {
      if (Array.from(p).length !== 1) {
        throw new Error(`“${p}” is not a single symbol (symbols are single characters)`);
      }
      if (!out.includes(p)) out.push(p);
    }
  }
  return out;
}
