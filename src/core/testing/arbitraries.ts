import fc from 'fast-check';
import { EPSILON } from '../model';
import type { Automaton, AutomatonKind, Transition } from '../model';

export interface ArbOpts {
  maxStates?: number;
  alphabet?: string;
  epsilon?: boolean;
}

function build(
  kind: AutomatonKind,
  alphabet: string[],
  n: number,
  accepting: boolean[],
  edges: Map<string, Set<string>>,
  starts: string[] = ['q0'],
): Automaton {
  const ids = Array.from({ length: n }, (_, i) => `q${i}`);
  const transitions: Transition[] = [];
  for (const [key, syms] of edges) {
    const [from, to] = key.split('>') as [string, string];
    if (syms.size > 0) transitions.push({ id: `${from}->${to}`, from, to, symbols: [...syms] });
  }
  return {
    id: 'arb',
    name: 'arb',
    kind,
    alphabet,
    states: ids.map((id, i) => ({ id, label: id, x: 100 * i, y: 0 })),
    starts,
    accepting: ids.filter((_, i) => accepting[i]),
    transitions,
  };
}

function addEdge(edges: Map<string, Set<string>>, from: number, to: number, sym: string): void {
  const key = `q${from}>q${to}`;
  let set = edges.get(key);
  if (!set) {
    set = new Set();
    edges.set(key, set);
  }
  set.add(sym);
}

export function arbNfa(opts: ArbOpts = {}): fc.Arbitrary<Automaton> {
  const { maxStates = 5, alphabet = 'ab', epsilon = true } = opts;
  const alpha = Array.from(alphabet);
  const symbols = epsilon ? [...alpha, EPSILON] : alpha;
  return fc.integer({ min: 1, max: Math.max(1, maxStates) }).chain((n) => {
    const triple = fc.tuple(
      fc.nat({ max: n - 1 }),
      fc.nat({ max: n - 1 }),
      symbols.length > 0 ? fc.constantFrom(...symbols) : fc.constant(null),
    );
    return fc
      .record({
        accepting: fc.array(fc.boolean(), { minLength: n, maxLength: n }),
        triples: fc.array(triple, { maxLength: n * 3 }),
        // One to three start states.
        starts: fc.subarray(
          Array.from({ length: n }, (_, i) => `q${i}`),
          { minLength: 1, maxLength: Math.min(3, n) },
        ),
      })
      .map(({ accepting, triples, starts }) => {
        const edges = new Map<string, Set<string>>();
        for (const [f, t, s] of triples) {
          if (s !== null) addEdge(edges, f, t, s);
        }
        return build('NFA', alpha, n, accepting, edges, starts);
      });
  });
}

export function arbDfa(opts: ArbOpts = {}): fc.Arbitrary<Automaton> {
  const { maxStates = 5, alphabet = 'ab' } = opts;
  const alpha = Array.from(alphabet);
  return fc.integer({ min: 1, max: Math.max(1, maxStates) }).chain((n) =>
    fc
      .record({
        accepting: fc.array(fc.boolean(), { minLength: n, maxLength: n }),
        // one entry per (state, symbol): a target index, or n for "missing"
        targets: fc.array(fc.integer({ min: 0, max: n }), {
          minLength: n * alpha.length,
          maxLength: n * alpha.length,
        }),
      })
      .map(({ accepting, targets }) => {
        const edges = new Map<string, Set<string>>();
        targets.forEach((t, i) => {
          if (t < n)
            addEdge(edges, Math.floor(i / alpha.length), t, alpha[i % alpha.length] as string);
        });
        return build('DFA', alpha, n, accepting, edges);
      }),
  );
}

export function arbWord(alphabet = 'ab', maxLength = 8): fc.Arbitrary<string> {
  if (alphabet.length === 0) return fc.constant('');
  return fc.array(fc.constantFrom(...Array.from(alphabet)), { maxLength }).map((cs) => cs.join(''));
}
