import { newId } from './id';
import { minimize } from './minimize';
import { startStates } from './model';
import type { Automaton, StateId, Transition } from './model';
import { normalizeRegexText, parseRegex } from './regex';
import { MAX_DFA_STATES, subsetConstruction } from './subset';
import { thompsonNfa } from './thompson';

/** Longest regex text (after `\eps` and friends are normalised) that will be built. */
export const MAX_REGEX_INPUT = 1000;

/**
 * The subset construction of a Thompson NFA is bigger than the minimal DFA (a regex whose minimal
 * DFA has exactly 64 states needs more subsets), so it gets headroom; the 64-state cap applies to
 * the minimal DFA.
 */
const MAX_SUBSET_STATES = 1024;

const TOO_BIG = `Too big: the DFA would have more than ${MAX_DFA_STATES} states`;

/** The minimal DFA's states renamed q_0, q_1, … breadth-first from the start, in alphabet order. */
function relabel(dfa: Automaton, name: string): Automaton {
  const start = startStates(dfa)[0];
  const next = new Map<string, StateId>();
  for (const t of dfa.transitions) {
    for (const sym of t.symbols) next.set(`${t.from}\0${sym}`, t.to);
  }
  const order: StateId[] = start === undefined ? [] : [start];
  for (let head = 0; head < order.length; head++) {
    for (const sym of dfa.alphabet) {
      const to = next.get(`${order[head]}\0${sym}`);
      if (to !== undefined && !order.includes(to)) order.push(to);
    }
  }
  for (const s of dfa.states) if (!order.includes(s.id)) order.push(s.id);

  const labelOf = new Map(order.map((id, i) => [id, `q_${i}`]));
  const byId = new Map(dfa.states.map((s) => [s.id, s]));
  const transitions: Transition[] = dfa.transitions.map((t) => ({ ...t }));
  return {
    ...dfa,
    id: newId(),
    name,
    states: order.map((id) => {
      const s = byId.get(id);
      return { id, label: labelOf.get(id) ?? id, x: s?.x ?? 0, y: s?.y ?? 0 };
    }),
    transitions,
  };
}

/** The minimal DFA for a regex, or the reason it can't be built. */
function build(input: string): { ok: true; dfa: Automaton } | { ok: false; error: string } {
  const text = normalizeRegexText(input);
  if (text.trim() === '') return { ok: false, error: 'Type a regex' };
  if ([...text].length > MAX_REGEX_INPUT) {
    return { ok: false, error: `Too long: at most ${MAX_REGEX_INPUT} characters` };
  }
  const parsed = parseRegex(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const nfa = thompsonNfa(parsed.regex);
  let dfa: Automaton;
  try {
    dfa = subsetConstruction(nfa, MAX_SUBSET_STATES).result;
  } catch {
    return { ok: false, error: TOO_BIG };
  }
  const minimal = minimize(dfa).result;
  if (minimal.states.length > MAX_DFA_STATES) return { ok: false, error: TOO_BIG };
  return { ok: true, dfa: relabel(minimal, nfa.name) };
}

/** Why `input` can't be turned into a DFA, or null when it can. */
export function canBuildFromRegex(input: string): string | null {
  const built = build(input);
  return built.ok ? null : built.error;
}

/** Regex → Thompson NFA → subset construction → minimization, labelled q_0, q_1, … */
export function regexToMinimalDfa(input: string): Automaton {
  const built = build(input);
  if (!built.ok) throw new Error(built.error);
  return built.dfa;
}
