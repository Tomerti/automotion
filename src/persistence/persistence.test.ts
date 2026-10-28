import { describe, expect, it } from 'vitest';
import { accepts } from '../core/analysis';
import { minimize } from '../core/minimize';
import { hasErrors, validate } from '../core/validate';
import { fixture } from '../core/testing/fixtures';
import { parseFile, serialize } from './fileFormat';
import { exampleAutomata } from './examples';
import { migrate } from './migrate';
import { BACKUP_KEY, STORAGE_KEY, loadFromStorage, saveToStorage } from './storage';
import { memoryStorage } from './testing/memoryStorage';
import { slug } from '../ui/shell/download';

const sample = () =>
  fixture({
    kind: 'DFA',
    alphabet: 'ab',
    states: ['q0', 'q1'],
    start: 'q0',
    accepting: ['q1'],
    edges: [['q0', 'a', 'q1']],
    name: 'Sample',
  });

const wrap = (x: unknown) => JSON.stringify({ format: 'automaton-vis', version: 1, automata: [x] });

describe('fileFormat', () => {
  it('round-trips serialize → parseFile', () => {
    const a = sample();
    expect(parseFile(serialize([a]), new Set())).toEqual({ ok: true, automata: [a] });
  });

  it('serializes with the format header and 2-space indent', () => {
    const text = serialize([sample()]);
    expect(text).toContain('\n  "format": "automaton-vis"');
    expect(JSON.parse(text).version).toBe(1);
  });

  it('renames colliding ids on import (existing and within the file)', () => {
    const a = sample();
    const r = parseFile(serialize([a, { ...a, name: 'Twin' }]), new Set([a.id]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.automata).toHaveLength(2);
    const ids = r.automata.map((x) => x.id);
    expect(ids).not.toContain(a.id);
    expect(new Set(ids).size).toBe(2);
    expect(r.automata[0]?.states).toEqual(a.states);
  });

  it('keeps the first of in-file duplicates when no existing collision', () => {
    const a = sample();
    const r = parseFile(serialize([a, { ...a, name: 'Twin' }]), new Set());
    if (!r.ok) throw new Error('expected ok');
    expect(r.automata[0]?.id).toBe(a.id);
    expect(r.automata[1]?.id).not.toBe(a.id);
  });

  it('rejects a dangling transition with a specific message', () => {
    const a = sample();
    const bad = wrap({
      ...a,
      transitions: [{ id: 't3', from: 'q0', to: 'q9', symbols: ['a'] }],
    });
    expect(parseFile(bad, new Set())).toEqual({
      ok: false,
      error: 'Transition t3 points to unknown state q9',
    });
  });

  it('rejects multi-character symbols but allows ε on edges', () => {
    const a = sample();
    expect(parseFile(wrap({ ...a, alphabet: ['ab'] }), new Set())).toEqual({
      ok: false,
      error: 'Symbols must be single characters',
    });
    const t = a.transitions[0]!;
    expect(parseFile(wrap({ ...a, transitions: [{ ...t, symbols: ['ab'] }] }), new Set())).toEqual({
      ok: false,
      error: 'Symbols must be single characters',
    });
    expect(
      parseFile(wrap({ ...a, kind: 'NFA', transitions: [{ ...t, symbols: ['ε'] }] }), new Set()).ok,
    ).toBe(true);
  });

  it('rejects non-JSON and foreign JSON', () => {
    expect(parseFile('{oops', new Set())).toEqual({ ok: false, error: 'Not a valid JSON file' });
    expect(parseFile('[1]', new Set())).toEqual({ ok: false, error: 'Not an Automaton Vis file' });
    expect(parseFile('{"format":"other"}', new Set())).toEqual({
      ok: false,
      error: 'Not an Automaton Vis file',
    });
  });

  it('rejects a newer version', () => {
    const r = parseFile('{"format":"automaton-vis","version":2,"automata":[]}', new Set());
    expect(r).toEqual({
      ok: false,
      error: 'This file is from a newer version of Automaton Vis',
    });
    expect(() => migrate({ format: 'automaton-vis', version: 9 })).toThrow(/newer version/);
  });
});

describe('storage', () => {
  it('starts with one blank DFA on first launch', () => {
    const r = loadFromStorage(memoryStorage());
    expect(r.automata.map((a) => [a.name, a.kind, a.states.length])).toEqual([
      ['Untitled', 'DFA', 0],
    ]);
    expect(r.warning).toBeUndefined();
  });

  it('saves and loads back', () => {
    const s = memoryStorage();
    const a = sample();
    expect(saveToStorage(s, [a])).toBe(true);
    expect(loadFromStorage(s)).toEqual({ automata: [a] });
  });

  it('a stored empty list stays empty', () => {
    const s = memoryStorage();
    saveToStorage(s, []);
    expect(loadFromStorage(s)).toEqual({ automata: [] });
  });

  it('survives corrupted storage and keeps a backup', () => {
    const s = memoryStorage({ [STORAGE_KEY]: '{oops' });
    const r = loadFromStorage(s);
    expect(r.automata.length).toBe(1);
    expect(r.warning).toMatch(/backup/);
    expect(s.getItem(BACKUP_KEY)).toBe('{oops');
  });

  it('survives a storage that throws', () => {
    const throwing = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('denied');
      },
    } as unknown as Storage;
    const r = loadFromStorage(throwing);
    expect(r.automata.length).toBe(1);
    expect(r.warning).toBe("Changes won't persist — export to save");
    expect(saveToStorage(throwing, [])).toBe(false);
    expect(loadFromStorage(null).warning).toBe("Changes won't persist — export to save");
    expect(saveToStorage(null, [])).toBe(false);
  });
});

describe('examples', () => {
  it('languages and minimization', () => {
    const [endsInAb, evenZeros, redundant] = exampleAutomata();
    if (!endsInAb || !evenZeros || !redundant) throw new Error('missing');
    expect(['ab', 'aab', 'bab'].every((w) => accepts(endsInAb, w))).toBe(true);
    expect(['', 'a', 'ba', 'abb', 'b'].some((w) => accepts(endsInAb, w))).toBe(false);
    expect(endsInAb.transitions.some((t) => t.symbols.includes('ε'))).toBe(true);
    expect(accepts(evenZeros, '')).toBe(true);
    expect(accepts(evenZeros, '1010')).toBe(true);
    expect(accepts(evenZeros, '10')).toBe(false);
    expect(minimize(redundant).result.states.length).toBeLessThan(redundant.states.length);
    expect(exampleAutomata().every((a) => !hasErrors(validate(a)))).toBe(true);
  });

  it('has stable ids', () => {
    expect(exampleAutomata().map((a) => a.id)).toEqual([
      'example-ends-in-ab',
      'example-even-zeros',
      'example-redundant',
    ]);
  });
});

describe('slug', () => {
  it('slugifies', () => {
    expect(slug('Ends in ab (NFA)')).toBe('ends-in-ab-nfa');
    expect(slug('***')).toBe('automaton');
  });
});
