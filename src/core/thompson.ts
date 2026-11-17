import { newId } from './id';
import { EPSILON } from './model';
import type { Automaton, State, StateId, Transition } from './model';
import { printRegex, regexSymbols } from './regex';
import type { Regex } from './regex';

/** The NFA Thompson's construction builds for `regex`: no size cap, every position 0. */
export function thompsonNfa(regex: Regex): Automaton {
  const states: State[] = [];
  const transitions: Transition[] = [];

  const addState = (): StateId => {
    const n = states.length;
    const id = `t${n}`;
    states.push({ id, label: `q_${n}`, x: 0, y: 0 });
    return id;
  };
  const addArrow = (from: StateId, to: StateId, sym: string): void => {
    transitions.push({ id: `${from}->${to}`, from, to, symbols: [sym] });
  };

  /** Builds the piece for `node` (inner pieces first) and returns its start and accepting state. */
  const walk = (node: Regex): { start: StateId; accept: StateId } => {
    switch (node.type) {
      case 'sym':
      case 'eps':
      case 'empty': {
        const start = addState();
        const accept = addState();
        if (node.type !== 'empty')
          addArrow(start, accept, node.type === 'sym' ? node.sym : EPSILON);
        return { start, accept };
      }
      case 'concat': {
        const l = walk(node.left);
        const r = walk(node.right);
        addArrow(l.accept, r.start, EPSILON);
        return { start: l.start, accept: r.accept };
      }
      case 'union': {
        const children = node.branches.map(walk);
        const start = addState();
        const accept = addState();
        for (const c of children) addArrow(start, c.start, EPSILON);
        for (const c of children) addArrow(c.accept, accept, EPSILON);
        return { start, accept };
      }
      case 'star':
      case 'plus': {
        const body = walk(node.body);
        const start = addState();
        const accept = addState();
        addArrow(start, body.start, EPSILON);
        addArrow(body.accept, accept, EPSILON);
        addArrow(body.accept, body.start, EPSILON);
        if (node.type === 'star') addArrow(start, accept, EPSILON);
        return { start, accept };
      }
    }
  };

  const root = walk(regex);
  return {
    id: newId(),
    name: printRegex(regex),
    kind: 'NFA',
    alphabet: regexSymbols(regex),
    states,
    starts: [root.start],
    accepting: [root.accept],
    transitions,
  };
}
