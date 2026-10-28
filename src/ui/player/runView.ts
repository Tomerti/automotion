/** Pure helpers behind the run view: tape cells, token moves, dead branches and the verdict. */
import { formatSet } from '../../core/format';
import type { Automaton, StateId } from '../../core/model';
import type { RunStep, RunTrace } from '../../core/trace';

export type CellState = 'consumed' | 'current' | 'pending';

/** The tape cell this step reads (read: the symbol just consumed; stuck: the one it can't), or -1. */
export function currentCell(step: RunStep): number {
  if (step.phase === 'read') return step.position - 1;
  if (step.phase === 'stuck') return step.position;
  return -1;
}

export function cellState(step: RunStep, i: number): CellState {
  if (i === currentCell(step)) return 'current';
  return i < step.position ? 'consumed' : 'pending';
}

/**
 * Where the read head sits: on the cell being read, otherwise on the next cell to read
 * (`waiting`). Null once the whole word is consumed.
 */
export function readHead(step: RunStep, length: number): { cell: number; waiting: boolean } | null {
  const current = currentCell(step);
  if (current >= 0) return { cell: current, waiting: false };
  if (step.phase === 'verdict' || step.position >= length) return null;
  return { cell: step.position, waiting: true };
}

/** One token's trip along a taken transition. Tokens in wave k move after wave k−1 arrives. */
export interface TokenMove {
  transitionId: string;
  from: StateId;
  to: StateId;
  wave: number;
}

export interface StepMotion {
  moves: TokenMove[];
  /** Number of waves (≥ 1). */
  waves: number;
  /** Branches that die on this step: they show a fading ✕. */
  dead: StateId[];
  /** States lit while wave `w` is moving is `litBefore[w]`. */
  litBefore: StateId[][];
}

/** States of `step.before` that have no taken transition out of them (read and stuck steps). */
export function deadBranches(a: Automaton, step: RunStep): StateId[] {
  if (step.phase === 'stuck') return [...step.before];
  if (step.phase !== 'read') return [];
  const taken = new Set(step.taken);
  const live = new Set(a.transitions.filter((t) => taken.has(t.id)).map((t) => t.from));
  return step.before.filter((id) => !live.has(id));
}

/**
 * How a step animates when it is reached by a single step forward, or null when it doesn't move
 * anything. A read moves one token along each taken edge at once (the tokens leave their states,
 * so nothing is lit until they land). An ε-closure moves tokens outward in waves of
 * breadth-first depth from the states it starts from, which stay lit.
 */
export function stepMotion(a: Automaton, step: RunStep): StepMotion | null {
  if (step.phase !== 'read' && step.phase !== 'closure') return null;
  const byId = new Map(a.transitions.map((t) => [t.id, t]));
  const taken = step.taken.flatMap((id) => {
    const t = byId.get(id);
    return t ? [t] : [];
  });

  if (step.phase === 'read') {
    const moves = taken.map((t) => ({ transitionId: t.id, from: t.from, to: t.to, wave: 0 }));
    const dead = deadBranches(a, step);
    if (moves.length === 0 && dead.length === 0) return null;
    return { moves, waves: 1, dead, litBefore: [[]] };
  }

  // Breadth-first depth of every state the closure reaches over its taken ε-edges.
  const depth = new Map<StateId, number>(step.before.map((id) => [id, 0]));
  let frontier = [...step.before];
  for (let d = 1; frontier.length > 0; d++) {
    const next: StateId[] = [];
    for (const t of taken) {
      if (frontier.includes(t.from) && !depth.has(t.to)) {
        depth.set(t.to, d);
        next.push(t.to);
      }
    }
    frontier = next;
  }
  // Only edges that bring a state in, one level further out; the rest just light up.
  const moves = taken.flatMap((t) => {
    const df = depth.get(t.from);
    return df !== undefined && depth.get(t.to) === df + 1
      ? [{ transitionId: t.id, from: t.from, to: t.to, wave: df }]
      : [];
  });
  if (moves.length === 0) return null;
  const waves = Math.max(...moves.map((m) => m.wave)) + 1;
  const litBefore = Array.from({ length: waves }, (_, w) =>
    step.active.filter((id) => (depth.get(id) ?? Infinity) <= w),
  );
  return { moves, waves, dead: [], litBefore };
}

/** States the token(s) rest on once a step has played out. */
export function restingStates(step: RunStep): StateId[] {
  return step.phase === 'stuck' ? step.before : step.active;
}

const labelOf = (a: Automaton, id: StateId): string =>
  a.states.find((s) => s.id === id)?.label ?? id;

/** `ids` in the order of `a.states`, as labels. */
const labelsOf = (a: Automaton, ids: StateId[]): string[] =>
  a.states.filter((s) => ids.includes(s.id)).map((s) => s.label);

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] as string}`;
}

/**
 * One line saying why the run accepted or rejected, with raw labels (render it with LabelText):
 * "Ended in accepting state q_2", "Stuck: no 'b' transition from q_1", …
 */
export function verdictReason(trace: RunTrace): string {
  const a = trace.source;
  const last = trace.steps[trace.steps.length - 1];
  if (!last) return '';
  if (last.phase === 'stuck') {
    const sym = last.symbol ?? '';
    const from = last.before;
    return from.length === 1
      ? `Stuck: no '${sym}' transition from ${labelOf(a, from[0] as StateId)}`
      : `Stuck: no '${sym}' transition from any of ${formatSet(a, from)}`;
  }
  const final = last.active;
  const accepting = labelsOf(
    a,
    final.filter((id) => a.accepting.includes(id)),
  );
  if (final.length === 1) {
    const only = labelOf(a, final[0] as StateId);
    return accepting.length > 0
      ? `Ended in accepting state ${only}`
      : `Ended in ${only}, which is not accepting`;
  }
  if (accepting.length === 0)
    return `None of the active states ${formatSet(a, final)} is accepting`;
  return `Ended in ${formatSet(a, final)}; ${joinAnd(accepting)} ${accepting.length === 1 ? 'is' : 'are'} accepting`;
}
