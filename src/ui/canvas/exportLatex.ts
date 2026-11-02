import type { Automaton, State, Transition } from '../../core/model';
import {
  BEND_APEX,
  PX_PER_CM,
  labelToTex,
  metaComment,
  symbolsToTex,
} from '../../persistence/latexText';
import { START_ANGLE, autoBend, autoLoopAngle, labelSideOf } from './geometry';

/** The TikZ libraries the picture uses. */
export const TIKZ_LIBRARIES = 'automata, arrows.meta';

const PICTURE_OPTIONS = '>={Stealth[round]}, shorten >=1pt, auto, semithick';

const num = (n: number): string => {
  const r = Math.round(n * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r);
};

/** Screen radians (y down) → TikZ degrees (y up), in [0, 360). */
function tikzDegrees(screenAngle: number): number {
  const d = (-screenAngle * 180) / Math.PI;
  return ((d % 360) + 360) % 360;
}

/** The side keyword (`above`, `left`, …) for a direction exactly on an axis, else null. */
function cardinal(degrees: number): 'right' | 'above' | 'left' | 'below' | null {
  const sides = ['right', 'above', 'left', 'below'] as const;
  const k = Math.round(degrees / 90);
  if (Math.abs(degrees - k * 90) > 0.5) return null;
  return sides[k % 4] ?? null;
}

/** The nearest of the eight label sides, for a loop that isn't on an axis. */
function side8(degrees: number): string {
  const sides = [
    'right',
    'above right',
    'above',
    'above left',
    'left',
    'below left',
    'below',
    'below right',
  ];
  return sides[Math.round(degrees / 45) % 8] ?? 'above';
}

/** TikZ node names: the label's letters and digits when that's unique, else `s0`, `s1`, … */
function nodeNames(states: readonly State[]): Map<string, string> {
  const names = new Map<string, string>();
  const used = new Set<string>();
  states.forEach((s, i) => {
    let name = s.label.replace(/[^A-Za-z0-9]/g, '');
    if (name === '' || used.has(name)) name = `s${i}`;
    while (used.has(name)) name += '_';
    used.add(name);
    names.set(s.id, name);
  });
  return names;
}

/** The edge options for a transition between two different states. */
function bendOptions(a: Automaton, t: Transition, from: State, to: State): string[] {
  const hasReverse = a.transitions.some((r) => r.from === t.to && r.to === t.from);
  // `auto` puts the label on the left of from→to; `swap` on the right.
  const swap = labelSideOf(t.bend ?? autoBend(hasReverse), t.labelSide) === 'right' ? ['swap'] : [];
  return [...bendOnly(t, from, to, hasReverse), ...swap];
}

function bendOnly(t: Transition, from: State, to: State, hasReverse: boolean): string[] {
  if (t.bend === undefined) return hasReverse ? ['bend left'] : [];
  const chord = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const ratio = Math.abs(t.bend) / (BEND_APEX * chord);
  const dir = t.bend > 0 ? 'bend left' : 'bend right';
  if (ratio > 1) return [`${dir}=90`, `looseness=${num(ratio)}`];
  // Tenths of a degree: on a long edge a whole degree moves the curve by several px.
  const degrees = Math.round((Math.asin(ratio) * 1800) / Math.PI) / 10;
  // Straight: say so when the pair would otherwise read back as the automatic curve.
  if (degrees === 0) return hasReverse ? ['bend left=0'] : [];
  return [`${dir}=${degrees}`];
}

function loopOptions(a: Automaton, t: Transition, state: State): string[] {
  const degrees = tikzDegrees(t.loopAngle ?? autoLoopAngle(a, state));
  const side = cardinal(degrees);
  if (side) return [`loop ${side}`];
  return [`out=${num(degrees + 15)}`, `in=${num(degrees - 15)}`, 'loop', side8(degrees)];
}

/**
 * The automaton as a TikZ picture (`automata` library), laid out as on the canvas: positions
 * (50 px to the centimetre), start arrow directions, loop directions and bends. Start arrows on
 * a diagonal, which `initial where` can't place, are drawn as plain arrows.
 */
export function latexPicture(a: Automaton): string {
  const names = nodeNames(a.states);
  const name = (id: string): string => names.get(id) ?? id;
  const minX = Math.min(...a.states.map((s) => s.x));
  const maxY = Math.max(...a.states.map((s) => s.y));
  const lines = [`\\begin{tikzpicture}[${PICTURE_OPTIONS}]`];
  const startArrows: string[] = [];

  for (const s of a.states) {
    const opts = ['state'];
    if (a.starts.includes(s.id)) {
      const degrees = tikzDegrees(s.startAngle ?? START_ANGLE);
      const side = cardinal(degrees);
      if (side) {
        opts.push('initial');
        if (side !== 'left') opts.push(`initial where=${side}`);
        opts.push('initial text={}');
      } else {
        const d = num(degrees);
        startArrows.push(`  \\draw[<-] (${name(s.id)}.${d}) -- ++(${d}:3ex);`);
      }
    }
    if (a.accepting.includes(s.id)) opts.push('accepting');
    const x = num((s.x - minX) / PX_PER_CM);
    const y = num((maxY - s.y) / PX_PER_CM);
    lines.push(
      `  \\node[${opts.join(', ')}] (${name(s.id)}) at (${x}, ${y}) {${labelToTex(s.label)}};`,
    );
  }
  lines.push(...startArrows);

  const edges: string[] = [];
  for (const t of a.transitions) {
    const from = a.states.find((s) => s.id === t.from);
    const to = a.states.find((s) => s.id === t.to);
    if (!from || !to || t.symbols.length === 0) continue;
    const loop = from.id === to.id;
    const opts = loop ? loopOptions(a, t, from) : bendOptions(a, t, from, to);
    const optText = opts.length > 0 ? ` [${opts.join(', ')}]` : '';
    const target = loop ? '()' : `(${name(to.id)})`;
    edges.push(`    (${name(from.id)}) edge${optText} node {${symbolsToTex(t.symbols)}} ${target}`);
  }
  if (edges.length > 0) lines.push('  \\path[->]', `${edges.join('\n')};`);

  lines.push('\\end{tikzpicture}');
  return lines.join('\n');
}

/** For the clipboard: the picture, after a comment naming the automaton and what it needs. */
export function latexSnippet(a: Automaton): string {
  return [
    metaComment(a.kind, a.name),
    `% Needs \\usepackage{tikz} and \\usetikzlibrary{${TIKZ_LIBRARIES}}`,
    latexPicture(a),
    '',
  ].join('\n');
}

/** A standalone document that compiles on its own to just the diagram. */
export function latexDocument(a: Automaton): string {
  return [
    '\\documentclass[tikz, border=10pt]{standalone}',
    `\\usetikzlibrary{${TIKZ_LIBRARIES}}`,
    '\\begin{document}',
    metaComment(a.kind, a.name),
    latexPicture(a),
    '\\end{document}',
    '',
  ].join('\n');
}
