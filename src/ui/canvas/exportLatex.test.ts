import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Automaton, Transition } from '../../core/model';
import { EPSILON } from '../../core/model';
import { fixture } from '../../core/testing/fixtures';
import { arbNfa } from '../../core/testing/arbitraries';
import { parseLatex } from '../../persistence/latexImport';
import { latexDocument, latexDocumentAll, latexPicture, latexSnippet } from './exportLatex';
import { START_ANGLE, autoBend, autoLoopAngle, labelSideOf } from '../../core/geometry';

const parity: Automaton = {
  ...fixture({
    kind: 'DFA',
    alphabet: '01',
    states: ['q_0', 'q_1'],
    start: 'q_0',
    accepting: ['q_0'],
    edges: [
      ['q_0', '0', 'q_1'],
      ['q_1', '0', 'q_0'],
      ['q_0', '1', 'q_0'],
      ['q_1', '1', 'q_1'],
    ],
    name: 'Even number of 0s',
  }),
};
parity.states = [
  { id: 'q_0', label: 'q_0', x: 100, y: 200 },
  { id: 'q_1', label: 'q_1', x: 250, y: 200 },
];
parity.transitions = parity.transitions.map((t) =>
  t.from === t.to ? { ...t, loopAngle: t.from === 'q_0' ? -Math.PI / 2 : Math.PI / 2 } : t,
);

function readBack(text: string): Automaton {
  const result = parseLatex(text, 'fallback');
  if (!result.ok) throw new Error(result.error);
  expect(result.automata).toHaveLength(1);
  return result.automata[0] as Automaton;
}

describe('latexPicture', () => {
  it('draws states at their place, start and accepting, loops and the automatic curves', () => {
    expect(latexPicture(parity))
      .toBe(String.raw`\begin{tikzpicture}[>={Stealth[round]}, shorten >=1pt, auto, semithick]
  \node[state, initial, initial text={}, accepting] (q0) at (0, 0) {$q_0$};
  \node[state] (q1) at (3, 0) {$q_1$};
  \path[->]
    (q0) edge [bend left] node {$0$} (q1)
    (q1) edge [bend left] node {$0$} (q0)
    (q0) edge [loop above] node {$1$} ()
    (q1) edge [loop below] node {$1$} ();
\end{tikzpicture}`);
  });

  it('sets explicit bends as angles, right bends with the label swapped', () => {
    const a = fixture({
      kind: 'NFA',
      alphabet: 'ab',
      states: ['p', 'q'],
      edges: [['p', 'a,b', 'q']],
    });
    a.states = [
      { id: 'p', label: 'p', x: 0, y: 0 },
      { id: 'q', label: 'q', x: 200, y: 0 },
    ];
    const chord = 4; // cm
    const apex = 0.75 * 0.3915 * chord * Math.sin(Math.PI / 6) * 50; // bend left=30
    a.transitions = a.transitions.map((t) => ({ ...t, bend: -apex }));
    expect(latexPicture(a)).toContain('(p) edge [bend right=30, swap] node {$a,b$} (q);');
  });

  it('writes the label side the arrow has: swap puts it on the right of from→to', () => {
    const chord = 4; // cm
    const apex = 0.75 * 0.3915 * chord * Math.sin(Math.PI / 6) * 50; // bend left=30
    const pq = (t: Partial<Transition>): Automaton => {
      const a = fixture({
        kind: 'NFA',
        alphabet: 'a',
        states: ['p', 'q'],
        edges: [['p', 'a', 'q']],
      });
      a.states = [
        { id: 'p', label: 'p', x: 0, y: 0 },
        { id: 'q', label: 'q', x: 200, y: 0 },
      ];
      a.transitions = a.transitions.map((x) => ({ ...x, ...t }));
      return a;
    };
    expect(latexPicture(pq({ labelSide: 'right' }))).toContain('(p) edge [swap] node {$a$} (q);');
    expect(latexPicture(pq({ labelSide: 'left' }))).toContain('(p) edge node {$a$} (q);');
    // Inside the curve: the side `auto` doesn't pick for that bend.
    expect(latexPicture(pq({ bend: apex, labelSide: 'right' }))).toContain(
      '(p) edge [bend left=30, swap] node {$a$} (q);',
    );
    expect(latexPicture(pq({ bend: -apex, labelSide: 'left' }))).toContain(
      '(p) edge [bend right=30] node {$a$} (q);',
    );
  });

  it('keeps a straightened pair of opposite edges straight', () => {
    const a: Automaton = {
      ...parity,
      transitions: parity.transitions.map((t) => ({ ...t, bend: 0 })),
    };
    expect(latexPicture(a)).toContain('(q0) edge [bend left=0] node {$0$} (q1)');
    const back = readBack(latexPicture(a));
    for (const t of back.transitions.filter((x) => x.from !== x.to)) expect(t.bend).toBe(0);
  });

  it('draws a diagonal start arrow by hand, and an axis one with initial where', () => {
    const a = fixture({ kind: 'NFA', alphabet: 'a', states: ['s', 't'], starts: ['s', 't'] });
    a.states = [
      { id: 's', label: 's', x: 0, y: 0, startAngle: (-3 * Math.PI) / 4 },
      { id: 't', label: 't', x: 100, y: 0, startAngle: Math.PI / 2 },
    ];
    const tex = latexPicture(a);
    expect(tex).toContain('\\draw[<-] (s.135) -- ++(135:3ex);');
    expect(tex).toContain('\\node[state, initial, initial where=below, initial text={}] (t)');
  });

  it('names nodes after their labels, or s0, s1, … when that would clash or be empty', () => {
    const a = fixture({ kind: 'DFA', alphabet: 'a', states: ['x', 'y', 'z'] });
    a.states = [
      { id: 'x', label: '{q_0,q_1}', x: 0, y: 0 },
      { id: 'y', label: 'q0q1', x: 100, y: 0 },
      { id: 'z', label: '∅', x: 200, y: 0 },
    ];
    const tex = latexPicture(a);
    expect(tex).toContain('(q0q1) at (0, 0) {$\\{q_0,q_1\\}$}');
    expect(tex).toContain('(s1) at (2, 0) {$q0q1$}');
    expect(tex).toContain('(s2) at (4, 0) {$\\emptyset$}');
  });

  it('is an empty picture for an empty automaton', () => {
    const a = fixture({ kind: 'DFA', alphabet: '', states: [] });
    expect(latexPicture(a)).toBe(
      '\\begin{tikzpicture}[>={Stealth[round]}, shorten >=1pt, auto, semithick]\n\\end{tikzpicture}',
    );
  });
});

