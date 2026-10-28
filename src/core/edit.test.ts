import { describe, expect, it } from 'vitest';
import {
  addAlphabetSymbol,
  addState,
  addSymbolToEdge,
  commitEdgeSymbols,
  moveState,
  nextStateLabel,
  normalizeSymbolText,
  parseSymbolInput,
  removeAlphabetSymbol,
  removeState,
  toggleStart,
  removeSymbolFromEdge,
  removeTransition,
  renameAlphabetSymbol,
  renameAutomaton,
  renameState,
  setEdgeBend,
  setEdgeSymbols,
  setKind,
  setLoopAngle,
  setStart,
  syncAlphabet,
  toggleAccepting,
} from './edit';
import type { Automaton } from './model';
import { fixture } from './testing/fixtures';

const dfa = () =>
  fixture({
    kind: 'DFA',
    alphabet: 'ab',
    states: ['q0', 'q1'],
    start: 'q0',
    accepting: ['q1'],
    edges: [
      ['q0', 'a', 'q1'],
      ['q0', 'b', 'q0'],
      ['q1', 'ab', 'q1'],
    ],
  });

const base = () => fixture({ kind: 'NFA', alphabet: 'ab', states: ['q0', 'q1'], start: 'q0' });
const edge = (a: Automaton, from: string, to: string) =>
  a.transitions.find((t) => t.from === from && t.to === to);

describe('states', () => {
  it('labels new states with the lowest free index', () => {
    const a = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0', 'q2'] });
    const b = fixture({ kind: 'DFA', alphabet: 'a', states: ['q_0', 'q_2'] });
    expect(nextStateLabel(a)).toBe('q_0');
    expect(nextStateLabel(b)).toBe('q_1');
    expect(addState(b, { x: 0, y: 0 }, 'n').states.find((s) => s.id === 'n')?.label).toBe('q_1');
  });

  it('addState defaults to a fresh id and sets the position', () => {
    const s = addState(base(), { x: 5, y: 6 }).states[2];
    expect(s).toMatchObject({ label: 'q_0', x: 5, y: 6 });
    expect(s?.id).toBeTruthy();
  });

  it('removing the start state clears start and accepting and its edges', () => {
    const a = removeState({ ...dfa(), accepting: ['q0', 'q1'] }, 'q0');
    expect(a.starts).toEqual([]);
    expect(a.accepting).toEqual(['q1']);
    expect(a.states.map((s) => s.id)).toEqual(['q1']);
    expect(a.transitions.every((t) => t.from !== 'q0' && t.to !== 'q0')).toBe(true);
    expect(a.transitions).toHaveLength(1);
  });

  it('removing an accepting state removes it from accepting', () => {
    const a = removeState(dfa(), 'q1');
    expect(a.accepting).toEqual([]);
    expect(a.starts).toEqual(['q0']);
  });

  it('renames, moves, sets start and toggles accepting', () => {
    let a = renameState(dfa(), 'q0', 'S');
    expect(a.states.find((s) => s.id === 'q0')?.label).toBe('S');
    a = moveState(a, 'q1', { x: 7, y: 8 });
    expect(a.states.find((s) => s.id === 'q1')).toMatchObject({ x: 7, y: 8 });
    a = setStart(a, 'q1');
    expect(a.starts).toEqual(['q1']);
    expect(setStart(a, null).starts).toEqual([]);
    expect(toggleAccepting(a, 'q1').accepting).toEqual([]);
    expect(toggleAccepting(a, 'q0').accepting).toEqual(['q1', 'q0']);
  });
});

describe('edges', () => {
  it('keeps one edge per (from,to) and merges symbols', () => {
    const a = addSymbolToEdge(addSymbolToEdge(base(), 'q0', 'q1', 'a'), 'q0', 'q1', 'b');
    expect(a.transitions.filter((t) => t.from === 'q0' && t.to === 'q1')).toHaveLength(1);
    expect(edge(a, 'q0', 'q1')?.symbols).toEqual(['a', 'b']);
  });

  it('does not duplicate a symbol already on the edge', () => {
    const a = addSymbolToEdge(addSymbolToEdge(base(), 'q0', 'q1', 'a'), 'q0', 'q1', 'a');
    expect(edge(a, 'q0', 'q1')?.symbols).toEqual(['a']);
  });

  it('deletes an edge when its last symbol is removed', () => {
    const a = addSymbolToEdge(base(), 'q0', 'q1', 'a');
    expect(removeSymbolFromEdge(a, 'q0', 'q1', 'a').transitions).toEqual([]);
  });

  it('keeps the edge when other symbols remain', () => {
    const a = setEdgeSymbols(base(), 'q0', 'q1', ['a', 'b']);
    expect(edge(removeSymbolFromEdge(a, 'q0', 'q1', 'a'), 'q0', 'q1')?.symbols).toEqual(['b']);
  });

  it('setEdgeSymbols creates, replaces and deletes', () => {
    let a = setEdgeSymbols(base(), 'q0', 'q1', ['a']);
    expect(edge(a, 'q0', 'q1')?.symbols).toEqual(['a']);
    a = setEdgeSymbols(a, 'q0', 'q1', ['b', 'a']);
    expect(edge(a, 'q0', 'q1')?.symbols).toEqual(['b', 'a']);
    expect(setEdgeSymbols(a, 'q0', 'q1', []).transitions).toEqual([]);
    expect(setEdgeSymbols(base(), 'q0', 'q1', []).transitions).toEqual([]);
  });

  it('removeTransition removes by id', () => {
    expect(removeTransition(dfa(), 'q0->q1').transitions.map((t) => t.id)).toEqual([
      'q0->q0',
      'q1->q1',
    ]);
  });
});

