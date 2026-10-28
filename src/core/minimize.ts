import { completeWithDeadState, removeUnreachable } from './analysis';
import { formatSet, withSuffix } from './format';
import { newId } from './id';
import type { Automaton, StateId, Sym, Transition } from './model';
import type { MinimizeStep, MinimizeTrace } from './trace';
import { hasErrors, validate } from './validate';

/** Why `a` can't be minimized, or null when it can. */
export function canMinimize(a: Automaton): string | null {
  if (a.kind !== 'DFA') return 'Minimization needs a DFA';
  if (a.start === null || !a.states.some((s) => s.id === a.start)) {
    return 'Set a start state first';
  }
  if (hasErrors(validate(a))) return 'Fix the errors in the automaton first';
  return null;
}

const blockName = (i: number): string => String.fromCharCode(65 + i);

function joinParts(parts: string[]): string {
  if (parts.length <= 2) return parts.join(' and ');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function minimize(dfa: Automaton): MinimizeTrace {
  const reason = canMinimize(dfa);
  if (reason !== null) throw new Error(reason);

  const steps: MinimizeStep[] = [];

  let work = dfa;
  const trimmed = removeUnreachable(dfa);
  if (trimmed.removed.length > 0) {
    steps.push({
      phase: 'trim',
      automaton: dfa,
      removed: trimmed.removed,
      blocks: [],
      focus: { states: trimmed.removed },
      explanation: `Remove unreachable states: ${formatSet(dfa, trimmed.removed)}`,
    });
    work = trimmed.automaton;
  }

  const completed = completeWithDeadState(work);
  if (completed.deadState !== null) {
    work = completed.automaton;
    const dead = work.states.find((s) => s.id === completed.deadState);
    steps.push({
      phase: 'complete',
      automaton: work,
      deadState: completed.deadState,
      blocks: [],
      focus: { states: [completed.deadState] },
      explanation: `Add dead state ${dead?.label ?? '∅'} for missing transitions`,
    });
  }

  const delta = new Map<string, StateId>();
  for (const t of work.transitions) {
    for (const sym of t.symbols) delta.set(`${t.from}\0${sym}`, t.to);
  }
  const target = (q: StateId, sym: Sym): StateId => delta.get(`${q}\0${sym}`) as StateId;

  const order = work.states.map((s) => s.id);
  const accepting = order.filter((id) => work.accepting.includes(id));
  const rejecting = order.filter((id) => !work.accepting.includes(id));
  let blocks: StateId[][] = [accepting, rejecting].filter((b) => b.length > 0);
  steps.push({
    phase: 'partition',
    automaton: work,
    blocks,
    focus: {},
    explanation:
      accepting.length > 0 && rejecting.length > 0
        ? `Start with accepting ${formatSet(work, accepting)} and non-accepting ${formatSet(work, rejecting)}`
        : `Start with one block ${formatSet(work, order)}`,
  });

  const blockOf = (q: StateId): number => blocks.findIndex((b) => b.includes(q));

  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i] as StateId[];
      const sig = (q: StateId): string => work.alphabet.map((s) => blockOf(target(q, s))).join(',');
      const groups = new Map<string, StateId[]>();
      for (const q of block) {
        const key = sig(q);
        groups.set(key, [...(groups.get(key) ?? []), q]);
      }
      if (groups.size < 2) continue;

      const parts = [...groups.values()];
      const p = block[0] as StateId;
      const q = block.find((x) => !(parts[0] as StateId[]).includes(x)) as StateId;
      const symbol = work.alphabet.find(
        (s) => blockOf(target(p, s)) !== blockOf(target(q, s)),
      ) as Sym;
      const x = blockOf(target(p, symbol));
      const y = blockOf(target(q, symbol));
      const label = (id: StateId): string => work.states.find((s) => s.id === id)?.label ?? id;
      const explanation =
        `${label(p)} and ${label(q)} differ on '${symbol}': ` +
        `${label(p)} → block ${blockName(x)}, ${label(q)} → block ${blockName(y)}; ` +
        `block ${blockName(i)} splits into ${joinParts(parts.map((part) => formatSet(work, part)))}`;

      blocks = [
        ...blocks.slice(0, i),
        parts[0] as StateId[],
        ...blocks.slice(i + 1),
        ...parts.slice(1),
      ];
      changed = true;
      steps.push({
        phase: 'split',
        automaton: work,
        blocks,
        focus: { states: block, transitions: [] },
        split: { block: i, parts, witness: { p, q, symbol } },
        explanation,
      });
    }
  }

  const result = buildResult(dfa, work, blocks);
  // Nothing unreachable and no two states merged: the result is the input (plus, at most, a
  // dead state), so there is nothing worth saving.
  const alreadyMinimal = trimmed.removed.length === 0 && blocks.every((b) => b.length === 1);
  steps.push({
    phase: 'done',
    automaton: work,
    blocks,
    focus: {},
    explanation: alreadyMinimal
      ? 'Already minimal: no state is unreachable and no two states are equivalent'
      : `Done: ${dfa.states.length} → ${result.states.length} states`,
  });
  return { kind: 'minimize', source: dfa, result, steps, alreadyMinimal };
}

function buildResult(dfa: Automaton, work: Automaton, blocks: StateId[][]): Automaton {
  const ids = blocks.map(() => newId());
  const indexOf = (q: StateId): number => blocks.findIndex((b) => b.includes(q));
  const states = blocks.map((block, i) => {
    const members = work.states.filter((s) => block.includes(s.id));
    return {
      id: ids[i] as string,
      label:
        members.length === 1
          ? (members[0]?.label as string)
          : `{${members.map((m) => m.label).join(',')}}`,
      x: members.reduce((sum, m) => sum + m.x, 0) / members.length,
      y: members.reduce((sum, m) => sum + m.y, 0) / members.length,
    };
  });

  const edges = new Map<string, { from: number; to: number; symbols: Set<Sym> }>();
  for (const t of work.transitions) {
    const from = indexOf(t.from);
    const to = indexOf(t.to);
    const key = `${from}>${to}`;
    const edge = edges.get(key) ?? { from, to, symbols: new Set<Sym>() };
    for (const s of t.symbols) edge.symbols.add(s);
    edges.set(key, edge);
  }
  const transitions: Transition[] = [...edges.values()].map((e) => ({
    id: newId(),
    from: ids[e.from] as string,
    to: ids[e.to] as string,
    symbols: work.alphabet.filter((s) => e.symbols.has(s)),
  }));

  return {
    id: newId(),
    name: withSuffix(dfa.name, ' (min)'),
    kind: 'DFA',
    alphabet: [...work.alphabet],
    states,
    start: ids[indexOf(work.start as StateId)] as string,
    accepting: ids.filter((_, i) =>
      (blocks[i] as StateId[]).some((q) => work.accepting.includes(q)),
    ),
    transitions,
  };
}
