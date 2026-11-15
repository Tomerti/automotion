import { describe, expect, it } from 'vitest';
import type { Automaton } from '../core/model';
import { EPSILON } from '../core/model';
import { looksLikeLatex, nameFromFile, parseLatex } from './latexImport';
import { splitMembers } from './latexText';

function one(text: string, name = 'Imported'): Automaton {
  const result = parseLatex(text, name);
  if (!result.ok) throw new Error(result.error);
  expect(result.automata).toHaveLength(1);
  return result.automata[0] as Automaton;
}

const byLabel = (a: Automaton, label: string) => {
  const s = a.states.find((x) => x.label === label);
  if (!s) throw new Error(`no state ${label}`);
  return s;
};

/** Transitions as `from -a,b-> to`, by label, sorted. */
function edges(a: Automaton): string[] {
  const label = (id: string) => a.states.find((s) => s.id === id)?.label;
  return a.transitions
    .map((t) => `${label(t.from)} -${t.symbols.join(',')}-> ${label(t.to)}`)
    .sort();
}

const labelsOf = (a: Automaton, ids: string[]) =>
  ids.map((id) => a.states.find((s) => s.id === id)?.label);

// The TikZ manual's automaton example: relative positioning, `on grid`, edges in one \path.
const MANUAL = String.raw`
\begin{tikzpicture}[->,>=stealth',shorten >=1pt,auto,node distance=2.8cm,
                    semithick]
  \tikzstyle{every state}=[fill=red,draw=none,text=white]

  \node[initial,state] (A)                    {$q_a$};
  \node[state]         (B) [above right of=A] {$q_b$};
  \node[state]         (D) [below right of=A] {$q_d$};
  \node[state]         (C) [below right of=B] {$q_c$};
  \node[state]         (E) [below of=D]       {$q_e$};

  \path (A) edge              node {0,1,L} (B)
            edge              node {1,1,R} (C)
        (B) edge [loop above] node {1,1,L} (B)
            edge              node {0,1,L} (C)
        (C) edge              node {0,1,L} (D)
            edge [bend left]  node {1,0,R} (E)
        (D) edge [loop below] node {1,1,R} (D)
            edge              node {0,1,R} (A)
        (E) edge [bend left]  node {1,0,R} (A);
\end{tikzpicture}`;

