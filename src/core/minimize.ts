import { completeWithDeadState, removeUnreachable } from './analysis';
import { formatSet, withSuffix } from './format';
import { newId } from './id';
import { startStates } from './model';
import type { Automaton, State, StateId, Sym, Transition } from './model';
import type { MinimizeStep, MinimizeTrace } from './trace';
import { hasErrors, ignoringIncomplete, validate } from './validate';

/** Why `a` can't be minimized, or null when it can. */
export function canMinimize(a: Automaton): string | null {
  if (a.kind !== 'DFA') return 'Minimization needs a DFA: use Convert to DFA first';
  if (startStates(a).length === 0) return 'Set a start state first';
  if (hasErrors(ignoringIncomplete(validate(a)))) return 'Fix the errors in the automaton first';
  return null;
}

/** Block i's name: A … Z, then AA, AB, … like spreadsheet columns. */
export function blockName(i: number): string {
  let name = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

/**
 * Labels of the result's states, block i's at i. A merged state (a block of two or more) is
 * named by its block's name, as in the walkthrough's legend: its members' labels joined would
 * not fit in a circle (`{{q_0,q_2},{q_0,q_1,q_2}}` after a subset construction). The others keep
 * their own label, unless one reads as a block name, then every state takes its block's name.
 */
export function resultLabels(memberLabels: string[][]): string[] {
  const merged = memberLabels.map((labels) => labels.length > 1);
  const names = new Set(memberLabels.flatMap((_, i) => (merged[i] ? [blockName(i)] : [])));
  const clash = memberLabels.some((labels, i) => !merged[i] && names.has(labels[0] as string));
  return memberLabels.map((labels, i) =>
    merged[i] || clash ? blockName(i) : (labels[0] as string),
  );
}

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
  const memberStates = blocks.map((block) => work.states.filter((s) => block.includes(s.id)));
  const labels = resultLabels(memberStates.map((members) => members.map((m) => m.label)));
  const states: State[] = memberStates.map((members, i) => {
    const label = labels[i] as string;
    const only = members.length === 1 ? members[0] : undefined;
    // Renamed states say what they stand for; one that kept its name keeps its own note.
    const mergedFrom = only?.label === label ? only.mergedFrom : members.map((m) => m.label);
    return {
      id: ids[i] as string,
      label,
      x: members.reduce((sum, m) => sum + m.x, 0) / members.length,
      y: members.reduce((sum, m) => sum + m.y, 0) / members.length,
      ...(mergedFrom ? { mergedFrom } : {}),
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
    starts: startStates(work).map((s) => ids[indexOf(s)] as string),
    accepting: ids.filter((_, i) =>
      (blocks[i] as StateId[]).some((q) => work.accepting.includes(q)),
    ),
    transitions,
  };
}