describe('alphabet', () => {
  it('adds a symbol, no-op if present, throws on bad input', () => {
    expect(addAlphabetSymbol(dfa(), 'c').alphabet).toEqual(['a', 'b', 'c']);
    expect(addAlphabetSymbol(dfa(), 'a').alphabet).toEqual(['a', 'b']);
    expect(() => addAlphabetSymbol(dfa(), 'ε')).toThrow();
    expect(() => addAlphabetSymbol(dfa(), 'ab')).toThrow();
    expect(() => addAlphabetSymbol(dfa(), '')).toThrow();
  });

  it('removeAlphabetSymbol strips the symbol from edges', () => {
    const a = removeAlphabetSymbol(dfa(), 'a');
    expect(a.alphabet).toEqual(['b']);
    expect(a.transitions.map((t) => [t.id, t.symbols])).toEqual([
      ['q0->q0', ['b']],
      ['q1->q1', ['b']],
    ]);
  });

  it('removeAlphabetSymbol deletes emptied edges and leaves ε alone', () => {
    const n = setEdgeSymbols(base(), 'q0', 'q1', ['ε']);
    expect(removeAlphabetSymbol(n, 'ε')).toEqual(n);
    const a = removeAlphabetSymbol(dfa(), 'b');
    expect(a.transitions.map((t) => t.id)).toEqual(['q0->q1', 'q1->q1']);
  });

  it('renameAlphabetSymbol renames it on edges', () => {
    const a = renameAlphabetSymbol(dfa(), 'a', 'x');
    expect(a.alphabet).toEqual(['x', 'b']);
    expect(edge(a, 'q0', 'q1')?.symbols).toEqual(['x']);
    expect(edge(a, 'q1', 'q1')?.symbols).toEqual(['x', 'b']);
  });

  it('renameAlphabetSymbol never touches ε', () => {
    const n = setEdgeSymbols(base(), 'q0', 'q1', ['ε']);
    expect(renameAlphabetSymbol(n, 'ε', 'x')).toEqual(n);
  });
});

describe('kind and name', () => {
  const nfaWithEpsilon = () =>
    fixture({
      kind: 'NFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      start: 'q0',
      edges: [['q0', 'ε', 'q1']],
    });

  it('setKind to DFA fails when the NFA uses ε', () => {
    const r = setKind(nfaWithEpsilon(), 'DFA');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.length).toBeGreaterThan(0);
      expect(r.issues.every((i) => i.severity === 'error')).toBe(true);
    }
  });

  it('setKind succeeds when valid, and to NFA always', () => {
    const r = setKind(dfa(), 'NFA');
    expect(r.ok && r.automaton.kind).toBe('NFA');
    expect(setKind(dfa(), 'DFA').ok).toBe(true);
    expect(setKind(nfaWithEpsilon(), 'NFA').ok).toBe(true);
  });

  it('renames the automaton', () => {
    expect(renameAutomaton(dfa(), 'X').name).toBe('X');
  });
});

describe('purity', () => {
  it('does not mutate its input', () => {
    const a = dfa();
    const copy = structuredClone(a);
    toggleAccepting(a, 'q0');
    removeState(a, 'q0');
    addSymbolToEdge(a, 'q0', 'q1', 'b');
    removeSymbolFromEdge(a, 'q1', 'q1', 'a');
    removeAlphabetSymbol(a, 'a');
    renameAlphabetSymbol(a, 'a', 'x');
    setEdgeSymbols(a, 'q0', 'q1', []);
    expect(a).toEqual(copy);
  });
});

