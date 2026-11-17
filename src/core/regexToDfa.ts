import { newId } from './id';
import { EPSILON, startStates } from './model';
import type { Automaton, StateId, Sym, Transition } from './model';
import { normalizeRegexText, parseRegex } from './regex';
import { MAX_DFA_STATES } from './subset';
import { thompsonNfa } from './thompson';

/** Longest regex text (after `\eps` and friends are normalised) that will be built. */
export const MAX_REGEX_INPUT = 1000;

/**
 * The subset DFA of a Thompson NFA can be bigger than the minimal DFA, so it gets headroom; the
 * 64-state cap applies to the minimal DFA.
 */
const MAX_SUBSET_STATES = 4096;

const TOO_BIG = `Too big: the DFA would have more than ${MAX_DFA_STATES} states`;

/** A complete DFA over `alphabet` on integer states; `delta[q][k]` is the target on symbol k. */
interface Table {
  delta: number[][];
  accepting: boolean[];
}

/** Subset construction over an NFA, with no trace; null when it passes `MAX_SUBSET_STATES`. */
function subsetTable(nfa: Automaton): Table | null {
  const index = new Map(nfa.states.map((s, i) => [s.id, i]));
  const n = nfa.states.length;
  const eps: number[][] = Array.from({ length: n }, () => []);
  const bySym: Map<Sym, number[]>[] = Array.from({ length: n }, () => new Map());
  for (const t of nfa.transitions) {
    const from = index.get(t.from) as number;
    const to = index.get(t.to) as number;
    for (const sym of t.symbols) {
      if (sym === EPSILON) eps[from]?.push(to);
      else {
        const m = bySym[from] as Map<Sym, number[]>;
        m.set(sym, [...(m.get(sym) ?? []), to]);
      }
    }
  }

  const accept = new Set(nfa.accepting.map((id) => index.get(id) as number));
  // Only states that leave on a symbol or accept tell DFA states apart, so subsets keep just those.
  const important = (q: number): boolean =>
    accept.has(q) || (bySym[q] as Map<Sym, number[]>).size > 0;

  // ε-closure of each NFA state (important states only), computed once.
  const closure = eps.map((_, q) => {
    const seen = new Set([q]);
    const stack = [q];
    while (stack.length > 0) {
      for (const next of eps[stack.pop() as number] as number[]) {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    return [...seen].filter(important);
  });

  // Subsets are bitsets over the important states, numbered densely.
  const dense = new Int32Array(n).fill(-1);
  let m = 0;
  for (let q = 0; q < n; q++) if (important(q)) dense[q] = m++;
  const words = Math.max(1, Math.ceil(m / 32));
  const bitsOf = (qs: number[]): Uint32Array => {
    const bits = new Uint32Array(words);
    for (const q of qs) {
      const i = dense[q] as number;
      bits[i >>> 5] = (bits[i >>> 5] as number) | (1 << (i & 31));
    }
    return bits;
  };
  const closureBits = closure.map(bitsOf);
  const orInto = (into: Uint32Array, from: Uint32Array): void => {
    for (let j = 0; j < words; j++) into[j] = (into[j] as number) | (from[j] as number);
  };

  // For each important state and symbol: the states reached, ε-closed, as one bitset.
  const moveBits: (Uint32Array | undefined)[][] = Array.from({ length: m }, () => []);
  for (let q = 0; q < n; q++) {
    const i = dense[q] as number;
    if (i < 0) continue;
    nfa.alphabet.forEach((sym, c) => {
      const targets = (bySym[q] as Map<Sym, number[]>).get(sym);
      if (targets === undefined) return;
      const bits = new Uint32Array(words);
      for (const to of targets) orInto(bits, closureBits[to] as Uint32Array);
      (moveBits[i] as (Uint32Array | undefined)[])[c] = bits;
    });
  }
  const acceptBits = bitsOf([...accept]);

  const starts = new Uint32Array(words);
  for (const id of startStates(nfa))
    orInto(starts, closureBits[index.get(id) as number] as Uint32Array);

  const sets: Uint32Array[] = [];
  const ids = new Map<string, number>();
  const add = (set: Uint32Array): number | null => {
    const key = set.join(',');
    const known = ids.get(key);
    if (known !== undefined) return known;
    if (sets.length >= MAX_SUBSET_STATES) return null;
    ids.set(key, sets.length);
    sets.push(set);
    return sets.length - 1;
  };
  add(starts);

  const delta: number[][] = [];
  for (let head = 0; head < sets.length; head++) {
    const set = sets[head] as Uint32Array;
    const row: number[] = [];
    for (let c = 0; c < nfa.alphabet.length; c++) {
      const next = new Uint32Array(words);
      set.forEach((word, k) => {
        for (let w = word; w !== 0; w &= w - 1) {
          const i = (k << 5) + (31 - Math.clz32(w & -w));
          const bits = (moveBits[i] as (Uint32Array | undefined)[])[c];
          if (bits !== undefined) orInto(next, bits);
        }
      });
      const target = add(next);
      if (target === null) return null;
      row.push(target);
    }
    delta.push(row);
  }
  return {
    delta,
    accepting: sets.map((set) => set.some((word, k) => (word & (acceptBits[k] as number)) !== 0)),
  };
}

/** Hopcroft's partition refinement: the equivalence class of each state. */
function refine(table: Table): { classOf: number[]; count: number } {
  const { delta, accepting } = table;
  const n = delta.length;
  const k = (delta[0] ?? []).length;
  const inverse: number[][][] = Array.from({ length: k }, () =>
    Array.from({ length: n }, () => []),
  );
  delta.forEach((row, p) => row.forEach((t, c) => (inverse[c]?.[t] as number[]).push(p)));

  const blocks: number[][] = [
    accepting.flatMap((a, q) => (a ? [q] : [])),
    accepting.flatMap((a, q) => (a ? [] : [q])),
  ].filter((b) => b.length > 0);
  const blockOf: number[] = new Array<number>(n).fill(0);
  blocks.forEach((b, i) => b.forEach((q) => (blockOf[q] = i)));

  const work: [number, number][] = [];
  const queued = new Set<number>();
  const enqueue = (b: number, c: number): void => {
    work.push([b, c]);
    queued.add(b * k + c);
  };
  if (blocks.length === 2) {
    const smaller = (blocks[0] as number[]).length <= (blocks[1] as number[]).length ? 0 : 1;
    for (let c = 0; c < k; c++) enqueue(smaller, c);
  }

  while (work.length > 0) {
    const [a, c] = work.pop() as [number, number];
    queued.delete(a * k + c);
    const hit = new Map<number, number[]>();
    for (const t of blocks[a] as number[]) {
      for (const p of (inverse[c] as number[][])[t] as number[]) {
        const y = blockOf[p] as number;
        const list = hit.get(y);
        if (list === undefined) hit.set(y, [p]);
        else list.push(p);
      }
    }
    for (const [y, moved] of hit) {
      const members = blocks[y] as number[];
      if (moved.length === members.length) continue;
      const z = blocks.length;
      for (const p of moved) blockOf[p] = z;
      blocks[z] = moved;
      blocks[y] = members.filter((p) => blockOf[p] === y);
      for (let d = 0; d < k; d++) {
        if (queued.has(y * k + d)) enqueue(z, d);
        else enqueue((blocks[y] as number[]).length <= moved.length ? y : z, d);
      }
    }
  }
  return { classOf: blockOf, count: blocks.length };
}

/** The minimal DFA, states named q_0, q_1, … breadth-first from the start in alphabet order. */
function minimalDfa(table: Table, alphabet: Sym[], name: string): Automaton {
  const { classOf, count } = refine(table);
  const rows: number[][] = Array.from({ length: count }, () => []);
  const accepting = new Set<number>();
  table.delta.forEach((row, q) => {
    rows[classOf[q] as number] = row.map((t) => classOf[t] as number);
    if (table.accepting[q]) accepting.add(classOf[q] as number);
  });

  // The start (state 0) is class classOf[0]; every state is reachable, so BFS numbers them all.
  const order = [classOf[0] as number];
  for (let head = 0; head < order.length; head++) {
    for (const t of rows[order[head] as number] as number[]) {
      if (!order.includes(t)) order.push(t);
    }
  }
  const position = new Map(order.map((c, i) => [c, i]));
  const ids = order.map(() => newId());

  const edges = new Map<string, Transition>();
  order.forEach((c, i) => {
    (rows[c] as number[]).forEach((t, k) => {
      const j = position.get(t) as number;
      const key = `${i}>${j}`;
      const edge = edges.get(key) ?? {
        id: newId(),
        from: ids[i] as StateId,
        to: ids[j] as StateId,
        symbols: [],
      };
      edge.symbols.push(alphabet[k] as Sym);
      edges.set(key, edge);
    });
  });

  return {
    id: newId(),
    name,
    kind: 'DFA',
    alphabet: [...alphabet],
    states: order.map((_, i) => ({ id: ids[i] as StateId, label: `q_${i}`, x: 0, y: 0 })),
    starts: [ids[0] as StateId],
    accepting: order.flatMap((c, i) => (accepting.has(c) ? [ids[i] as StateId] : [])),
    transitions: [...edges.values()],
  };
}

/** The minimal DFA for a regex, or the reason it can't be built. */
function build(input: string): { ok: true; dfa: Automaton } | { ok: false; error: string } {
  if ([...normalizeRegexText(input)].length > MAX_REGEX_INPUT) {
    return { ok: false, error: `Too long: at most ${MAX_REGEX_INPUT} characters` };
  }
  const parsed = parseRegex(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const nfa = thompsonNfa(parsed.regex);
  const table = subsetTable(nfa);
  if (table === null) return { ok: false, error: TOO_BIG };
  const dfa = minimalDfa(table, nfa.alphabet, nfa.name);
  if (dfa.states.length > MAX_DFA_STATES) return { ok: false, error: TOO_BIG };
  return { ok: true, dfa };
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
