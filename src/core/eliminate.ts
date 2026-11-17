import { labelPlainText } from './label';
import { EPSILON, startStates } from './model';
import type { Automaton, State, StateId, Transition } from './model';
import { EMPTY_SET, isRegexSymbol, printRegex, quoteRegex } from './regex';
import type { Regex } from './regex';
import { EMPTY, EPS, mkConcat, mkStar, mkSym, mkUnion } from './regexSimplify';
import type { EliminateStep, EliminateTrace } from './trace';

export const MAX_REGEX_LENGTH = 2000;
export const GNFA_START = 'gnfa-s';
export const GNFA_ACCEPT = 'gnfa-f';

const MARGIN = 120;
const MAX_FORMULAS = 3;

/** Why `a` can't be turned into a regex, or null when it can. */
export function canEliminate(a: Automaton): string | null {
  if (a.states.length === 0) return 'Nothing to convert: add a state first';
  if (startStates(a).length === 0) return 'Set a start state first';
  const used = [...a.alphabet, ...a.transitions.flatMap((t) => t.symbols)];
  const bad = used.find((s) => s !== EPSILON && !isRegexSymbol(s));
  if (bad !== undefined) return `To regex can't write the symbol '${bad}': rename it`;
  return null;
}

interface Arrow {
  from: StateId;
  to: StateId;
  label: Regex;
}

const key = (from: StateId, to: StateId): string => `${from}>${to}`;