describe('latexDocument and latexSnippet', () => {
  it('a standalone document with the libraries and the AutoMotion comment', () => {
    const doc = latexDocument(parity);
    expect(doc.startsWith('\\documentclass[tikz, border=10pt]{standalone}\n')).toBe(true);
    expect(doc).toContain('\\usetikzlibrary{automata, arrows.meta}');
    expect(doc).toContain('% AutoMotion DFA: Even number of 0s\n\\begin{tikzpicture}');
    expect(doc.endsWith('\\end{document}\n')).toBe(true);
  });

  it('latexDocumentAll: one picture per automaton with states, reading back as each of them', () => {
    const nfa: Automaton = {
      ...parity,
      id: 'other',
      name: 'Another one',
      kind: 'NFA',
    };
    const empty: Automaton = { ...parity, id: 'empty', name: 'Blank', states: [], transitions: [] };
    const doc = latexDocumentAll([parity, empty, nfa]);
    expect(doc.startsWith('\\documentclass[tikz, border=10pt]{standalone}\n')).toBe(true);
    expect(doc.match(/\\begin\{tikzpicture\}/g)).toHaveLength(2);
    expect(doc).not.toContain('Blank');
    expect(doc.endsWith('\\end{document}\n')).toBe(true);
    const result = parseLatex(doc, 'fallback');
    if (!result.ok) throw new Error(result.error);
    expect(result.automata.map((a) => [a.name, a.kind])).toEqual([
      ['Even number of 0s', 'DFA'],
      ['Another one', 'NFA'],
    ]);
  });

  it('the snippet says what it needs', () => {
    expect(latexSnippet(parity)).toContain(
      '% Needs \\usepackage{tikz} and \\usetikzlibrary{automata, arrows.meta}',
    );
  });

  it('reads back as the same automaton', () => {
    const back = readBack(latexDocument(parity));
    expect(back.name).toBe('Even number of 0s');
    expect(back.kind).toBe('DFA');
    expect(back.states.map((s) => [s.label, s.x, s.y])).toEqual([
      ['q_0', 0, -0],
      ['q_1', 150, -0],
    ]);
  });
});

