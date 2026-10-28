import { nextStateLabel } from './edit';
import { newId } from './id';
import { EPSILON } from './model';
import type { Automaton, StateId, Sym } from './model';

function inOrder(a: Automaton, set: ReadonlySet<StateId>): StateId[] {
  return a.states.filter((s) => set.has(s.id)).map((s) => s.id);
}

export function epsilonClosure(a: Automaton, ids: Iterable<StateId>): StateId[] {
  const seen = new Set<StateId>(ids);
  const stack = [...seen];
  while (stack.length > 0) {
    const cur = stack.pop();
    for (const t of a.transitions) {
      if (t.from === cur && t.symbols.includes(EPSILON) && !seen.has(t.to)) {
        seen.add(t.to);
        stack.push(t.to);
      }
    }
  }
  return inOrder(a, seen);
}

export function move(a: Automaton, ids: Iterable<StateId>, sym: Sym): StateId[] {
  const from = new Set(ids);
  const out = new Set<StateId>();
  for (const t of a.transitions) {
    if (from.has(t.from) && t.symbols.includes(sym)) out.add(t.to);
  }
  return inOrder(a, out);
}

export function transitionsTaken(a: Automaton, ids: Iterable<StateId>, sym: Sym): string[] {
  const from = new Set(ids);
  return a.transitions.filter((t) => from.has(t.from) && t.symbols.includes(sym)).map((t) => t.id);
}

export function reachableStates(a: Automaton): StateId[] {
  if (a.start === null || !a.states.some((s) => s.id === a.start)) return [];
  const seen = new Set<StateId>([a.start]);
  const stack: StateId[] = [a.start];
  while (stack.length > 0) {
    const cur = stack.pop();
    for (const t of a.transitions) {
      if (t.from === cur && !seen.has(t.to)) {
        seen.add(t.to);
        stack.push(t.to);
      }
    }
  }
  return inOrder(a, seen);
}

export function removeUnreachable(a: Automaton): { automaton: Automaton; removed: StateId[] } {
  if (a.start === null) return { automaton: a, removed: [] };
  const keep = new Set(reachableStates(a));
  const removed = a.states.filter((s) => !keep.has(s.id)).map((s) => s.id);
  if (removed.length === 0) return { automaton: a, removed };
  return {
    automaton: {
      ...a,
      states: a.states.filter((s) => keep.has(s.id)),
      accepting: a.accepting.filter((id) => keep.has(id)),
      transitions: a.transitions.filter((t) => keep.has(t.from) && keep.has(t.to)),
    },
    removed,
  };
}

function missingSymbols(a: Automaton, id: StateId): Sym[] {
  return a.alphabet.filter(
    (sym) => !a.transitions.some((t) => t.from === id && t.symbols.includes(sym)),
  );
}

export function isComplete(a: Automaton): boolean {
  return a.states.every((s) => missingSymbols(a, s.id).length === 0);
}

export function completeWithDeadState(a: Automaton): {
  automaton: Automaton;
  deadState: StateId | null;
} {
  if (a.states.length === 0 || a.alphabet.length === 0 || isComplete(a)) {
    return { automaton: a, deadState: null };
  }
  const deadId = newId();
  const taken = a.states.some((s) => s.label === '∅');
  const label = taken ? nextStateLabel(a) : '∅';
  const x = Math.max(...a.states.map((s) => s.x)) + 120;
  const y = a.states.reduce((sum, s) => sum + s.y, 0) / a.states.length;
  const added = a.states
    .map((s) => ({ s, syms: missingSymbols(a, s.id) }))
    .filter(({ syms }) => syms.length > 0)
    .map(({ s, syms }) => ({ id: newId(), from: s.id, to: deadId, symbols: syms }));
  return {
    automaton: {
      ...a,
      states: [...a.states, { id: deadId, label, x, y }],
      transitions: [
        ...a.transitions,
        ...added,
        { id: newId(), from: deadId, to: deadId, symbols: [...a.alphabet] },
      ],
    },
    deadState: deadId,
  };
}

export function accepts(a: Automaton, word: string): boolean {
  if (a.start === null || !a.states.some((s) => s.id === a.start)) return false;
  let current = epsilonClosure(a, [a.start]);
  for (const ch of [...word]) {
    current = epsilonClosure(a, move(a, current, ch));
    if (current.length === 0) return false;
  }
  return current.some((id) => a.accepting.includes(id));
}