describe('parseLatex', () => {
  it('reads a DFA placed with positioning', () => {
    const a = one(String.raw`
      \documentclass{article}
      \usepackage{tikz}
      \usetikzlibrary{automata, positioning}
      \begin{document}
      \begin{tikzpicture}[shorten >=1pt, node distance=2cm, on grid, auto]
        \node[state, initial] (q_0) {$q_0$};
        \node[state, accepting] (q_1) [right=of q_0] {$q_1$};
        \path[->]
          (q_0) edge [bend left] node {1} (q_1)
                edge [loop above] node {0} ()
          (q_1) edge [bend left] node {1} (q_0)
                edge [loop above] node {0} ();
      \end{tikzpicture}
      \end{document}`);
    expect(a.kind).toBe('DFA');
    expect(a.states.map((s) => s.label)).toEqual(['q_0', 'q_1']);
    expect(labelsOf(a, a.starts)).toEqual(['q_0']);
    expect(labelsOf(a, a.accepting)).toEqual(['q_1']);
    expect(edges(a)).toEqual(['q_0 -0-> q_0', 'q_0 -1-> q_1', 'q_1 -0-> q_1', 'q_1 -1-> q_0']);
    expect(a.alphabet.sort()).toEqual(['0', '1']);
    // on grid: 2cm centre to centre, y up in TikZ, down on screen.
    expect(byLabel(a, 'q_1').x - byLabel(a, 'q_0').x).toBeCloseTo(100);
    expect(byLabel(a, 'q_1').y).toBeCloseTo(byLabel(a, 'q_0').y);
    // Plain `bend left` on opposite edges is the automatic curve; loops above point up.
    expect(a.transitions.every((t) => t.bend === undefined)).toBe(true);
    for (const t of a.transitions.filter((x) => x.from === x.to)) {
      expect(t.loopAngle).toBeCloseTo(-Math.PI / 2);
    }
  });

  it('reads absolute positions, with y flipped and 50 px to the cm', () => {
    const a = one(String.raw`
      \begin{tikzpicture}
        \node[state] (a) at (0,0) {$a$};
        \node[state] (b) at (2, 1) {$b$};
        \node[state] (c) at (90:1) {$c$};
        \node[state] (d) at (10mm, -0.5cm) {$d$};
      \end{tikzpicture}`);
    const pos = (l: string) => [byLabel(a, l).x, byLabel(a, l).y];
    expect(pos('a')).toEqual([0, -0]);
    expect(pos('b')).toEqual([100, -50]);
    expect(pos('c')[0]).toBeCloseTo(0);
    expect(pos('c')[1]).toBeCloseTo(-50);
    expect(pos('d')).toEqual([50, 25]);
  });

  it('reads the TikZ manual example, with commas making symbols', () => {
    // Its labels are Turing-machine triples ("0,1,L"): as symbols they are 0, 1 and L.
    const a = one(MANUAL);
    expect(a.states.map((s) => s.label)).toEqual(['q_a', 'q_b', 'q_d', 'q_c', 'q_e']);
    expect(labelsOf(a, a.starts)).toEqual(['q_a']);
    expect(a.transitions).toHaveLength(9);
    // Old-style `above right of=A`: the node distance along the diagonal.
    const dx = byLabel(a, 'q_b').x - byLabel(a, 'q_a').x;
    expect(dx).toBeCloseTo((2.8 / Math.SQRT2) * 50);
    expect(byLabel(a, 'q_b').y).toBeLessThan(byLabel(a, 'q_a').y);
    expect(a.kind).toBe('NFA');
  });

  it('reads an NFA: ε, several starts, \\draw with to and --', () => {
    const a = one(String.raw`
      \begin{tikzpicture}[->]
        \node[state, initial] (p) at (0,0) {$p$};
        \node[state, initial below] (q) at (3,0) {$q$};
        \node[state, accepting] (r) at (6,0) {$r$};
        \draw (p) to node {$\varepsilon$} (q);
        \draw (q) -- node[above] {$a, b$} (r);
        \draw (r) to[bend left=40] node {$a$} (p);
      \end{tikzpicture}`);
    expect(a.kind).toBe('NFA');
    expect(edges(a)).toEqual([`p -${EPSILON}-> q`, 'q -a,b-> r', 'r -a-> p']);
    expect(labelsOf(a, a.starts)).toEqual(['p', 'q']);
    expect(byLabel(a, 'p').startAngle).toBeUndefined();
    expect(byLabel(a, 'q').startAngle).toBeCloseTo(Math.PI / 2); // from below, screen y down
    const back = a.transitions.find((t) => t.symbols[0] === 'a' && t.symbols.length === 1);
    // bend left=40 over a 6 cm chord.
    expect(back?.bend).toBeCloseTo(0.75 * 0.3915 * 6 * Math.sin((40 * Math.PI) / 180) * 50);
  });

  it('reads which side of the arrow its label is on', () => {
    /** The label side of p → q, drawn by `path` with p at (0,0) and q at `q`. */
    const side = (path: string, q = '4,0', picture = '->, auto') => {
      const a = one(String.raw`
        \begin{tikzpicture}[${picture}]
          \node[state] (p) at (0,0) {$p$};
          \node[state] (q) at (${q}) {$q$};
          ${path};
        \end{tikzpicture}`);
      expect(a.transitions).toHaveLength(1);
      return a.transitions[0]?.labelSide;
    };
    // `auto` is the left of p → q, which is where AutoMotion puts a straight arrow's label.
    expect(side(String.raw`\path (p) edge node {$a$} (q)`)).toBeUndefined();
    expect(side(String.raw`\path (p) edge [swap] node {$a$} (q)`)).toBe('right');
    expect(side(String.raw`\path (p) edge node[swap] {$a$} (q)`)).toBe('right');
    expect(side(String.raw`\path (p) edge node['] {$a$} (q)`)).toBe('right');
    expect(side(String.raw`\draw (p) to[swap] node {$a$} (q)`)).toBe('right');
    expect(side(String.raw`\path (p) edge node {$a$} (q)`, '4,0', '->, auto=right')).toBe('right');
    // A right bend's automatic label is outside, on its right: `auto` alone puts it inside.
    expect(side(String.raw`\path (p) edge [bend right] node {$a$} (q)`)).toBe('left');
    expect(side(String.raw`\path (p) edge [bend right, swap] node {$a$} (q)`)).toBeUndefined();
    // A label placed by hand: the side it is put on, whatever `auto` says.
    expect(side(String.raw`\draw (p) -- node[above] {$a$} (q)`)).toBeUndefined();
    expect(side(String.raw`\draw (p) -- node[below] {$a$} (q)`)).toBe('right');
    expect(side(String.raw`\draw (p) -- node[below=2pt] {$a$} (q)`)).toBe('right');
    expect(side(String.raw`\draw (p) -- node[right] {$a$} (q)`, '0,4')).toBe('right');
    expect(side(String.raw`\draw (p) -- node[left] {$a$} (q)`, '0,4')).toBeUndefined();
    expect(side(String.raw`\draw (p) -- node[below] {$a$} (q)`, '-4,0')).toBeUndefined();
  });

  it('reads a start arrow drawn by hand, and a label after the target', () => {
    const a = one(String.raw`
      \begin{tikzpicture}
        \node[state] (s) at (0,0) {$s$};
        \node[state, double] (t) at (2,0) {$t$};
        \draw[->] (0,1.5) -- (s);
        \draw[->] (s) -- (t) node[midway, above] {x};
        \node (label) at (5,5) {just a label};
      \end{tikzpicture}`);
    expect(a.states.map((s) => s.label)).toEqual(['s', 't']);
    expect(labelsOf(a, a.starts)).toEqual(['s']);
    expect(byLabel(a, 's').startAngle).toBeCloseTo(-Math.PI / 2); // from above
    expect(labelsOf(a, a.accepting)).toEqual(['t']);
    expect(edges(a)).toEqual(['s -x-> t']);
  });

  it('reads a diagonal start arrow drawn from an anchor (as exported)', () => {
    const a = one(String.raw`
      \begin{tikzpicture}
        \node[state] (s) at (0,0) {$s$};
        \draw[<-] (s.135) -- ++(135:3ex);
      \end{tikzpicture}`);
    expect(labelsOf(a, a.starts)).toEqual(['s']);
    expect(byLabel(a, 's').startAngle).toBeCloseTo((-3 * Math.PI) / 4);
  });

  it('treats every named node as a state when none is styled state', () => {
    const a = one(String.raw`
      \begin{tikzpicture}[every node/.style={circle, draw}]
        \node (a) at (0,0) {a};
        \node[double] (b) at (2,0) {b};
        \draw[->] (a) -- node {1} (b);
      \end{tikzpicture}`);
    expect(a.states.map((s) => s.label)).toEqual(['a', 'b']);
    expect(labelsOf(a, a.accepting)).toEqual(['b']);
  });

  it('merges parallel edges, reads custom loops and ignores comments', () => {
    const a = one(String.raw`
      \begin{tikzpicture}
        \node[state] (a) at (0,0) {$a$}; % \node[state] (ghost) {$g$};
        \node[state] (b) at (2,0) {$b$};
        \path[->] (a) edge node {0} (b) (a) edge node {1} (b)
                  (b) edge [out=60, in=30, loop] node {1} ();
      \end{tikzpicture}`);
    expect(a.states).toHaveLength(2);
    expect(edges(a)).toEqual(['a -0,1-> b', 'b -1-> b']);
    const loop = a.transitions.find((t) => t.from === t.to);
    expect(loop?.loopAngle).toBeCloseTo((-45 * Math.PI) / 180);
  });

  it('places states with no position in a row under the rest', () => {
    const a = one(String.raw`
      \begin{tikzpicture}
        \node[state] (a) at (0,0) {$a$};
        \node[state] (b) {$b$};
        \node[state] (c) {$c$};
      \end{tikzpicture}`);
    // TikZ would draw b and c on top of a, at the origin.
    expect(new Set(a.states.map((s) => `${s.x},${s.y}`)).size).toBe(3);
    expect([byLabel(a, 'a').x, byLabel(a, 'a').y]).toEqual([0, -0]);
    expect(byLabel(a, 'b').y).toBe(100);
    expect(byLabel(a, 'c').x - byLabel(a, 'b').x).toBe(100);
  });

  it('reads several pictures, names them from the AutoMotion comment or the file', () => {
    const result = parseLatex(
      String.raw`
      % AutoMotion NFA: Ends in 01
      \begin{tikzpicture}
        \node[state] (a) at (0,0) {$a$};
      \end{tikzpicture}
      Some text.
      \begin{tikzpicture}
        \draw (0,0) circle (1);
      \end{tikzpicture}
      \begin{tikzpicture}
        \node[state, initial] (b) at (0,0) {$b$};
      \end{tikzpicture}`,
      'notes',
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.automata.map((a) => [a.name, a.kind])).toEqual([
      ['Ends in 01', 'NFA'],
      ['notes 3', 'DFA'],
    ]);
  });

  it('keeps an exported DFA kind even when it is nondeterministic', () => {
    const a = one(String.raw`
      % AutoMotion DFA: Broken
      \begin{tikzpicture}
        \node[state, initial] (a) at (0,0) {$a$};
        \node[state] (b) at (2,0) {$b$};
        \path[->] (a) edge node {0} (b) (a) edge [loop above] node {0} ();
      \end{tikzpicture}`);
    expect(a.kind).toBe('DFA');
    expect(a.name).toBe('Broken');
  });

  it('fails with a reason', () => {
    expect(parseLatex('hello', 'x')).toEqual({
      ok: false,
      error: 'No tikzpicture found in the LaTeX file',
    });
    expect(parseLatex('\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}', 'x')).toEqual(
      {
        ok: false,
        error: 'No automaton found: expected \\node[state] … in a tikzpicture',
      },
    );
    const bad = parseLatex(
      String.raw`\begin{tikzpicture}
        \node[state] (a) at (0,0) {a};
        \path[->] (a) edge [loop above] node {ab} ();
      \end{tikzpicture}`,
      'x',
    );
    expect(bad).toEqual({
      ok: false,
      error: '“ab” is not a single symbol (symbols are single characters)',
    });
  });

  it('gives fresh ids', () => {
    const text = '\\begin{tikzpicture}\\node[state] (a) at (0,0) {a};\\end{tikzpicture}';
    const a = one(text);
    const b = one(text);
    expect(a.id).not.toBe(b.id);
    expect(a.states[0]?.id).not.toBe(b.states[0]?.id);
  });
});

