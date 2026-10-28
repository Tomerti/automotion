import { epsilonClosure, move, transitionsTaken } from './analysis';
import { formatSet } from './format';
import { newId } from './id';
import type { Automaton, State, StateId, Transition } from './model';
import type { SubsetStep, SubsetTrace } from './trace';
import { hasErrors, validate } from './validate';

/** Why `a` can't be converted to a DFA, or null when it can. */
export function canConvert(a: Automaton): string | null {
  if (a.kind !== 'NFA') return 'Conversion needs an NFA';
  if (a.start === null || !a.states.some((s) => s.id === a.start)) {
    return 'Set a start state first';
  }
  if (hasErrors(validate(a))) return 'Fix the errors in the automaton first';
  return null;
}

/** Largest DFA the construction will build; beyond it the walkthrough and layout are unusable. */
export const MAX_DFA_STATES = 64;

/** DFA state label: "{q0,q1}" without a space, or "∅". */
function dfaLabel(nfa: Automaton, subset: StateId[]): string {
  return formatSet(nfa, subset).replaceAll(', ', ',');
}

export function subsetConstruction(nfa: Automaton): SubsetTrace {
  const reason = canConvert(nfa);
  if (reason !== null) throw new Error(reason);

  const states: State[] = [];
  const transitions: Transition[] = [];
  const accepting: StateId[] = [];
  const steps: SubsetStep[] = [];
  const byKey = new Map<string, { id: StateId; subset: StateId[] }>();
  const edgeByPair = new Map<string, Transition>();
  const revealedStates: StateId[] = [];
  const revealedTransitions: string[] = [];

  const addState = (subset: StateId[]): { id: StateId; subset: StateId[] } => {
    if (states.length >= MAX_DFA_STATES) {
      throw new Error(`Conversion stopped: the DFA would have more than ${MAX_DFA_STATES} states`);
    }
    const entry = { id: newId(), subset };
    byKey.set(subset.join('|'), entry);
    states.push({ id: entry.id, label: dfaLabel(nfa, subset), x: 0, y: 0 });
    if (subset.some((id) => nfa.accepting.includes(id))) accepting.push(entry.id);
    revealedStates.push(entry.id);
    return entry;
  };

  const startSubset = epsilonClosure(nfa, [nfa.start as StateId]);
  const startEntry = addState(startSubset);
  steps.push({
    phase: 'init',
    subset: startSubset,
    explanation: `Start state: ε-closure(${formatSet(nfa, [nfa.start as StateId])}) = ${formatSet(nfa, startSubset)}`,
    focus: { states: startSubset },
    dfaFocus: { states: [startEntry.id] },
    revealedStates: [...revealedStates],
    revealedTransitions: [...revealedTransitions],
  });

  const queue = [startEntry];
  for (let head = 0; head < queue.length; head++) {
    const source = queue[head] as { id: StateId; subset: StateId[] };
    for (const sym of nfa.alphabet) {
      const moved = move(nfa, source.subset, sym);
      const closure = epsilonClosure(nfa, moved);
      const key = closure.join('|');
      let target = byKey.get(key);
      const isNew = target === undefined;
      if (target === undefined) {
        target = addState(closure);
        queue.push(target);
      }

      const pair = `${source.id}|${target.id}`;
      let edge = edgeByPair.get(pair);
      if (edge === undefined) {
        edge = { id: newId(), from: source.id, to: target.id, symbols: [] };
        edgeByPair.set(pair, edge);
        transitions.push(edge);
        revealedTransitions.push(edge.id);
      }
      edge.symbols.push(sym);

      const verb = isNew ? 'new' : 'existing';
      steps.push({
        phase: 'expand',
        subset: source.subset,
        symbol: sym,
        moved,
        closure,
        target: target.id,
        isNew,
        explanation: `${formatSet(nfa, source.subset)} on '${sym}': move = ${formatSet(nfa, moved)}, ε-closure = ${formatSet(nfa, closure)} → ${verb} state ${dfaLabel(nfa, closure)}`,
        focus: {
          states: source.subset,
          transitions: transitionsTaken(nfa, source.subset, sym),
        },
        dfaFocus: { states: [source.id, target.id], transitions: [edge.id] },
        revealedStates: [...revealedStates],
        revealedTransitions: [...revealedTransitions],
      });
    }
  }

  steps.push({
    phase: 'done',
    subset: [],
    explanation: `Done: ${states.length} DFA states`,
    focus: {},
    dfaFocus: {},
    revealedStates: [...revealedStates],
    revealedTransitions: [...revealedTransitions],
  });

  const result: Automaton = {
    id: newId(),
    name: `${nfa.name} → DFA`,
    kind: 'DFA',
    alphabet: [...nfa.alphabet],
    states,
    start: startEntry.id,
    accepting,
    transitions,
  };
  return { kind: 'subset', source: nfa, result, steps };
}
