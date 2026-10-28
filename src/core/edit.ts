import { newId } from './id';
import { EPSILON } from './model';
import type { Automaton, AutomatonKind, StateId, Sym, Transition } from './model';
import { hasErrors, validate } from './validate';
import type { Issue } from './validate';

export function nextStateLabel(a: Automaton): string {
  const labels = new Set(a.states.map((s) => s.label));
  let i = 0;
  while (labels.has(`q_${i}`)) i++;
  return `q_${i}`;
}

export function addState(
  a: Automaton,
  pos: { x: number; y: number },
  id: StateId = newId(),
): Automaton {
  return {
    ...a,
    states: [...a.states, { id, label: nextStateLabel(a), x: pos.x, y: pos.y }],
  };
}

export function removeState(a: Automaton, id: StateId): Automaton {
  return {
    ...a,
    states: a.states.filter((s) => s.id !== id),
    starts: a.starts.filter((x) => x !== id),
    accepting: a.accepting.filter((x) => x !== id),
    transitions: a.transitions.filter((t) => t.from !== id && t.to !== id),
  };
}

export function renameState(a: Automaton, id: StateId, label: string): Automaton {
  return { ...a, states: a.states.map((s) => (s.id === id ? { ...s, label } : s)) };
}

export function moveState(a: Automaton, id: StateId, pos: { x: number; y: number }): Automaton {
  return { ...a, states: a.states.map((s) => (s.id === id ? { ...s, x: pos.x, y: pos.y } : s)) };
}

/** Make `id` the only start state (null: none). */
export function setStart(a: Automaton, id: StateId | null): Automaton {
  return { ...a, starts: id === null ? [] : [id] };
}

export function toggleAccepting(a: Automaton, id: StateId): Automaton {
  return {
    ...a,
    accepting: a.accepting.includes(id)
      ? a.accepting.filter((x) => x !== id)
      : [...a.accepting, id],
  };
}

export function setEdgeSymbols(a: Automaton, from: StateId, to: StateId, syms: Sym[]): Automaton {
  const symbols = [...new Set(syms)];
  const exists = a.transitions.some((t) => t.from === from && t.to === to);
  if (symbols.length === 0) {
    return { ...a, transitions: a.transitions.filter((t) => !(t.from === from && t.to === to)) };
  }
  if (!exists) {
    const created: Transition = { id: newId(), from, to, symbols };
    return { ...a, transitions: [...a.transitions, created] };
  }
  return {
    ...a,
    transitions: a.transitions.map((t) => (t.from === from && t.to === to ? { ...t, symbols } : t)),
  };
}

function edgeSymbols(a: Automaton, from: StateId, to: StateId): Sym[] {
  return a.transitions.find((t) => t.from === from && t.to === to)?.symbols ?? [];
}

export function addSymbolToEdge(a: Automaton, from: StateId, to: StateId, sym: Sym): Automaton {
  return setEdgeSymbols(a, from, to, [...edgeSymbols(a, from, to), sym]);
}

export function removeSymbolFromEdge(
  a: Automaton,
  from: StateId,
  to: StateId,
  sym: Sym,
): Automaton {
  return setEdgeSymbols(
    a,
    from,
    to,
    edgeSymbols(a, from, to).filter((s) => s !== sym),
  );
}

/** Bend an edge (0 = straight); `undefined` restores the automatic shape. */
export function setEdgeBend(
  a: Automaton,
  transitionId: string,
  bend: number | undefined,
): Automaton {
  return {
    ...a,
    transitions: a.transitions.map((t) => {
      if (t.id !== transitionId) return t;
      if (bend !== undefined) return { ...t, bend };
      const rest = { ...t };
      delete rest.bend;
      return rest;
    }),
  };
}

export function setLoopAngle(a: Automaton, transitionId: string, angle: number): Automaton {
  return {
    ...a,
    transitions: a.transitions.map((t) => (t.id === transitionId ? { ...t, loopAngle: angle } : t)),
  };
}

/**
 * Keep the alphabet equal to the non-ε symbols used on transitions: symbols still in use keep
 * their order, new ones follow in order of appearance. Returns `a` itself when nothing changes.
 */
