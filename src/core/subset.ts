import { epsilonClosure, move, transitionsTaken } from './analysis';
import { formatSet, withSuffix } from './format';
import { newId } from './id';
import { EPSILON, startStates } from './model';
import type { Automaton, State, StateId, Transition } from './model';
import type { SubsetStep, SubsetTrace } from './trace';
import { hasErrors, validate } from './validate';

/** Why `a` can't be converted to a DFA, or null when it can. */
export function canConvert(a: Automaton): string | null {
  if (a.kind !== 'NFA') return 'Already a DFA: Convert to DFA turns an NFA into one';
  if (startStates(a).length === 0) return 'Set a start state first';
  if (hasErrors(validate(a))) return 'Fix the errors in the automaton first';
  return null;
}

/** Largest DFA the construction will build; beyond it the walkthrough and layout are unusable. */
export const MAX_DFA_STATES = 64;

/** How far left of the leftmost old start state the added single start state sits. */
export const START_GAP = 120;

/** `q_s`, or the first of `q_s'`, `q_s''`, … that no state of `a` uses. */
function freeStartLabel(a: Automaton): string {
  const taken = new Set(a.states.map((s) => s.label));
  let label = 'q_s';
  while (taken.has(label)) label += "'";
  return label;
}

/**
 * With several start states, the standard construction: a new state becomes the only start state,
 * with an ε-transition to each old one (`added` is its id). Otherwise `nfa` is returned as is.
 */
export function withSingleStart(nfa: Automaton): { nfa: Automaton; added: StateId | null } {
  const starts = startStates(nfa);
  if (starts.length <= 1) return { nfa, added: null };
  const old = nfa.states.filter((s) => starts.includes(s.id));
  const id = newId();
  const state: State = {
    id,
    label: freeStartLabel(nfa),
    x: Math.min(...old.map((s) => s.x)) - START_GAP,
    y: old.reduce((sum, s) => sum + s.y, 0) / old.length,
  };
  const edges: Transition[] = starts.map((to) => ({
    id: newId(),
    from: id,
    to,
    symbols: [EPSILON],
  }));
  return {
    nfa: {
      ...nfa,
      states: [...nfa.states, state],
      starts: [id],
      transitions: [...nfa.transitions, ...edges],
    },
    added: id,
  };
}

/** DFA state label: "{q0,q1}" without a space, or "∅". */
function dfaLabel(nfa: Automaton, subset: StateId[]): string {
  return formatSet(nfa, subset).replaceAll(', ', ',');
}

export function subsetConstruction(original: Automaton): SubsetTrace {
  const reason = canConvert(original);
  if (reason !== null) throw new Error(reason);
  const { nfa, added } = withSingleStart(original);

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

  const starts = startStates(nfa);
  if (added !== null) {
    const label = nfa.states.find((s) => s.id === added)?.label ?? '';
    steps.push({
      phase: 'starts',
      subset: [],
      explanation: `Several start states: add a new start state ${label} with ε-transitions to ${formatSet(original, startStates(original))}`,
      focus: {
        states: [added],
        transitions: nfa.transitions.filter((t) => t.from === added).map((t) => t.id),
      },
      dfaFocus: {},
      revealedStates: [],
      revealedTransitions: [],
    });
  }

  // Without ε-arrows every closure is the set itself, so the explanations leave it out.
  const hasEpsilon = nfa.transitions.some((t) => t.symbols.includes(EPSILON));
  const startSubset = epsilonClosure(nfa, starts);
  const startEntry = addState(startSubset);
  steps.push({
    phase: 'init',
    subset: startSubset,
    explanation: hasEpsilon
      ? `Start state: ε-closure(${formatSet(nfa, starts)}) = ${formatSet(nfa, startSubset)}`
      : `Start state: ${formatSet(nfa, startSubset)}`,
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
        explanation: `${formatSet(nfa, source.subset)} on '${sym}': move = ${formatSet(nfa, moved)}${
          hasEpsilon ? `, ε-closure = ${formatSet(nfa, closure)}` : ''
        } → ${verb} state ${dfaLabel(nfa, closure)}`,
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
    name: withSuffix(nfa.name, ' → DFA'),
    kind: 'DFA',
    alphabet: [...nfa.alphabet],
    states,
    starts: [startEntry.id],
    accepting,
    transitions,
  };
  return { kind: 'subset', source: nfa, result, steps };
}
