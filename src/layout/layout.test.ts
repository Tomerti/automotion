import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { STATE_RADIUS, transitionPolyline, type Point } from '../core/geometry';
import type { Automaton, State } from '../core/model';
import { subsetConstruction } from '../core/subset';
import { arbNfa } from '../core/testing/arbitraries';
import { fixture, nthFromEnd } from '../core/testing/fixtures';
import { SPACING, bendClearOfStates, layoutCostTerms, newArrowBend } from './aesthetics';
import { compactSeeds, refineOnGrid } from './grid';
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
  }, 20000);

  it('is deterministic', async () => {
    for (const a of layoutSamples()) {
      expect(await layoutAutomaton(a), a.name).toEqual(await layoutAutomaton(a));
    }
  }, 20000);

  it('lays out a laid-out automaton as it is (Tidy again changes nothing)', async () => {
    for (const a of layoutSamples()) {
      const once = await layoutAutomaton(a);
      expect(await layoutAutomaton(once), a.name).toEqual(once);
    }
  }, 20000);

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

  it('lays a DFA with many cross arrows on a grid, nothing crossing (To minimize)', async () => {
    const out = await layoutAutomaton(sample('To minimize'));
    const x0 = Math.min(...out.states.map((s) => s.x));
    const y0 = Math.min(...out.states.map((s) => s.y));
    for (const s of out.states) {
      expect((s.x - x0) % SPACING, s.label).toBe(0);
      expect((s.y - y0) % SPACING, s.label).toBe(0);
    }
    // No crossings, arrows through states or labels on anything; no skewed straight arrows.
    expect(layoutCostTerms(out)).not.toHaveProperty('arrows');
    expect(layoutCostTerms(out)).not.toHaveProperty('skew');
  });

  it('packs a dense DFA into little room, not along a diagonal (3rd from end → DFA)', async () => {
    const out = await layoutAutomaton(sample('3rd from end → DFA'));
    const xs = out.states.map((s) => s.x);
    const ys = out.states.map((s) => s.y);
    const cols = (Math.max(...xs) - Math.min(...xs)) / SPACING + 1;
    const rows = (Math.max(...ys) - Math.min(...ys)) / SPACING + 1;
    // Any shape, as long as it wastes no more than a cell or so (the diagonal took 4 × 4 for 8).
    expect(cols * rows).toBeLessThanOrEqual(out.states.length + 1);
    // Still nothing crossing, through a state or on a label.
    expect(layoutCostTerms(out)).not.toHaveProperty('arrows');
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

describe('refineOnGrid', () => {
  it('snaps states to distinct grid cells, and only moves them while the cost drops', () => {
    const ids = ['a', 'b', 'c'];
    // b and c round to the same cell: c takes the nearest free one.
    const pos = new Map([
      ['a', { x: 3, y: -4 }],
      ['b', { x: 150, y: 10 }],
      ['c', { x: 130, y: 20 }],
    ]);
    const out = refineOnGrid(ids, pos, () => 0);
    expect([...out.values()].every((p) => p.x % SPACING === 0 && p.y % SPACING === 0)).toBe(true);
    expect(new Set([...out.values()].map((p) => `${p.x},${p.y}`)).size).toBe(3);
    expect(out.get('a')).toEqual({ x: 0, y: 0 });
    expect(out.get('b')).toEqual({ x: SPACING, y: 0 });
    // A cost that wants a and c far apart: c moves away from a.
    const apart = refineOnGrid(
      ids,
      pos,
      (p) => -Math.hypot(p.get('a')!.x - p.get('c')!.x, p.get('a')!.y - p.get('c')!.y),
    );
    const d = (p: Map<string, { x: number; y: number }>) =>
      Math.hypot(p.get('a')!.x - p.get('c')!.x, p.get('a')!.y - p.get('c')!.y);
    expect(d(apart)).toBeGreaterThan(d(out));
  });
});

describe('compactSeeds', () => {
  it('packs a spread-out layout into compact rectangles, keeping its order', () => {
    // Six states along a diagonal.
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const pos = new Map(ids.map((id, i) => [id, { x: i * SPACING, y: i * SPACING }]));
    const seeds = compactSeeds(ids, pos);
    expect(seeds.length).toBeGreaterThan(0);
    for (const seed of seeds) {
      const cells = [...seed.values()];
      expect(new Set(cells.map((p) => `${p.x},${p.y}`)).size).toBe(ids.length);
      const cols = Math.max(...cells.map((p) => p.x)) / SPACING + 1;
      const rows = Math.max(...cells.map((p) => p.y)) / SPACING + 1;
      expect(rows).toBeGreaterThanOrEqual(2);
      expect(cols).toBeGreaterThanOrEqual(rows);
      expect(cols * rows).toBeLessThan(ids.length + Math.max(cols, rows));
    }
    // Packed by columns: left to right, top to bottom in each, as the diagonal had them.
    expect(seeds[0]!.get('a')).toEqual({ x: 0, y: 0 });
    expect(seeds[0]!.get('b')).toEqual({ x: 0, y: SPACING });
    expect(seeds[0]!.get('c')).toEqual({ x: SPACING, y: 0 });
  });
});

describe('bendClearOfStates', () => {
  it('bends only the arrows drawn through a state', () => {
    const a = fixture({
      kind: 'DFA',
      alphabet: 'ab',
      states: ['p', 'q', 'r'],
      start: 'p',
      edges: [
        ['p', 'a', 'q'],
        ['q', 'a', 'r'],
        ['p', 'b', 'r'],
      ],
    });
    const row: Automaton = {
      ...a,
      states: a.states.map((s, i) => ({ ...s, x: i * SPACING, y: 0 })),
    };
    const out = bendClearOfStates(row);
    const bend = (id: string) => out.transitions.find((t) => t.id === id)?.bend;
    expect(bend('p->q')).toBeUndefined();
    expect(bend('q->r')).toBeUndefined();
    expect(bend('p->r')).not.toBeUndefined();
    expect(arrowsThroughStates(out)).toEqual([]);
    // Nothing in the way: left as it is.
    const apart = { ...row, transitions: row.transitions.filter((t) => t.id !== 'p->r') };
    expect(bendClearOfStates(apart)).toBe(apart);
  });
});

describe('newArrowBend', () => {
  // Three states in a row, p → q → r, as drawn by hand.
  const a = fixture({
    kind: 'DFA',
    alphabet: 'ab',
    states: ['p', 'q', 'r'],
    start: 'p',
    edges: [
      ['p', 'a', 'q'],
      ['q', 'a', 'r'],
    ],
  });
  const row: Automaton = {
    ...a,
    states: a.states.map((s, i) => ({ ...s, x: i * SPACING, y: 0 })),
  };
  const withArrow = (from: string, to: string, bend: number | undefined): Automaton => ({
    ...row,
    transitions: [
      ...row.transitions,
      { id: 'new', from, to, symbols: ['b'], ...(bend === undefined ? {} : { bend }) },
    ],
  });

  it('bends a new arrow that would run through a state in between', () => {
    const bend = newArrowBend(row, 'r', 'p');
    expect(bend).not.toBeUndefined();
    expect(arrowsThroughStates(withArrow('r', 'p', bend))).toEqual([]);
    expect(arrowsThroughStates(withArrow('p', 'r', newArrowBend(row, 'p', 'r')))).toEqual([]);
  });

  it('leaves a new arrow automatic when nothing is in its way', () => {
    expect(newArrowBend(row, 'r', 'q')).toBeUndefined();
    expect(newArrowBend(row, 'p', 'p')).toBeUndefined();
    const lifted = { ...row, states: row.states.map((s) => (s.id === 'q' ? { ...s, y: 100 } : s)) };
    expect(newArrowBend(lifted, 'r', 'p')).toBeUndefined();
  });
});
