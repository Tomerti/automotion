import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { drawnBend, STATE_RADIUS, transitionPolyline } from './geometry';
import { EPSILON } from './model';
import type { Automaton, State, StateId } from './model';
import { printRegex } from './regex';
import type { Regex } from './regex';
import { arbRegex } from './testing/arbitraries';
import { canThompson, thompson } from './thompson';
import type { Piece } from './thompson';
import { layoutPieces } from './thompsonLayout';

const SAMPLES = [
  'a',
  'ab',
  'a|b|c',
  '(a|b)*abb',
  'a*+',
  '(ab|c*)+d',
  '((a|b)(c|d))*',
  'ε',
  '∅*',
  '(a|bc|d*)*e',
];

function byId(a: Automaton, id: StateId): State {
  const s = a.states.find((x) => x.id === id);
  if (!s) throw new Error(`no state ${id}`);
  return s;
}
const byLabel = (a: Automaton, label: string): State => {
  const s = a.states.find((x) => x.label === label);
  if (!s) throw new Error(`no state ${label}`);
  return s;
};

/** Each assertion is on the closest pair, so a failure names it (and runs stay fast). */
function expectNoOverlap(a: Automaton): void {
  const { states } = a;
  for (const [i, p] of states.entries()) {
    const others = states.slice(i + 1);
    if (others.length === 0) continue;
    const closest = Math.min(...others.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
    expect(closest, p.label).toBeGreaterThanOrEqual(2 * STATE_RADIUS + 16);
  }
}

function expectNoArrowThroughStates(a: Automaton): void {
  for (const t of a.transitions) {
    const pts = transitionPolyline(a, byId(a, t.from), byId(a, t.to));
    for (const st of a.states.filter((x) => x.id !== t.from && x.id !== t.to)) {
      const closest = Math.min(...pts.map((p) => Math.hypot(p.x - st.x, p.y - st.y)));
      expect(closest, `${t.id} past ${st.id}`).toBeGreaterThan(STATE_RADIUS);
    }
  }
}

/** Harder than SAMPLES: a tall union, unbalanced branches, a long star body opening with a star. */
const HARD = ['a|b|c|d|e|f|g|h|i|j|k', 'a|bcdefg|h', '(a*bcdefg)*', '((a|b|c|d)*e|f)*'];

describe('Thompson layout', () => {
  it.each(SAMPLES)('%s: no two states overlap', (s) => {
    expectNoOverlap(thompson(s).result);
  });

  it.each(SAMPLES)('%s: no arrow passes through a state it does not connect', (s) => {
    expectNoArrowThroughStates(thompson(s).result);
  });

  it.each(HARD)('%s: no overlap, no arrow through a state', (s) => {
    const a = thompson(s).result;
    expectNoOverlap(a);
    expectNoArrowThroughStates(a);
  });

  it('any regex: no overlap, no arrow through a state', () => {
    fc.assert(
      fc.property(
        arbRegex('ab', 4).filter((r) => canThompson(printRegex(r)) === null),
        (r) => {
          const a = thompson(printRegex(r)).result;
          expectNoOverlap(a);
          expectNoArrowThroughStates(a);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('concatenation runs left to right on one line; union branches stack in order', () => {
    const ab = thompson('ab').result;
    const q1 = byLabel(ab, 'q_1');
    const q2 = byLabel(ab, 'q_2');
    expect(q1.x).toBeLessThan(q2.x);
    expect(q1.y).toBe(q2.y);

    const abc = thompson('a|b|c').result;
    const starts = ['q_0', 'q_2', 'q_4'].map((l) => byLabel(abc, l));
    const branchStates = ['q_0', 'q_1', 'q_2', 'q_3', 'q_4', 'q_5'].map((l) => byLabel(abc, l));
    expect(new Set(starts.map((s) => s.x)).size).toBe(1);
    expect(starts[0]!.y).toBeLessThan(starts[1]!.y);
    expect(starts[1]!.y).toBeLessThan(starts[2]!.y);
    for (const s of branchStates) {
      expect(byLabel(abc, 'q_6').x).toBeLessThan(s.x);
      expect(byLabel(abc, 'q_7').x).toBeGreaterThan(s.x);
    }
  });

  it('a star: back arrow above its body, skip arrow below', () => {
    // (ab)*: t0 -a-> t1 -ε-> t2 -b-> t3 is the body, t4 the new start, t5 the new accept.
    const a = thompson('(ab)*').result;
    const body = ['t0', 't1', 't2', 't3'].map((id) => byId(a, id));
    const mid = (from: StateId, to: StateId) =>
      transitionPolyline(a, byId(a, from), byId(a, to))[8]!;
    const back = mid('t3', 't0');
    const skip = mid('t4', 't5');
    for (const s of body) {
      expect(back.y).toBeLessThan(s.y - STATE_RADIUS);
      expect(skip.y).toBeGreaterThan(s.y + STATE_RADIUS);
    }
  });

  it("a star over one symbol keeps the symbol's arrow straight", () => {
    for (const s of ['a*', 'ε+']) {
      const a = thompson(s).result;
      expect(drawnBend(a, 't0', 't1')).toBe(0);
    }
  });

  it('the root starts at (0, 0)', () => {
    for (const s of SAMPLES) {
      const a = thompson(s).result;
      const start = byId(a, a.starts[0]!);
      expect([start.x, start.y]).toEqual([0, 0]);
    }
  });

  it('layoutPieces leaves its input alone and changes only positions and bends', () => {
    // a*, as Thompson builds it: t0 -a-> t1 is the body, t2 the new start, t3 the new accept.
    const sym: Regex = { type: 'sym', sym: 'a' };
    const body: Piece = {
      node: sym,
      start: 't0',
      accept: 't1',
      states: ['t0', 't1'],
      children: [],
    };
    const root: Piece = {
      node: { type: 'star', body: sym },
      start: 't2',
      accept: 't3',
      states: ['t0', 't1', 't2', 't3'],
      children: [body],
    };
    const arrow = (from: string, to: string, sym: string) => ({
      id: `${from}->${to}`,
      from,
      to,
      symbols: [sym],
    });
    const input: Automaton = {
      id: 'x',
      name: 'a*',
      kind: 'NFA',
      alphabet: ['a'],
      states: [0, 1, 2, 3].map((n) => ({ id: `t${n}`, label: `q_${n}`, x: 0, y: 0 })),
      starts: ['t2'],
      accepting: ['t3'],
      transitions: [
        arrow('t0', 't1', 'a'),
        arrow('t2', 't0', EPSILON),
        arrow('t1', 't3', EPSILON),
        arrow('t1', 't0', EPSILON),
        arrow('t2', 't3', EPSILON),
      ],
    };
    const before = structuredClone(input);
    const out = layoutPieces(root, input);
    expect(input).toEqual(before);
    const strip = (a: Automaton) => ({
      ...a,
      // toEqual counts an undefined property as absent.
      states: a.states.map((s) => ({ ...s, x: 0, y: 0 })),
      transitions: a.transitions.map((t) => ({ ...t, bend: undefined })),
    });
    expect(strip(out)).toEqual(strip(input));
    expect(out.states.some((s) => s.x !== 0 || s.y !== 0)).toBe(true);
    // Bends only on the back and skip arrows, and on the body's arrow to keep it straight.
    expect(out.transitions.filter((t) => t.bend !== undefined).map((t) => t.id)).toEqual([
      't0->t1',
      't1->t0',
      't2->t3',
    ]);
  });

  it('same regex, same layout (deterministic)', () => {
    expect(thompson('(a|b)*abb').result.states).toEqual(thompson('(a|b)*abb').result.states);
  });
});
