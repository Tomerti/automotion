import { newId } from './id';
import { EPSILON, replaceEpsilonAliases } from './model';
import type { Automaton, AutomatonKind, LabelSide, StateId, Sym, Transition } from './model';
import { hasErrors, ignoringIncomplete, validate } from './validate';
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

const isState = (a: Automaton, id: StateId): boolean => a.states.some((s) => s.id === id);

/**
 * Make `id` the only start state (null: none). An id that is not a state (say, from a menu left
 * open across an undo) changes nothing: saved files must only name existing start states.
 */
export function setStart(a: Automaton, id: StateId | null): Automaton {
  if (id !== null && !isState(a, id)) return a;
  return { ...a, starts: id === null ? [] : [id] };
}

/**
 * The S key: on an NFA, add `id` as a start state or remove it; on a DFA, make it the only start
 * state, or clear the start if it already was.
 */
export function toggleStart(a: Automaton, id: StateId): Automaton {
  if (!isState(a, id)) return a;
  if (a.kind === 'DFA') return setStart(a, a.starts.includes(id) ? null : id);
  return {
    ...a,
    starts: a.starts.includes(id) ? a.starts.filter((x) => x !== id) : [...a.starts, id],
  };
}

export function toggleAccepting(a: Automaton, id: StateId): Automaton {
  if (!isState(a, id)) return a;
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

/** Draw an edge's symbols on `side` of it; `undefined` restores the automatic side. */
export function setLabelSide(
  a: Automaton,
  transitionId: string,
  side: LabelSide | undefined,
): Automaton {
  return {
    ...a,
    transitions: a.transitions.map((t) => {
      if (t.id !== transitionId) return t;
      if (side !== undefined) return { ...t, labelSide: side };
      const rest = { ...t };
      delete rest.labelSide;
      return rest;
    }),
  };
}

/**
 * Turn a state's start arrow so it comes from `angle` (see `State.startAngle`); `undefined`
 * restores the default (from the left).
 */
export function setStartAngle(
  a: Automaton,
  stateId: StateId,
  angle: number | undefined,
): Automaton {
  return {
    ...a,
    states: a.states.map((s) => {
      if (s.id !== stateId) return s;
      if (angle !== undefined) return { ...s, startAngle: angle };
      const rest = { ...s };
      delete rest.startAngle;
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
 * The alphabet is synced. `bend`: the bend the edge gets if this creates it (an existing edge
 * keeps its own).
 */
export function commitEdgeSymbols(
  a: Automaton,
  from: StateId,
  to: StateId,
  syms: Sym[],
  opts: { bend?: number } = {},
): { automaton: Automaton; promoted: boolean } {
  const promoted = a.kind === 'DFA' && syms.includes(EPSILON);
  const base: Automaton = promoted ? { ...a, kind: 'NFA' } : a;
  const isNew = !a.transitions.some((t) => t.from === from && t.to === to);
  let next = setEdgeSymbols(base, from, to, syms);
  const created = next.transitions.find((t) => t.from === from && t.to === to);
  if (isNew && created && opts.bend !== undefined) next = setEdgeBend(next, created.id, opts.bend);
  return { automaton: syncAlphabet(next), promoted };
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
    const issues = ignoringIncomplete(validate(next));
    if (hasErrors(issues))
      return { ok: false, issues: issues.filter((i) => i.severity === 'error') };
  }
  return { ok: true, automaton: next };
}

export function renameAutomaton(a: Automaton, name: string): Automaton {
  return { ...a, name };
}

const sameList = <T>(a: T[] | undefined, b: T[] | undefined): boolean =>
  (a ?? []).length === (b ?? []).length && (a ?? []).every((x, i) => x === (b ?? [])[i]);

/**
 * Whether `a` and `b` differ at most in layout and name: same kind, alphabet, states (id, label,
 * `mergedFrom`), starts, accepting and transitions (id, ends, symbols), in the same order.
 * Positions, angles, bends, label sides and the automaton's name are ignored.
 */
export function sameStructure(a: Automaton, b: Automaton): boolean {
  return (
    a.kind === b.kind &&
    sameList(a.alphabet, b.alphabet) &&
    sameList(a.starts, b.starts) &&
    sameList(a.accepting, b.accepting) &&
    a.states.length === b.states.length &&
    a.states.every((s, i) => {
      const o = b.states[i]!;
      return s.id === o.id && s.label === o.label && sameList(s.mergedFrom, o.mergedFrom);
    }) &&
    a.transitions.length === b.transitions.length &&
    a.transitions.every((t, i) => {
      const o = b.transitions[i]!;
      return t.id === o.id && t.from === o.from && t.to === o.to && sameList(t.symbols, o.symbols);
    })
  );
}

/** What a user may type for ε in a symbol input. */
export const EPSILON_ALIASES = ['\\eps', 'eps', EPSILON];

/** Live input normalization: `\eps` and `\epsilon` turn into ε. */
export function normalizeSymbolText(text: string): string {
  return replaceEpsilonAliases(text);
}

/** Live state-name normalization: `\emptyset` turns into ∅ (the dead state's usual name). */
export function normalizeStateLabel(text: string): string {
  return text.replaceAll('\\emptyset', '∅');
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
