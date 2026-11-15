import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { STATE_RADIUS, transitionPolyline, type Point } from '../core/geometry';
import type { Automaton, State } from '../core/model';
import { subsetConstruction } from '../core/subset';
import { arbNfa } from '../core/testing/arbitraries';
import { fixture, nthFromEnd } from '../core/testing/fixtures';
import { layoutAutomaton } from './layout';
import { layoutSamples } from './samples';

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

const sample = (name: string): Automaton => {
  const a = layoutSamples().find((s) => s.name === name);
  if (!a) throw new Error(`no sample ${name}`);
  return a;
};
const at = (a: Automaton, label: string): State => a.states.find((s) => s.label === label)!;

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Arrows drawn through a state they don't touch, as "from→to through s". */
function arrowsThroughStates(a: Automaton): string[] {
  const out: string[] = [];
  for (const t of a.transitions) {
    const from = a.states.find((s) => s.id === t.from)!;
    const to = a.states.find((s) => s.id === t.to)!;
    const pts = transitionPolyline(a, from, to, 32);
    for (const s of a.states) {
      if (s.id === from.id || s.id === to.id) continue;
      const d = Math.min(...pts.slice(1).map((p, i) => distToSegment(s, pts[i]!, p)));
      if (d < STATE_RADIUS) out.push(`${from.label}→${to.label} through ${s.label}`);
    }
  }
  return out;
}

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

  it('changes only how the automaton is drawn', async () => {
    const dfa = subsetConstruction(endsInAb).result;
    const before = structuredClone(dfa);
    const out = await layoutAutomaton(dfa);
    expect(dfa).toEqual(before);
    const plain = (a: Automaton) => ({
      ...a,
      states: a.states.map((s) => ({ id: s.id, label: s.label })),
      transitions: a.transitions.map((t) => ({
        id: t.id,
        from: t.from,
        to: t.to,
        symbols: t.symbols,
      })),
    });
    expect(plain(out)).toEqual(plain(dfa));
  });

  it('drops hand-made bends, loop and start arrow directions and label sides', async () => {
    const a = fixture({
      kind: 'DFA',
      alphabet: 'ab',
      states: ['p', 'q'],
      start: 'p',
      edges: [
        ['p', 'a', 'q'],
        ['q', 'b', 'q'],
      ],
    });
    const messy: Automaton = {
      ...a,
      states: a.states.map((s) => ({ ...s, startAngle: 1 })),
      transitions: a.transitions.map((t) =>
        t.from === t.to ? { ...t, loopAngle: 2 } : { ...t, bend: 150, labelSide: 'right' },
      ),
    };
    const out = await layoutAutomaton(messy);
    expect(out.states.map((s) => s.startAngle)).toEqual([undefined, undefined]);
    for (const t of out.transitions) {
      expect(t).not.toHaveProperty('bend');
      expect(t).not.toHaveProperty('loopAngle');
      expect(t).not.toHaveProperty('labelSide');
    }
    expect(at(out, 'q').y).toBe(at(out, 'p').y);
  });

  it('returns an automaton with no states unchanged', async () => {
    const empty = fixture({ kind: 'DFA', alphabet: 'a', states: [] });
    expect(await layoutAutomaton(empty)).toEqual(empty);
  });

  it('draws no arrow through a state and keeps states apart, for every sample', async () => {
    for (const a of layoutSamples()) {
      const out = await layoutAutomaton(a);
      expect(arrowsThroughStates(out), a.name).toEqual([]);
      for (const [i, s] of out.states.entries()) {
        for (const o of out.states.slice(i + 1)) {
          expect(
            Math.hypot(s.x - o.x, s.y - o.y),
            `${a.name}: ${s.label}, ${o.label}`,
          ).toBeGreaterThanOrEqual(2 * STATE_RADIUS + 40);
        }
      }
    }
  });

  it('is deterministic', async () => {
    for (const a of layoutSamples()) {
      expect(await layoutAutomaton(a), a.name).toEqual(await layoutAutomaton(a));
    }
  });

  it('lays out a laid-out automaton as it is (Tidy again changes nothing)', async () => {
    for (const a of layoutSamples()) {
      const once = await layoutAutomaton(a);
      expect(await layoutAutomaton(once), a.name).toEqual(once);
    }
  });

  it('lays a chain out as one row in reading order, back arrows curved around it', async () => {
    for (const name of ['Exactly two a', '(a|b)*abb with ε', 'Contains 101']) {
      const out = await layoutAutomaton(sample(name));
      const ys = new Set(out.states.map((s) => s.y));
      expect(ys.size, name).toBe(1);
      const xs = out.states.map((s) => s.x);
      expect(xs, name).toEqual([...xs].sort((p, q) => p - q));
    }
    // q2 → q0 would run through q1 straight.
    const contains = await layoutAutomaton(sample('Contains 101'));
    expect(contains.transitions.find((t) => t.id === 'q2->q0')?.bend).not.toBeUndefined();
  });

  it('reads a branching automaton left to right', async () => {
    const out = await layoutAutomaton(sample('Union NFA'));
    const x = (l: string) => at(out, l).x;
    expect(x('s')).toBeLessThan(x('a0'));
    expect(x('a0')).toBe(x('b0'));
    expect(x('a0')).toBeLessThan(x('a1'));
    expect(x('a1')).toBe(x('b1'));
  });

  it('stacks unconnected parts, the start state’s first', async () => {
    const a = fixture({
      kind: 'NFA',
      alphabet: 'ab',
      states: ['lonely', 'p', 'r'],
      starts: ['p'],
      edges: [['p', 'a', 'r']],
    });
    const out = await layoutAutomaton(a);
    expect(at(out, 'p').y).toBe(at(out, 'r').y);
    expect(at(out, 'lonely').y).toBeGreaterThan(at(out, 'p').y);
  });

  it('lays out the largest subset construction result', async () => {
    const dfa = subsetConstruction(nthFromEnd(6)).result;
    expect(dfa.states).toHaveLength(64);
    const out = await layoutAutomaton(dfa);
    const keys = new Set(out.states.map((s) => `${s.x},${s.y}`));
    expect(keys.size).toBe(64);
  }, 30000);

  it('handles any automaton: positions finite and distinct, nothing but drawing changed', async () => {
    const cases = fc.sample(arbNfa({ maxStates: 7 }), { numRuns: 40, seed: 7 });
    for (const a of cases) {
      const out = await layoutAutomaton(a);
      expect(out.states.map((s) => s.id)).toEqual(a.states.map((s) => s.id));
      expect(out.transitions.map((t) => [t.from, t.to, t.symbols])).toEqual(
        a.transitions.map((t) => [t.from, t.to, t.symbols]),
      );
      expect(out.states.every((s) => Number.isFinite(s.x) && Number.isFinite(s.y))).toBe(true);
      expect(new Set(out.states.map((s) => `${s.x},${s.y}`)).size).toBe(a.states.length);
    }
  });
});