describe('parseSymbolInput', () => {
  it('splits, trims and dedupes', () =>
    expect(parseSymbolInput(' a, b ,a', 'DFA')).toEqual({ ok: true, symbols: ['a', 'b'] }));
  it('drops empty tokens', () =>
    expect(parseSymbolInput('a,,b,', 'DFA')).toEqual({ ok: true, symbols: ['a', 'b'] }));
  it('rejects multi-character tokens', () =>
    expect(parseSymbolInput('ab', 'NFA')).toEqual({
      ok: false,
      error: 'Symbols must be single characters: ab',
    }));
  it('reports the first bad token in input order', () =>
    expect(parseSymbolInput('xy, ε, zz', 'DFA')).toEqual({
      ok: false,
      error: 'Symbols must be single characters: xy',
    }));
  it('accepts eps/ε on an NFA', () =>
    expect(parseSymbolInput('eps, a', 'NFA')).toEqual({ ok: true, symbols: ['ε', 'a'] }));
  it('dedupes eps and ε together', () =>
    expect(parseSymbolInput('eps,ε', 'NFA')).toEqual({ ok: true, symbols: ['ε'] }));
  it('rejects ε on a DFA', () =>
    expect(parseSymbolInput('ε', 'DFA')).toEqual({
      ok: false,
      error: "A DFA can't have ε-transitions",
    }));
  it('rejects eps on a DFA', () =>
    expect(parseSymbolInput('a, eps', 'DFA')).toEqual({
      ok: false,
      error: "A DFA can't have ε-transitions",
    }));
  it('empty input is an empty list', () =>
    expect(parseSymbolInput('  ', 'DFA')).toEqual({ ok: true, symbols: [] }));
  it('accepts \\epsilon as ε', () =>
    expect(parseSymbolInput('a, \\epsilon', 'NFA')).toEqual({ ok: true, symbols: ['a', 'ε'] }));
});

describe('normalizeSymbolText', () => {
  it('replaces \\epsilon with ε while typing', () =>
    expect(normalizeSymbolText('a,\\epsilon')).toBe('a,ε'));
});

describe('derived alphabet and edge shape', () => {
  it('syncs the alphabet to the symbols in use, keeping order', () => {
    const a = { ...setEdgeSymbols(base(), 'q0', 'q1', ['c', 'a', 'ε']), alphabet: ['b', 'a'] };
    expect(syncAlphabet(a).alphabet).toEqual(['a', 'c']);
  });

  it('returns the same object when the alphabet is already in sync', () => {
    const a = syncAlphabet(setEdgeSymbols(base(), 'q0', 'q1', ['a']));
    expect(syncAlphabet(a)).toBe(a);
  });

  it('turns a DFA into an NFA when ε is committed', () => {
    const r = commitEdgeSymbols(dfa(), 'q0', 'q1', ['ε']);
    expect(r.promoted).toBe(true);
    expect(r.automaton.kind).toBe('NFA');
    expect(commitEdgeSymbols(dfa(), 'q0', 'q1', ['b']).promoted).toBe(false);
  });

  it('sets and clears a bend and a loop angle', () => {
    const a = dfa();
    const id = a.transitions[0]?.id ?? '';
    const bent = setEdgeBend(a, id, 20);
    expect(bent.transitions[0]?.bend).toBe(20);
    expect('bend' in (setEdgeBend(bent, id, undefined).transitions[0] ?? {})).toBe(false);
    expect(setLoopAngle(a, id, 1).transitions[0]?.loopAngle).toBe(1);
  });
});

describe('start states', () => {
  it('toggleStart adds and removes NFA start states, never duplicating (Review Focus 3)', () => {
    const n = fixture({ kind: 'NFA', alphabet: 'a', states: ['q0', 'q1'], start: 'q0' });
    expect(toggleStart(n, 'q1').starts).toEqual(['q0', 'q1']);
    expect(toggleStart(toggleStart(n, 'q1'), 'q1').starts).toEqual(['q0']);
    expect(toggleStart(n, 'q0').starts).toEqual([]);
  });

  it('toggleStart on a DFA moves the start, or clears it on the current start', () => {
    const d = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0', 'q1'], start: 'q0' });
    expect(toggleStart(d, 'q1').starts).toEqual(['q1']);
    expect(toggleStart(d, 'q0').starts).toEqual([]);
  });

  it('removing one of several start states keeps the others (Review Focus 2)', () => {
    const n = fixture({
      kind: 'NFA',
      alphabet: 'a',
      states: ['q0', 'q1', 'q2'],
      starts: ['q0', 'q2'],
    });
    expect(removeState(n, 'q0').starts).toEqual(['q2']);
  });

  it('ignores a start id that is not a state (e.g. from a menu left open across an undo)', () => {
    const n = fixture({ kind: 'NFA', alphabet: 'a', states: ['q0'], start: 'q0' });
    const d = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0'], start: 'q0' });
    expect(toggleStart(n, 'gone').starts).toEqual(['q0']);
    expect(toggleStart(d, 'gone').starts).toEqual(['q0']);
    expect(setStart(d, 'gone').starts).toEqual(['q0']);
  });
});