describe('helpers', () => {
  it('nameFromFile drops the folder and extension', () => {
    expect(nameFromFile('C:\\docs\\hw3.tex')).toBe('hw3');
    expect(nameFromFile('ends-in-01.TEX')).toBe('ends-in-01');
    expect(nameFromFile('.tex')).toBe('Imported');
  });

  it('looksLikeLatex spots a tikzpicture', () => {
    expect(looksLikeLatex('x \\begin{tikzpicture} y')).toBe(true);
    expect(looksLikeLatex('{"format": "automotion"}')).toBe(false);
  });

  it('reads a merged comment into the state it names', () => {
    const a = one(String.raw`
\begin{tikzpicture}
  % AutoMotion merged: A = {q_0, {q_1,q_2}}
  \node[state, initial] (A) at (0, 0) {$A$};
  \node[state] (b) at (2, 0) {$b$};
  % AutoMotion merged: nobody = {x, y}
\end{tikzpicture}`);
    expect(byLabel(a, 'A').mergedFrom).toEqual(['q_0', '{q_1,q_2}']);
    expect(byLabel(a, 'b').mergedFrom).toBeUndefined();
  });
});

describe('splitMembers', () => {
  it('splits at ", " outside braces only', () => {
    expect(splitMembers('q_0, {q_0,q_2}, {q_1, q_3}')).toEqual(['q_0', '{q_0,q_2}', '{q_1, q_3}']);
    expect(splitMembers('a')).toEqual(['a']);
    expect(splitMembers('')).toEqual([]);
  });
});
