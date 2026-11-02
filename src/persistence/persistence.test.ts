import { describe, expect, it } from 'vitest';
import { fixture } from '../core/testing/fixtures';
import { parseFile, serialize } from './fileFormat';
import { migrate } from './migrate';
import {
  BACKUP_KEY,
  OLD_EXAMPLES_CHECKED_KEY,
  STORAGE_KEY,
  loadFromStorage,
  migrateLegacyKeys,
  saveToStorage,
} from './storage';
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

const wrap = (x: unknown) => JSON.stringify({ format: 'automotion', version: 2, automata: [x] });

describe('fileFormat', () => {
  it('round-trips serialize → parseFile', () => {
    const a = sample();
    expect(parseFile(serialize([a]), new Set())).toEqual({ ok: true, automata: [a] });
  });

  it('keeps the side of an edge label; rejects an unknown side', () => {
    const s = sample();
    const a = {
      ...s,
      transitions: s.transitions.map((t) => ({ ...t, labelSide: 'right' as const })),
    };
    expect(parseFile(serialize([a]), new Set())).toEqual({ ok: true, automata: [a] });
    const bad = serialize([a]).replace('"labelSide": "right"', '"labelSide": "up"');
    expect(parseFile(bad, new Set()).ok).toBe(false);
  });

  it('serializes with the format header and 2-space indent', () => {
    const text = serialize([sample()]);
    expect(text).toContain('\n  "format": "automotion"');
    expect(JSON.parse(text).version).toBe(2);
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

  it('migrates a v1 file: start becomes starts, a missing start becomes []', () => {
    const oneStateV1 = {
      id: 'v1',
      name: 'Old',
      kind: 'DFA',
      alphabet: [],
      states: [{ id: 'q0', label: 'q0', x: 0, y: 0 }],
      accepting: [],
      transitions: [],
    };
    const v1 = (start: string | null) =>
      JSON.stringify({ format: 'automaton-vis', version: 1, automata: [{ ...oneStateV1, start }] });
    expect(parseFile(v1('q0'), new Set())).toMatchObject({
      ok: true,
      automata: [{ starts: ['q0'] }],
    });
    expect(parseFile(v1(null), new Set())).toMatchObject({ ok: true, automata: [{ starts: [] }] });
    // Review Focus 1: v1 never checked the start; a dangling one is dropped, not fatal.
    expect(parseFile(v1('gone'), new Set())).toMatchObject({
      ok: true,
      automata: [{ starts: [] }],
    });
  });

  it('v2 files: round-trip several NFA starts; reject an unknown start or a two-start DFA', () => {
    const nfa = fixture({
      kind: 'NFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      starts: ['q0', 'q1'],
    });
    expect(parseFile(serialize([nfa]), new Set())).toMatchObject({
      ok: true,
      automata: [{ starts: ['q0', 'q1'] }],
    });
    expect(JSON.parse(serialize([nfa])).version).toBe(2);
    expect(parseFile(wrap({ ...nfa, starts: ['nope'] }), new Set()).ok).toBe(false);
    expect(parseFile(wrap({ ...nfa, kind: 'DFA', starts: ['q0', 'q1'] }), new Set()).ok).toBe(
      false,
    );
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
    expect(parseFile('[1]', new Set())).toEqual({ ok: false, error: 'Not an AutoMotion file' });
    expect(parseFile('{"format":"other"}', new Set())).toEqual({
      ok: false,
      error: 'Not an AutoMotion file',
    });
  });

  it('reads files saved under the old name, Automaton Vis', () => {
    const a = sample();
    const old = JSON.stringify({ format: 'automaton-vis', version: 2, automata: [a] });
    expect(parseFile(old, new Set())).toEqual({ ok: true, automata: [a] });
  });

  it('rejects a newer version', () => {
    const r = parseFile('{"format":"automotion","version":3,"automata":[]}', new Set());
    expect(r).toEqual({
      ok: false,
      error: 'This file is from a newer version of AutoMotion',
    });
    expect(() => migrate({ format: 'automotion', version: 9 })).toThrow(/newer version/);
  });
});

/** What the first release stored after seeding its three examples (v1: a single `start`). */
function oldSeededFile(): {
  format: string;
  version: number;
  automata: Record<string, unknown>[];
} {
  const st = (id: string, x: number, y: number) => ({ id, label: id, x, y });
  const tr = (from: string, to: string, symbols: string[]) => ({
    id: `${from}->${to}`,
    from,
    to,
    symbols,
  });
  return {
    format: 'automaton-vis',
    version: 1,
    automata: [
      {
        id: 'example-ends-in-ab',
        name: 'Ends in ab (NFA)',
        kind: 'NFA',
        alphabet: ['a', 'b'],
        states: [st('q0', 100, 150), st('q1', 250, 150), st('q2', 400, 150), st('q3', 550, 150)],
        start: 'q0',
        accepting: ['q3'],
        transitions: [
          tr('q0', 'q0', ['a', 'b']),
          tr('q0', 'q1', ['ε']),
          tr('q1', 'q2', ['a']),
          tr('q2', 'q3', ['b']),
        ],
      },
      {
        id: 'example-even-zeros',
        name: 'Even number of 0s (DFA)',
        kind: 'DFA',
        alphabet: ['0', '1'],
        states: [st('even', 150, 150), st('odd', 300, 150)],
        start: 'even',
        accepting: ['even'],
        transitions: [
          tr('even', 'odd', ['0']),
          tr('odd', 'even', ['0']),
          tr('even', 'even', ['1']),
          tr('odd', 'odd', ['1']),
        ],
      },
      {
        id: 'example-redundant',
        name: 'Redundant states (DFA)',
        kind: 'DFA',
        alphabet: ['a', 'b'],
        states: [st('q0', 100, 100), st('q1', 250, 100), st('q2', 100, 250), st('q3', 250, 250)],
        start: 'q0',
        accepting: ['q0', 'q2'],
        transitions: [
          tr('q0', 'q1', ['a']),
          tr('q0', 'q2', ['b']),
          tr('q1', 'q0', ['a']),
          tr('q1', 'q3', ['b']),
          tr('q2', 'q3', ['a']),
          tr('q2', 'q0', ['b']),
          tr('q3', 'q2', ['a']),
          tr('q3', 'q1', ['b']),
        ],
      },
    ],
  };
}

describe('old seeded examples', () => {
  it('removes untouched ones once, saves the result and opens a blank DFA if none is left', () => {
    const s = memoryStorage({ [STORAGE_KEY]: JSON.stringify(oldSeededFile()) });
    const r = loadFromStorage(s);
    expect(r.automata.map((a) => [a.name, a.states.length])).toEqual([['Untitled', 0]]);
    expect(s.getItem(OLD_EXAMPLES_CHECKED_KEY)).not.toBeNull();
    // Saved, so they don't come back on the next load.
    expect(s.getItem(STORAGE_KEY)).not.toContain('example-');
  });

  it('keeps edited examples and the user’s own automata, in order', () => {
    const file = oldSeededFile();
    const [endsInAb, evenZeros, redundant] = file.automata;
    const own = JSON.parse(serialize([sample()])).automata[0];
    const moved = {
      ...evenZeros,
      states: [
        { id: 'even', label: 'even', x: 160, y: 150 },
        { id: 'odd', label: 'odd', x: 300, y: 150 },
      ],
    };
    const renamed = { ...redundant, name: 'Mine now' };
    const s = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({ ...file, automata: [own, endsInAb, moved, renamed] }),
    });
    expect(loadFromStorage(s).automata.map((a) => a.name)).toEqual([
      'Sample',
      'Even number of 0s (DFA)',
      'Mine now',
    ]);
  });

  it('also recognizes the subscripted labels and a v2 file', () => {
    const file = oldSeededFile();
    const endsInAb = { ...file.automata[0]! };
    delete endsInAb.start;
    const v2 = {
      ...endsInAb,
      starts: ['q0'],
      states: (endsInAb.states as { id: string }[]).map((st) => ({
        ...st,
        label: st.id.replace(/^q(\d)$/, 'q_$1'),
      })),
    };
    const s = memoryStorage({ [STORAGE_KEY]: wrap(v2) });
    expect(loadFromStorage(s).automata.map((a) => a.name)).toEqual(['Untitled']);
  });

  it('runs only once: examples imported later stay', () => {
    const s = memoryStorage();
    loadFromStorage(s);
    s.setItem(STORAGE_KEY, JSON.stringify(oldSeededFile()));
    expect(loadFromStorage(s).automata).toHaveLength(3);
  });

  it('a bent edge counts as an edit', () => {
    const file = oldSeededFile();
    const evenZeros = file.automata[1]!;
    const transitions = evenZeros.transitions as { bend?: number }[];
    const bent = {
      ...evenZeros,
      transitions: [{ ...transitions[0], bend: 30 }, ...transitions.slice(1)],
    };
    const s = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({ ...file, automata: [bent] }),
    });
    expect(loadFromStorage(s).automata.map((a) => a.name)).toEqual(['Even number of 0s (DFA)']);
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

  it('moves keys saved under the old name and loads them', () => {
    const a = sample();
    const s = memoryStorage({
      'automaton-vis:v1': JSON.stringify({ format: 'automaton-vis', version: 2, automata: [a] }),
      'automaton-vis:theme': 'dark',
      'automotion:history-bar': 'closed',
      'automaton-vis:history-bar': 'open',
      unrelated: 'x',
    });
    migrateLegacyKeys(s);
    expect(s.getItem('automaton-vis:v1')).toBeNull();
    expect(s.getItem('automaton-vis:history-bar')).toBeNull();
    expect(s.getItem('automotion:theme')).toBe('dark');
    // A key already saved under the new name wins.
    expect(s.getItem('automotion:history-bar')).toBe('closed');
    expect(s.getItem('unrelated')).toBe('x');
    expect(loadFromStorage(s)).toEqual({ automata: [a] });
    migrateLegacyKeys(null);
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

describe('slug', () => {
  it('slugifies', () => {
    expect(slug('Ends in ab (NFA)')).toBe('ends-in-ab-nfa');
    expect(slug('***')).toBe('automaton');
  });
});