/** `s`, `s'`, `s''`, … : the first of these that no state of `a` is labelled. */
function freshLabel(a: Automaton, base: string): string {
  const taken = new Set(a.states.map((s) => s.label));
  let label = base;
  while (taken.has(label)) label += "'";
  return label;
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function joinParts(parts: string[], more: number): string {
  return more > 0 ? `${parts.join('; ')}; and ${more} more` : parts.join('; ');
}

/**
 * Turns `a` into a regex by state elimination on a GNFA, as an eagerly computed trace. `order` is
 * a prefix of the states to remove first; the rest follow the automatic order (fewest new arrows).
 * Throws the reason when `canEliminate` refuses, or when a label grows past MAX_REGEX_LENGTH.
 */
export function eliminate(a: Automaton, order: StateId[] = []): EliminateTrace {
  const reason = canEliminate(a);
  if (reason !== null) throw new Error(reason);

  const ids = new Set(a.states.map((s) => s.id));
  const original = (id: StateId): State => a.states.find((s) => s.id === id) as State;
  const text = (id: StateId): string => {
    if (id === GNFA_START) return sLabel;
    if (id === GNFA_ACCEPT) return fLabel;
    return labelPlainText(original(id).label);
  };
  const sLabel = freshLabel(a, 's');
  const fLabel = freshLabel(a, 'f');

  // Positions: s left of everything at the start states' height, f right at the accepting ones'.
  const starts = startStates(a);
  const accepting = a.accepting.filter((id) => ids.has(id));
  const xs = a.states.map((s) => s.x);
  const meanY = (list: StateId[]): number =>
    mean((list.length > 0 ? list.map((id) => original(id)) : a.states).map((s) => s.y));
  const sState: State = {
    id: GNFA_START,
    label: sLabel,
    x: Math.min(...xs) - MARGIN,
    y: meanY(starts),
  };
  const fState: State = {
    id: GNFA_ACCEPT,
    label: fLabel,
    x: Math.max(...xs) + MARGIN,
    y: meanY(accepting),
  };

  // The labels: one Arrow per (from, to) pair, in insertion order.
  const arrows = new Map<string, Arrow>();
  const set = (from: StateId, to: StateId, label: Regex): void => {
    if (label.type === 'empty') arrows.delete(key(from, to));
    else arrows.set(key(from, to), { from, to, label });
  };
  const get = (from: StateId, to: StateId): Regex | undefined => arrows.get(key(from, to))?.label;

  for (const t of a.transitions) {
    let label: Regex = EMPTY;
    for (const sym of t.symbols) label = mkUnion(label, sym === EPSILON ? EPS : mkSym(sym));
    set(t.from, t.to, label);
  }
  for (const id of starts) set(GNFA_START, id, EPS);
  for (const id of accepting) set(id, GNFA_ACCEPT, EPS);

  let remaining = a.states.map((s) => s.id);
  let removed: StateId[] = [];

  // The student's shaping of each original arrow, kept on the GNFA arrow of the same pair (even
  // once its label changes); arrows to or from s and f, and pairs made by a removal, get none.
  const shapes = new Map<string, Pick<Transition, 'bend' | 'loopAngle' | 'labelSide'>>();
  for (const t of a.transitions) {
    const shape: Pick<Transition, 'bend' | 'loopAngle' | 'labelSide'> = {};
    if (t.bend !== undefined) shape.bend = t.bend;
    if (t.loopAngle !== undefined) shape.loopAngle = t.loopAngle;
    if (t.labelSide !== undefined) shape.labelSide = t.labelSide;
    shapes.set(key(t.from, t.to), shape);
  }

  const snapshot = (): Automaton => {
    const transitions: Transition[] = [...arrows.values()].map((r) => ({
      id: `${r.from}->${r.to}`,
      from: r.from,
      to: r.to,
      symbols: [printRegex(r.label)],
      ...shapes.get(key(r.from, r.to)),
    }));
    return {
      id: a.id,
      name: a.name,
      kind: 'NFA',
      alphabet: [],
      states: [sState, ...a.states.filter((s) => remaining.includes(s.id)), fState],
      starts: [GNFA_START],
      accepting: [GNFA_ACCEPT],
      transitions,
    };
  };

  const incoming = (q: StateId): Arrow[] =>
    [...arrows.values()].filter((r) => r.to === q && r.from !== q);
  const outgoing = (q: StateId): Arrow[] =>
    [...arrows.values()].filter((r) => r.from === q && r.to !== q);

  const incident = (q: StateId): Arrow[] =>
    [...arrows.values()].filter((r) => r.from === q || r.to === q);

  const steps: EliminateStep[] = [];
  steps.push({
    phase: 'gnfa',
    automaton: snapshot(),
    removed: [],
    focus: { states: [GNFA_START, GNFA_ACCEPT] },
    explanation:
      `Add a start state ${sLabel} and an accepting state ${fLabel}. ` +
      'Arrows with several symbols become one label joined by |, and a missing arrow counts as ∅.',
  });

  // The forced prefix: known original states only, each once.
  const forced = [...new Set(order)].filter((id) => ids.has(id));
  const finalOrder: StateId[] = [];

  const autoPick = (): StateId => {
    let best = remaining[0] as StateId;
    let bestScore: [number, number] | null = null;
    for (const q of remaining) {
      const score: [number, number] = [
        incoming(q).length * outgoing(q).length,
        incident(q).reduce((sum, r) => sum + printRegex(r.label).length, 0),
      ];
      if (
        bestScore === null ||
        score[0] < bestScore[0] ||
        (score[0] === bestScore[0] && score[1] < bestScore[1])
      ) {
        best = q;
        bestScore = score;
      }
    }
    return best;
  };

  while (remaining.length > 0) {
    const q = forced.length > 0 ? (forced.shift() as StateId) : autoPick();
    finalOrder.push(q);
    const ins = incoming(q);
    const outs = outgoing(q);
    const loop = get(q, q);

    // pick
    const paths = ins.flatMap((i) =>
      outs.map((o) => `${text(i.from)} → ${text(q)} → ${text(o.to)}`),
    );
    const shown = paths.slice(0, MAX_FORMULAS);
    let pickText =
      paths.length === 0
        ? `Remove ${text(q)}: no path goes through it, so nothing changes.`
        : `Remove ${text(q)}. Paths through it: ${joinParts(shown, paths.length - shown.length)}.`;
    if (remaining.length > 1) pickText += ' Click another state to remove it first instead.';
    steps.push({
      phase: 'pick',
      automaton: snapshot(),
      removing: q,
      removed: [...removed],
      focus: { states: [q], transitions: incident(q).map((r) => `${r.from}->${r.to}`) },
      explanation: pickText,
    });

    // remove
    const through = mkStar(loop ?? EMPTY);
    const pending: [StateId, StateId, Regex][] = [];
    const formulas: string[] = [];
    for (const i of ins) {
      for (const o of outs) {
        const via = mkConcat(mkConcat(i.label, through), o.label);
        const next = mkUnion(get(i.from, o.to) ?? EMPTY, via);
        const printed = printRegex(next);
        if (printed.length > MAX_REGEX_LENGTH) {
          throw new Error(
            `The regex grows past ${MAX_REGEX_LENGTH} characters: try a smaller automaton`,
          );
        }
        // Applied after all pairs are read: every formula uses the labels from before q went.
        formulas.push(`${text(i.from)} → ${text(o.to)}: ${quoteRegex(printed)}`);
        pending.push([i.from, o.to, next]);
      }
    }
    for (const r of incident(q)) arrows.delete(key(r.from, r.to));
    for (const [from, to, label] of pending) set(from, to, label);
    remaining = remaining.filter((id) => id !== q);
    removed = [...removed, q];
    const changedIds = pending.map(([from, to]) => `${from}->${to}`);
    const fShown = formulas.slice(0, MAX_FORMULAS);
    steps.push({
      phase: 'remove',
      automaton: snapshot(),
      removed: [...removed],
      changed: changedIds,
      focus: { transitions: changedIds },
      explanation:
        formulas.length === 0
          ? `${text(q)} is gone; no arrow needed to change.`
          : `${text(q)} is gone. New labels: ${joinParts(fShown, formulas.length - fShown.length)}.`,
    });
  }

  const regex = arrows.get(key(GNFA_START, GNFA_ACCEPT));
  const printed = regex ? printRegex(regex.label) : EMPTY_SET;
  steps.push({
    phase: 'done',
    automaton: snapshot(),
    removed: [...removed],
    focus: {
      states: [GNFA_START, GNFA_ACCEPT],
      transitions: regex ? [`${GNFA_START}->${GNFA_ACCEPT}`] : [],
    },
    regex: printed,
    explanation: `Only ${sLabel} → ${fLabel} is left: its label is the regex.${
      regex ? '' : ' No arrow is left, so it is ∅.'
    }`,
  });

  return { kind: 'eliminate', source: a, steps, order: finalOrder, regex: printed };
}
