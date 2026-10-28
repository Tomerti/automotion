import { epsilonClosure, move, transitionsTaken } from './analysis';
import { normalizeSymbolText } from './edit';
import { formatSet } from './format';
import { EPSILON } from './model';
import type { Automaton, StateId } from './model';
import type { RunStep, RunTrace } from './trace';
import { hasErrors, validate } from './validate';

/**
 * The word to run for what the user typed: `\epsilon` reads as ε, and ε is the empty word, so
 * `ε` runs the empty word and `aεb` runs `ab`.
 */
export function readWord(text: string): string {
  return normalizeSymbolText(text).replaceAll(EPSILON, '');
}

/** Why `word` can't be run on `a`, or null when it can. */
export function canRun(a: Automaton, word: string): string | null {
  if (a.start === null || !a.states.some((s) => s.id === a.start)) {
    return 'Set a start state first';
  }
  if (hasErrors(validate(a))) return 'Fix the errors in the automaton first';
  for (const ch of [...word]) {
    if (!a.alphabet.includes(ch)) {
      return `'${ch}' is not in the alphabet {${a.alphabet.join(', ')}}`;
    }
  }
  return null;
}

/** ε-transitions that lead from the closed set into states the closure added. */
function closureTaken(a: Automaton, before: StateId[], closed: StateId[]): string[] {
  const old = new Set(before);
  const inClosed = new Set(closed);
  return a.transitions
    .filter(
      (t) =>
        t.symbols.includes(EPSILON) && inClosed.has(t.from) && inClosed.has(t.to) && !old.has(t.to),
    )
    .map((t) => t.id);
}

export function runWord(a: Automaton, word: string): RunTrace {
  const reason = canRun(a, word);
  if (reason !== null) throw new Error(reason);

  const steps: RunStep[] = [];
  const push = (step: Omit<RunStep, 'focus'>): void => {
    steps.push({ ...step, focus: { states: step.active, transitions: step.taken } });
  };
  const finish = (accepted: boolean): RunTrace => ({
    kind: 'run',
    source: a,
    word,
    steps,
    accepted,
  });

  const isNfa = a.kind === 'NFA';
  const startSet = [a.start as StateId];
  push({
    phase: 'start',
    position: 0,
    before: [],
    active: startSet,
    taken: [],
    explanation: `Start: ${formatSet(a, startSet)}`,
  });

  // Adds a closure step when closing `set` grows it; returns the closed set.
  const close = (set: StateId[], position: number): StateId[] => {
    if (!isNfa) return set;
    const closed = epsilonClosure(a, set);
    if (closed.length === set.length) return set;
    push({
      phase: 'closure',
      position,
      before: set,
      active: closed,
      taken: closureTaken(a, set, closed),
      explanation: `ε-closure: ${formatSet(a, set)} → ${formatSet(a, closed)}`,
    });
    return closed;
  };
  let current = close(startSet, 0);

  const symbols = [...word];
  for (const [i, sym] of symbols.entries()) {
    const next = move(a, current, sym);
    if (next.length === 0) {
      push({
        phase: 'stuck',
        position: i,
        symbol: sym,
        before: current,
        active: [],
        taken: [],
        verdict: 'reject',
        explanation: `Stuck on '${sym}': no transition from ${formatSet(a, current)} → reject`,
      });
      return finish(false);
    }
    push({
      phase: 'read',
      position: i + 1,
      symbol: sym,
      before: current,
      active: next,
      taken: transitionsTaken(a, current, sym),
      explanation: `Read '${sym}': ${formatSet(a, current)} → ${formatSet(a, next)}`,
    });
    current = close(next, i + 1);
  }

  const accepted = current.some((id) => a.accepting.includes(id));
  push({
    phase: 'verdict',
    position: symbols.length,
    before: current,
    active: current,
    taken: [],
    verdict: accepted ? 'accept' : 'reject',
    explanation: accepted
      ? `Accept: ${formatSet(a, current)} contains an accepting state`
      : `Reject: no accepting state in ${formatSet(a, current)}`,
  });
  return finish(accepted);
}