export function syncAlphabet(a: Automaton): Automaton {
  const used = new Set<Sym>();
  for (const t of a.transitions) for (const s of t.symbols) if (s !== EPSILON) used.add(s);
  const kept = a.alphabet.filter((s) => used.has(s));
  const added = [...used].filter((s) => !kept.includes(s));
  const next = [...kept, ...added];
  if (next.length === a.alphabet.length && next.every((s, i) => s === a.alphabet[i])) return a;
  return { ...a, alphabet: next };
}

/**
 * Set the symbols of edge (from, to). Adding ε to a DFA turns it into an NFA (`promoted`).
 * The alphabet is synced.
 */
export function commitEdgeSymbols(
  a: Automaton,
  from: StateId,
  to: StateId,
  syms: Sym[],
): { automaton: Automaton; promoted: boolean } {
  const promoted = a.kind === 'DFA' && syms.includes(EPSILON);
  const base: Automaton = promoted ? { ...a, kind: 'NFA' } : a;
  return { automaton: syncAlphabet(setEdgeSymbols(base, from, to, syms)), promoted };
}

export function removeTransition(a: Automaton, transitionId: string): Automaton {
  return { ...a, transitions: a.transitions.filter((t) => t.id !== transitionId) };
}

export function addAlphabetSymbol(a: Automaton, sym: Sym): Automaton {
  if (sym === EPSILON) throw new Error("The alphabet can't contain ε");
  if (Array.from(sym).length !== 1) throw new Error('Symbols must be single characters');
  if (a.alphabet.includes(sym)) return a;
  return { ...a, alphabet: [...a.alphabet, sym] };
}

export function removeAlphabetSymbol(a: Automaton, sym: Sym): Automaton {
  if (sym === EPSILON) return a;
  return {
    ...a,
    alphabet: a.alphabet.filter((s) => s !== sym),
    transitions: a.transitions
      .map((t) => ({ ...t, symbols: t.symbols.filter((s) => s !== sym) }))
      .filter((t) => t.symbols.length > 0),
  };
}

export function renameAlphabetSymbol(a: Automaton, from: Sym, to: Sym): Automaton {
  if (from === EPSILON || from === to) return a;
  const rename = (syms: Sym[]): Sym[] => [...new Set(syms.map((s) => (s === from ? to : s)))];
  return {
    ...a,
    alphabet: rename(a.alphabet),
    transitions: a.transitions.map((t) => ({ ...t, symbols: rename(t.symbols) })),
  };
}

export function setKind(
  a: Automaton,
  kind: AutomatonKind,
): { ok: true; automaton: Automaton } | { ok: false; issues: Issue[] } {
  const next: Automaton = { ...a, kind };
  if (kind === 'DFA') {
    const issues = validate(next);
    if (hasErrors(issues))
      return { ok: false, issues: issues.filter((i) => i.severity === 'error') };
  }
  return { ok: true, automaton: next };
}

export function renameAutomaton(a: Automaton, name: string): Automaton {
  return { ...a, name };
}

/** What a user may type for ε in a symbol input. */
export const EPSILON_ALIASES = ['\\epsilon', 'eps', EPSILON];

/** Live input normalization: `\epsilon` turns into ε as soon as it is typed. */
export function normalizeSymbolText(text: string): string {
  return text.replaceAll('\\epsilon', EPSILON);
}

export function parseSymbolInput(
  text: string,
  kind: AutomatonKind,
): { ok: true; symbols: Sym[] } | { ok: false; error: string } {
  const symbols: Sym[] = [];
  for (const raw of text.split(',')) {
    const token = raw.trim();
    if (token === '') continue;
    const sym = EPSILON_ALIASES.includes(token) ? EPSILON : token;
    if (sym === EPSILON) {
      if (kind === 'DFA') return { ok: false, error: "A DFA can't have ε-transitions" };
    } else if (Array.from(sym).length !== 1) {
      return { ok: false, error: `Symbols must be single characters: ${token}` };
    }
    if (!symbols.includes(sym)) symbols.push(sym);
  }
  return { ok: true, symbols };
}
