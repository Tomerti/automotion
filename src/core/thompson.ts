import { newId } from './id';
import { EPSILON } from './model';
import type { Automaton, State, StateId, Sym, Transition } from './model';
import { parseRegex, printRegex, quoteRegex, regexSymbols } from './regex';
import type { Regex, Span } from './regex';
import { layoutPieces } from './thompsonLayout';
import type { ThompsonStep, ThompsonTrace } from './trace';

/** Largest NFA the construction will build; beyond it the walkthrough and layout are unusable. */
export const MAX_THOMPSON_STATES = 64;

/** How many states Thompson's construction makes for `r`. */
export function thompsonStateCount(r: Regex): number {
  switch (r.type) {
    case 'sym':
    case 'eps':
    case 'empty':
      return 2;
    case 'concat':
      return thompsonStateCount(r.left) + thompsonStateCount(r.right);
    case 'union':
      return r.branches.reduce((n, b) => n + thompsonStateCount(b), 2);
    case 'star':
    case 'plus':
      return thompsonStateCount(r.body) + 2;
  }
}

/** Why `input` can't be built, or null when it can. */
export function canThompson(input: string): string | null {
  const parsed = parseRegex(input);
  if (!parsed.ok) return parsed.error;
  const n = thompsonStateCount(parsed.regex);
  if (n > MAX_THOMPSON_STATES) {
    return `Too long to draw: this regex needs ${n} states (at most ${MAX_THOMPSON_STATES})`;
  }
  return null;
}

/** The small NFA built for one node of the regex. */
export interface Piece {
  node: Regex;
  start: StateId;
  accept: StateId;
  /** Every state of this piece, in creation order. */
  states: StateId[];
  children: Piece[];
}

export function thompson(input: string): ThompsonTrace {
  const reason = canThompson(input);
  if (reason !== null) throw new Error(reason);
  const parsed = parseRegex(input);
  if (!parsed.ok) throw new Error(parsed.error);
  const { regex, text } = parsed;

  const states: State[] = [];
  const transitions: Transition[] = [];
  const steps: ThompsonStep[] = [];
  const builtSpans: Span[] = [];
  const revealedStates: StateId[] = [];
  const revealedTransitions: string[] = [];

  const addState = (made: StateId[]): StateId => {
    const n = states.length;
    const id = `t${n}`;
    states.push({ id, label: `q_${n}`, x: 0, y: 0 });
    made.push(id);
    return id;
  };
  const addArrow = (from: StateId, to: StateId, sym: Sym, made: string[]): void => {
    const id = `${from}->${to}`;
    transitions.push({ id, from, to, symbols: [sym] });
    made.push(id);
  };
  const nameOf = (node: Regex): string =>
    node.span ? text.slice(node.span.start, node.span.end) : printRegex(node);

  const walk = (node: Regex): Piece => {
    const children: Piece[] = [];
    switch (node.type) {
      case 'concat':
        children.push(walk(node.left), walk(node.right));
        break;
      case 'union':
        for (const b of node.branches) children.push(walk(b));
        break;
      case 'star':
      case 'plus':
        children.push(walk(node.body));
        break;
      default:
    }

    const newStates: StateId[] = [];
    const newTransitions: string[] = [];
    const name = quoteRegex(nameOf(node));
    let start: StateId;
    let accept: StateId;
    let explanation: string;
    switch (node.type) {
      case 'sym':
        start = addState(newStates);
        accept = addState(newStates);
        addArrow(start, accept, node.sym, newTransitions);
        explanation = `${name}: a start state and an accepting state, joined by ${quoteRegex(node.sym)}.`;
        break;
      case 'eps':
        start = addState(newStates);
        accept = addState(newStates);
        addArrow(start, accept, EPSILON, newTransitions);
        explanation = `${name}: a start state and an accepting state, joined by ε.`;
        break;
      case 'empty':
        start = addState(newStates);
        accept = addState(newStates);
        explanation = `${name}: a start state and an accepting state with no arrow, so nothing is accepted.`;
        break;
      case 'concat': {
        const [l, r] = children as [Piece, Piece];
        start = l.start;
        accept = r.accept;
        addArrow(l.accept, r.start, EPSILON, newTransitions);
        explanation = `${name}: an ε-move from the accepting state of the first piece to the start of the second.`;
        break;
      }
      case 'union': {
        start = addState(newStates);
        accept = addState(newStates);
        for (const c of children) addArrow(start, c.start, EPSILON, newTransitions);
        for (const c of children) addArrow(c.accept, accept, EPSILON, newTransitions);
        const all = children.length === 2 ? 'both' : 'all';
        explanation = `${name}: a new start state with ε-moves into ${all} pieces, and ε-moves from ${all} their accepting states into a new accepting state.`;
        break;
      }
      case 'star':
      case 'plus': {
        const [body] = children as [Piece];
        start = addState(newStates);
        accept = addState(newStates);
        addArrow(start, body.start, EPSILON, newTransitions);
        addArrow(body.accept, accept, EPSILON, newTransitions);
        addArrow(body.accept, body.start, EPSILON, newTransitions);
        if (node.type === 'star') {
          addArrow(start, accept, EPSILON, newTransitions);
          explanation = `${name}: a new start and accepting state around the piece, an ε-move back to repeat, and one past it to skip.`;
        } else {
          explanation = `${name}: like star, but it must pass through the piece once, so there is no skip.`;
        }
        break;
      }
    }

    const pieceStates = [...children.flatMap((c) => c.states), ...newStates];
    if (node.span) builtSpans.push(node.span);
    revealedStates.push(...newStates);
    revealedTransitions.push(...newTransitions);
    steps.push({
      phase: 'build',
      explanation,
      focus: { states: newStates, transitions: newTransitions },
      span: node.span,
      builtSpans: [...builtSpans],
      newStates,
      newTransitions,
      pieceStates,
      pieceStart: start,
      pieceAccept: accept,
      revealedStates: [...revealedStates],
      revealedTransitions: [...revealedTransitions],
    });
    return { node, start, accept, states: pieceStates, children };
  };

  steps.push({
    phase: 'intro',
    explanation:
      'Each part of the regex becomes a small NFA with one start and one accepting state, built from the inside out.',
    focus: {},
    builtSpans: [],
    newStates: [],
    newTransitions: [],
    pieceStates: [],
    revealedStates: [],
    revealedTransitions: [],
  });

  const root = walk(regex);
  steps.push({
    phase: 'done',
    explanation: `The NFA for ${quoteRegex(text)}: the last piece built, with its one start and one accepting state.`,
    focus: { states: [root.start, root.accept], transitions: [] },
    builtSpans: [...builtSpans],
    newStates: [],
    newTransitions: [],
    pieceStates: states.map((s) => s.id),
    pieceStart: root.start,
    pieceAccept: root.accept,
    revealedStates: [...revealedStates],
    revealedTransitions: [...revealedTransitions],
  });

  const built: Automaton = {
    id: newId(),
    name: printRegex(regex),
    kind: 'NFA',
    alphabet: regexSymbols(regex),
    states,
    starts: [root.start],
    accepting: [root.accept],
    transitions,
  };
  return { kind: 'thompson', regex: text, result: layoutPieces(root, built), steps };
}
