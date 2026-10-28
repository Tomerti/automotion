import type { Automaton, AutomatonKind, Sym, Transition } from '../model';

export interface FixtureSpec {
  kind: AutomatonKind;
  alphabet: string;
  states: string[];
  start?: string;
  accepting?: string[];
  edges?: [from: string, symbols: string, to: string][];
  name?: string;
}

function splitSymbols(s: string): Sym[] {
  return s.includes(',') ? s.split(',').filter((x) => x !== '') : Array.from(s);
}

export function fixture(spec: FixtureSpec): Automaton {
  const transitions: Transition[] = [];
  for (const [from, symbols, to] of spec.edges ?? []) {
    const id = `${from}->${to}`;
    const existing = transitions.find((t) => t.id === id);
    const syms = splitSymbols(symbols);
    if (existing) {
      for (const s of syms) if (!existing.symbols.includes(s)) existing.symbols.push(s);
    } else {
      transitions.push({ id, from, to, symbols: [...new Set(syms)] });
    }
  }
  return {
    id: spec.name ?? 'fixture',
    name: spec.name ?? 'fixture',
    kind: spec.kind,
    alphabet: splitSymbols(spec.alphabet),
    states: spec.states.map((label, i) => ({ id: label, label, x: 100 * i, y: 0 })),
    start: spec.start ?? null,
    accepting: spec.accepting ?? [],
    transitions,
  };
}

/** NFA over {a,b} for "the n-th symbol from the end is a": its DFA has 2^n states. */
export function nthFromEnd(n: number): Automaton {
  const states = Array.from({ length: n + 1 }, (_, i) => `q${i}`);
  const edges: [string, string, string][] = [
    ['q0', 'a,b', 'q0'],
    ['q0', 'a', 'q1'],
  ];
  for (let i = 1; i < n; i++) edges.push([`q${i}`, 'a,b', `q${i + 1}`]);
  return fixture({
    kind: 'NFA',
    alphabet: 'ab',
    states,
    start: 'q0',
    accepting: [`q${n}`],
    edges,
    name: `nth${n}`,
  });
}