/** An automaton with random geometry: positions, bends, loop and start directions. */
const arbDrawn: fc.Arbitrary<Automaton> = arbNfa({ maxStates: 5, epsilon: true }).chain((a) =>
  fc
    .record({
      xy: fc.array(
        fc.tuple(fc.integer({ min: -400, max: 400 }), fc.integer({ min: -400, max: 400 })),
        {
          minLength: a.states.length,
          maxLength: a.states.length,
        },
      ),
      startAngles: fc.array(
        fc.option(fc.integer({ min: -3, max: 4 }).map((k) => (k * Math.PI) / 4)),
        {
          minLength: a.states.length,
          maxLength: a.states.length,
        },
      ),
      bends: fc.array(fc.option(fc.integer({ min: -60, max: 60 })), {
        minLength: a.transitions.length,
        maxLength: a.transitions.length,
      }),
      loops: fc.array(fc.option(fc.integer({ min: -179, max: 180 })), {
        minLength: a.transitions.length,
        maxLength: a.transitions.length,
      }),
      sides: fc.array(fc.option(fc.constantFrom('left' as const, 'right' as const)), {
        minLength: a.transitions.length,
        maxLength: a.transitions.length,
      }),
      extraStart: fc.boolean(),
    })
    .map(({ xy, startAngles, bends, loops, sides, extraStart }) => {
      // Keep states apart so none sits on another.
      const states = a.states.map((s, i) => {
        const [x, y] = xy[i] as [number, number];
        const angle = startAngles[i];
        return {
          ...s,
          label: `q_${i}`,
          x: x + i * 1000,
          y,
          ...(angle !== null && angle !== undefined ? { startAngle: angle } : {}),
        };
      });
      const transitions = a.transitions.map((t, i) => {
        if (t.from === t.to) {
          const deg = loops[i];
          return deg === null || deg === undefined ? t : { ...t, loopAngle: (deg * Math.PI) / 180 };
        }
        const bend = bends[i];
        const side = sides[i];
        return {
          ...t,
          ...(bend === null || bend === undefined ? {} : { bend }),
          ...(side === null || side === undefined ? {} : { labelSide: side }),
        };
      });
      const starts = extraStart && states.length > 1 ? ['q0', 'q1'] : a.starts;
      return { ...a, name: 'Random', kind: 'NFA' as const, states, transitions, starts };
    }),
);

describe('round trip', () => {
  it('export then import keeps states, starts, accepting, transitions and the drawing', () => {
    fc.assert(
      fc.property(arbDrawn, (a) => {
        const back = readBack(latexDocument(a));
        const label = (x: Automaton, id: string) => x.states.find((s) => s.id === id)?.label;
        expect(back.name).toBe(a.name);
        expect(back.kind).toBe('NFA');
        expect(back.states.map((s) => s.label)).toEqual(a.states.map((s) => s.label));
        expect(back.starts.map((id) => label(back, id))).toEqual(
          a.starts.map((id) => label(a, id)),
        );
        expect(back.accepting.map((id) => label(back, id))).toEqual(
          a.accepting.map((id) => label(a, id)),
        );

        const minX = Math.min(...a.states.map((s) => s.x));
        const maxY = Math.max(...a.states.map((s) => s.y));
        a.states.forEach((s, i) => {
          const b = back.states[i];
          expect(Math.abs((b?.x ?? NaN) - (s.x - minX))).toBeLessThanOrEqual(0.5);
          expect(Math.abs((b?.y ?? NaN) - (s.y - maxY))).toBeLessThanOrEqual(0.5);
          if (a.starts.includes(s.id)) {
            const want = s.startAngle ?? START_ANGLE;
            const got = b?.startAngle ?? START_ANGLE;
            expect(Math.abs(Math.sin(want - got)) + (1 - Math.cos(want - got))).toBeLessThan(1e-3);
          }
        });

        const used = a.transitions.filter((t) => t.symbols.length > 0);
        expect(back.transitions).toHaveLength(used.length);
        for (const t of used) {
          const bt = back.transitions.find(
            (x) => label(back, x.from) === label(a, t.from) && label(back, x.to) === label(a, t.to),
          );
          expect(bt).toBeDefined();
          if (!bt) continue;
          expect([...bt.symbols].sort()).toEqual([...t.symbols].sort());
          if (t.from === t.to) {
            const from = a.states.find((s) => s.id === t.from);
            const want = t.loopAngle ?? (from ? autoLoopAngle(a, from) : 0);
            const got = bt.loopAngle ?? NaN;
            expect(Math.abs(Math.atan2(Math.sin(want - got), Math.cos(want - got)))).toBeLessThan(
              1e-3,
            );
          } else if (t.bend === undefined) {
            expect(bt.bend).toBeUndefined();
          } else {
            // Bends go through tenths of a degree (looseness hundredths past 90°): the curve
            // moves by at most that much of the chord, plus position rounding.
            const p = a.states.find((s) => s.id === t.from);
            const q = a.states.find((s) => s.id === t.to);
            const chord = p && q ? Math.hypot(q.x - p.x, q.y - p.y) : 0;
            const tolerance = 0.75 * 0.3915 * chord * ((0.05 * Math.PI) / 180 + 0.005) + 0.5;
            expect(Math.abs((bt.bend ?? 0) - t.bend)).toBeLessThanOrEqual(tolerance);
          }
          if (t.from !== t.to) {
            // The label is drawn on the same side of the arrow (self-loops keep theirs outside).
            const reverse = (x: Automaton, u: Transition) =>
              x.transitions.some((r) => r.from === u.to && r.to === u.from);
            const sideOf = (x: Automaton, u: Transition) =>
              labelSideOf(u.bend ?? autoBend(reverse(x, u)), u.labelSide);
            expect(sideOf(back, bt)).toBe(sideOf(a, t));
          }
        }
        expect(back.transitions.some((t) => t.symbols.includes(EPSILON))).toBe(
          used.some((t) => t.symbols.includes(EPSILON)),
        );
      }),
      { numRuns: 200 },
    );
  });
});
