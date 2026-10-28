import { describe, expect, it } from 'vitest';
import { subsetConstruction } from '../core/subset';
import { fixture } from '../core/testing/fixtures';
import { layoutAutomaton } from './layout';

const endsInAb = fixture({
  kind: 'NFA',
  alphabet: 'ab',
  states: ['q0', 'q1', 'q2'],
  start: 'q0',
  accepting: ['q2'],
  edges: [
    ['q0', 'a,b', 'q0'],
    ['q0', 'a', 'q1'],
    ['q1', 'b', 'q2'],
  ],
});

describe('layoutAutomaton', () => {
  it('gives every state a distinct finite position', async () => {
    const out = await layoutAutomaton(subsetConstruction(endsInAb).result);
    const keys = out.states.map((s) => `${s.x},${s.y}`);
    expect(out.states.every((s) => Number.isFinite(s.x) && Number.isFinite(s.y))).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('places the start state leftmost', async () => {
    const dfa = subsetConstruction(endsInAb).result;
    const out = await layoutAutomaton(dfa);
    const start = out.states.find((s) => out.starts.includes(s.id));
    expect(start).toBeDefined();
    for (const s of out.states) expect(start!.x).toBeLessThanOrEqual(s.x);
  });

  it('keeps everything except positions', async () => {
    const dfa = subsetConstruction(endsInAb).result;
    const before = structuredClone(dfa);
    const out = await layoutAutomaton(dfa);
    expect(dfa).toEqual(before);
    expect(out.transitions).toEqual(dfa.transitions);
    expect(out.accepting).toEqual(dfa.accepting);
    expect(out.starts).toEqual(dfa.starts);
    const strip = (a: typeof dfa) => a.states.map((s) => ({ id: s.id, label: s.label }));
    expect(strip(out)).toEqual(strip(dfa));
  });

  it('returns an automaton with no states unchanged', async () => {
    const empty = fixture({ kind: 'DFA', alphabet: 'a', states: [] });
    expect(await layoutAutomaton(empty)).toEqual(empty);
  });
});
