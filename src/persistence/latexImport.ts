import { syncAlphabet } from '../core/edit';
import { newId } from '../core/id';
import { EPSILON } from '../core/model';
import type { Automaton, AutomatonKind, LabelSide, State, Sym, Transition } from '../core/model';
import type { ParseResult } from './fileFormat';
import {
  BEND_APEX,
  MERGED_COMMENT,
  META_COMMENT,
  PX_PER_CM,
  skipGroup,
  splitMembers,
  splitTopLevel,
  texToSymbols,
  texToText,
} from './latexText';
import { automatonSchema } from './schema';

/**
 * Read automata from LaTeX: every `tikzpicture` drawn with the TikZ `automata` library (or plain
 * circle nodes) becomes one automaton. Lenient about how it was written: nodes placed `at (x,y)`,
 * by `right=of q0` / `right of=q0`, or inside a path; transitions as `edge`, `to` or `--`;
 * `loop above`, `bend left=45`, `in`/`out`; start states by `initial` or by an arrow from a point
 * into the state. A `% AutoMotion NFA: name` comment before a picture (as exported) gives its
 * kind and name; otherwise the name comes from the file and the kind from the transitions.
 * `% AutoMotion merged: A = {q_0, q_1}` inside a picture gives state A its `mergedFrom`.
 */

/** TikZ coordinates in cm, y up. */
interface Vec {
  x: number;
  y: number;
}

type Token =
  | { t: 'opts'; text: string }
  | { t: 'coord'; text: string; rel: '' | '+' | '++' }
  | { t: 'brace'; text: string }
  | { t: 'word'; text: string }
  | { t: 'line' }
  | { t: 'dots' };

/** 2.5em at 10pt: the diameter of a TikZ `state`. */
const STATE_DIAMETER = 0.88;
const DEFAULT_NODE_DISTANCE = 1;
/** Spacing of states that no position was given for, in a row under the rest. */
const UNPLACED_GAP = 2;

const CM_PER: Record<string, number> = {
  cm: 1,
  mm: 0.1,
  in: 2.54,
  pt: 2.54 / 72.27,
  bp: 2.54 / 72,
  pc: (12 * 2.54) / 72.27,
  em: (10 * 2.54) / 72.27,
  ex: (4.3 * 2.54) / 72.27,
};

/** A length in cm (`2cm`, `15mm`, `3ex`, a bare number as cm), or null. */
function length(text: string): number | null {
  const m = /^\s*([-+]?(?:\d+\.?\d*|\.\d+))\s*([a-z]{2})?\s*$/.exec(text);
  if (!m) return null;
  const unit = m[2] ?? 'cm';
  const factor = CM_PER[unit];
  return factor === undefined ? null : Number(m[1]) * factor;
}

/** Strip `%` comments (not `\%`). */
function stripComments(text: string): string {
  return text.replace(/(?<!\\)%.*$/gm, '');
}

function tokenize(s: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let rel: '' | '+' | '++' = '';
  while (i < s.length) {
    const ch = s[i] as string;
    if (/\s/.test(ch)) {
      i++;
      continue;
    } else if (ch === '[' || ch === '{' || ch === '(') {
      const end = skipGroup(s, i);
      const text = s.slice(i + 1, end - 1);
      if (ch === '[') out.push({ t: 'opts', text });
      else if (ch === '{') out.push({ t: 'brace', text });
      else out.push({ t: 'coord', text: text.trim(), rel });
      rel = '';
      i = end;
      continue;
    } else if (ch === '+') {
      rel = s[i + 1] === '+' ? '++' : '+';
      i += rel.length;
      continue;
    } else if (s.startsWith('--', i) || s.startsWith('|-', i) || s.startsWith('-|', i)) {
      out.push({ t: 'line' });
      i += 2;
    } else if (s.startsWith('..', i)) {
      out.push({ t: 'dots' });
      i += 2;
    } else if (/[A-Za-z]/.test(ch)) {
      const m = /^[A-Za-z]+/.exec(s.slice(i)) as RegExpExecArray;
      out.push({ t: 'word', text: m[0] });
      i += m[0].length;
    } else if (ch === '\\') {
      const m = /^\\[A-Za-z]+/.exec(s.slice(i));
      i += m ? m[0].length : 2;
    } else {
      i++;
    }
    rel = '';
  }
  return out;
}

/** Index of the first `ch` outside `{}`, `[]` and `()`, or -1. */
function topLevelIndex(text: string, ch: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') i++;
    else if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ch && depth === 0) return i;
  }
  return -1;
}

/** Options as `key` → `value` (`''` for a bare key), in order; later keys win. */
function parseOptions(texts: readonly string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const text of texts) {
    for (const part of splitTopLevel(text)) {
      const eq = topLevelIndex(part, '=');
      if (eq <= 0) map.set(part.replace(/\s+/g, ' '), '');
      else map.set(part.slice(0, eq).trim().replace(/\s+/g, ' '), part.slice(eq + 1).trim());
    }
  }
  return map;
}

/** The arrow direction an option list sets: +1 `->`, -1 `<-`, 0 none. */
function arrowDirection(opts: Map<string, string>): number {
  let dir = 0;
  for (const [key, value] of opts) {
    if (value !== '' || !key.includes('-')) continue;
    const m = /^([^-]*)-([^-]*)$/.exec(key.replace(/\s+/g, ''));
    if (!m) continue;
    const [, back, forth] = m;
    dir = forth === '' && back !== '' ? -1 : forth !== '' ? 1 : dir;
  }
  return dir;
}

const DIRECTIONS: Record<string, Vec> = {
  above: { x: 0, y: 1 },
  below: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Degrees (TikZ, y up) of `initial where` / `loop` sides. */
const SIDE_DEGREES: Record<string, number> = { right: 0, above: 90, left: 180, below: 270 };

function direction(words: string): Vec | null {
  const parts = words.split(' ');
  let v: Vec = { x: 0, y: 0 };
  for (const p of parts) {
    const d = DIRECTIONS[p];
    if (!d) return null;
    v = { x: v.x + d.x, y: v.y + d.y };
  }
  return parts.length > 0 && parts.length <= 2 ? v : null;
}

/** Screen radians (y down) from TikZ degrees (y up), in (-π, π] like atan2. */
function screenAngle(degrees: number): number {
  const r = (-degrees * Math.PI) / 180;
  const a = Math.atan2(Math.sin(r), Math.cos(r));
  return a <= -Math.PI + 1e-12 ? Math.PI : a;
}

/** TikZ anchor names as directions (degrees). */
const ANCHOR_DEGREES: Record<string, number> = {
  east: 0,
  'north east': 45,
  north: 90,
  'north west': 135,
  west: 180,
  'south west': 225,
  south: 270,
  'south east': 315,
};

/** The direction halfway between two angles (degrees), the short way round. */
function meanDegrees(a: number, b: number): number {
  const ra = (a * Math.PI) / 180;
  const rb = (b * Math.PI) / 180;
  return (Math.atan2(Math.sin(ra) + Math.sin(rb), Math.cos(ra) + Math.cos(rb)) * 180) / Math.PI;
}

interface ParsedState {
  name: string;
  label: string;
  pos: Vec;
  /** No position was given (or it couldn't be read): TikZ puts it at the origin. */
  implicit: boolean;
  initial: boolean;
  startDegrees?: number;
  accepting: boolean;
}

interface Edge {
  from: string;
  to: string;
  opts: Map<string, string>;
  /** The options of its label node(s): `node[swap] {a}`, `node[below] {a}`. */
  labelOpts: Map<string, string>;
  symbols: Sym[];
  /** Drawn to → from (`<-`): the label's left and right are the other way round. */
  reversed: boolean;
}

interface PictureContext {
  states: Map<string, ParsedState>;
  /** Named nodes and coordinates that aren't states (a start arrow may come from one). */
  points: Map<string, Vec>;
  edges: Edge[];
  nodeDistance: { v: number; h: number };
  onGrid: boolean;
  scale: number;
  initialWhere: string;
  /** `auto=right` on the picture: labels go on the right of each arrow, not the left. */
  autoRight: boolean;
  /** Only nodes styled `state` are states, if any node is; else every named node is. */
  stateStyled: boolean;
}

/** A coordinate token resolved: a state (with an optional anchor angle), a point, or nothing. */
interface Place {
  state?: string;
  anchorDegrees?: number;
  pos: Vec | null;
}

function resolve(ctx: PictureContext, text: string, current: Place | null): Place {
  if (text === '') return current ?? { pos: null };
  const named = (n: string): Place | null => {
    const st = ctx.states.get(n);
    if (st) return { state: n, pos: st.pos };
    const pt = ctx.points.get(n);
    return pt ? { pos: pt } : null;
  };
  const whole = named(text);
  if (whole) return whole;
  const dot = text.lastIndexOf('.');
  if (dot > 0) {
    const base = named(text.slice(0, dot));
    if (base) {
      const anchor = text
        .slice(dot + 1)
        .trim()
        .replace(/\s+/g, ' ');
      const deg = anchor === '' ? NaN : Number(anchor);
      const anchorDegrees = Number.isFinite(deg) ? deg : ANCHOR_DEGREES[anchor];
      return anchorDegrees === undefined ? base : { ...base, anchorDegrees };
    }
  }
  const polar = /^([^:]+):(.+)$/.exec(text);
  if (polar) {
    const deg = Number((polar[1] as string).trim());
    const r = length(polar[2] as string);
    if (Number.isFinite(deg) && r !== null) {
      const rad = (deg * Math.PI) / 180;
      return { pos: { x: r * Math.cos(rad) * ctx.scale, y: r * Math.sin(rad) * ctx.scale } };
    }
  }
  const parts = splitTopLevel(text);
  if (parts.length === 2) {
    const x = length(parts[0] as string);
    const y = length(parts[1] as string);
    if (x !== null && y !== null) return { pos: { x: x * ctx.scale, y: y * ctx.scale } };
  }
  return { pos: null };
}

/** Where a positioning option (`right=of q0`, `below left=1cm and 2cm of q0`, `right of=q0`) puts a node. */
function positioned(ctx: PictureContext, opts: Map<string, string>, onGrid: boolean): Vec | null {
  for (const [key, value] of opts) {
    const old = /^((?:above|below|left|right)(?: (?:left|right))?) of$/.exec(key);
    if (old) {
      const dir = direction(old[1] as string);
      const target = resolve(ctx, value.trim(), null).pos;
      if (!dir || !target) continue;
      const len = Math.hypot(dir.x, dir.y);
      const d = ctx.nodeDistance.h;
      return { x: target.x + (dir.x / len) * d, y: target.y + (dir.y / len) * d };
    }
    const dir = direction(key);
    const m = /^(.*?)\s*\bof\s+(.+)$/.exec(value);
    if (!dir || !m) continue;
    const target = resolve(ctx, (m[2] as string).trim(), null).pos;
    if (!target) continue;
    let v = ctx.nodeDistance.v;
    let h = ctx.nodeDistance.h;
    const given = m[1] as string;
    if (given !== '') {
      const [a, b] = given.split(/\s+and\s+/);
      const first = length(a ?? '');
      const second = b === undefined ? first : length(b);
      if (first !== null && second !== null) {
        v = first;
        h = second;
      }
    }
    // Without `on grid` the distance runs border to border.
    const pad = onGrid ? 0 : STATE_DIAMETER;
    return { x: target.x + dir.x * (h + pad), y: target.y + dir.y * (v + pad) };
  }
  return null;
}

const isStateStyle = (opts: Map<string, string>): boolean =>
  [...opts.keys()].some((k) => /^state\b/.test(k));
const isAccepting = (opts: Map<string, string>): boolean =>
  [...opts.keys()].some((k) => /^accepting\b/.test(k) || k === 'double' || k === 'double circle');
const isInitial = (opts: Map<string, string>): boolean =>
  [...opts.keys()].some((k) => /^initial(?: by \w+| above| below| left| right)?$/.test(k));

/** The start arrow's direction (TikZ degrees) a node's options ask for. */
function initialDegrees(opts: Map<string, string>, fallback: string): number {
  let where = fallback;
  for (const [key, value] of opts) {
    const m = /^initial (above|below|left|right)$/.exec(key);
    if (m) where = m[1] as string;
    if (key === 'initial where') where = value;
  }
  return SIDE_DEGREES[where] ?? 180;
}

/**
 * A `node` (or `coordinate`) after its keyword: options, name, `at`, label. Advances `i` past it.
 */
function readNode(
  tokens: readonly Token[],
  start: number,
  hasLabel: boolean,
): { opts: string[]; name?: string; at?: string; label?: string; next: number } {
  const node: { opts: string[]; name?: string; at?: string; label?: string } = { opts: [] };
  let i = start;
  while (i < tokens.length) {
    const tok = tokens[i] as Token;
    if (tok.t === 'opts') node.opts.push(tok.text);
    else if (tok.t === 'coord' && node.name === undefined && tok.rel === '') node.name = tok.text;
    else if (tok.t === 'word' && tok.text === 'at' && tokens[i + 1]?.t === 'coord') {
      node.at = (tokens[i + 1] as { text: string }).text;
      i++;
    } else if (tok.t === 'brace' && hasLabel) {
      node.label = tok.text;
      i++;
      break;
    } else break;
    i++;
  }
  return { ...node, next: i };
}

const POSITION_ON_PATH =
  /^(midway|pos|near start|near end|very near start|very near end|at start|at end|sloped)$/;

/** Walk one `\path` / `\draw` / `\node` statement: declare nodes, record transitions and start arrows. */
function walkPath(ctx: PictureContext, tokens: readonly Token[]): void {
  // Cast, not annotated: TypeScript would narrow it to null for good.
  let current = null as Place | null;
  let pathOpts: string[] = [];
  let pending: {
    kind: 'edge' | 'to';
    opts: string[];
    labels: string[];
    labelOpts: string[];
  } | null = null;
  /** The last transition drawn, for a label placed after its target. */
  const seg: { last: Edge | null } = { last: null };

  const connect = (from: Place | null, to: Place, p: NonNullable<typeof pending>): void => {
    if (!from) return;
    const opts = parseOptions([...pathOpts, ...p.opts]);
    const dir = arrowDirection(parseOptions(p.opts)) || arrowDirection(parseOptions(pathOpts)) || 1;
    if (from.state !== undefined && to.state !== undefined) {
      const [a, b] = dir < 0 ? [to.state, from.state] : [from.state, to.state];
      const symbols: Sym[] = [];
      for (const label of p.labels) symbols.push(...texToSymbols(label));
      const labelOpts = parseOptions(p.labelOpts);
      seg.last = { from: a, to: b, opts, labelOpts, symbols, reversed: dir < 0 };
      ctx.edges.push(seg.last);
      return;
    }
    // An arrow from a point into a state marks a start state.
    const [state, point, into] =
      from.state !== undefined ? [from, to, dir < 0] : [to, from, dir > 0];
    if (state.state === undefined || !into) return;
    const st = ctx.states.get(state.state);
    if (!st) return;
    st.initial = true;
    if (state.anchorDegrees !== undefined) st.startDegrees = state.anchorDegrees;
    else if (point.pos) {
      st.startDegrees =
        (Math.atan2(point.pos.y - st.pos.y, point.pos.x - st.pos.x) * 180) / Math.PI;
    }
    seg.last = null;
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] as Token;
    if (tok.t === 'opts') {
      if (pending) pending.opts.push(tok.text);
      else pathOpts = [...pathOpts, tok.text];
    } else if (tok.t === 'word' && (tok.text === 'edge' || tok.text === 'to')) {
      pending = { kind: tok.text, opts: [], labels: [], labelOpts: [] };
    } else if (tok.t === 'line') {
      pending = { kind: 'to', opts: [], labels: [], labelOpts: [] };
    } else if (tok.t === 'dots') {
      // `.. controls (a) and (b) ..`: skip to the second `..`; the next coordinate is the target.
      let j = i + 1;
      while (j < tokens.length && tokens[j]?.t !== 'dots') j++;
      i = j;
      pending = { kind: 'to', opts: [], labels: [], labelOpts: [] };
    } else if (tok.t === 'word' && (tok.text === 'node' || tok.text === 'coordinate')) {
      const node = readNode(tokens, i + 1, tok.text === 'node');
      i = node.next - 1;
      if (pending) {
        if (node.label !== undefined) {
          pending.labels.push(node.label);
          pending.labelOpts.push(...node.opts);
        }
        continue;
      }
      const opts = parseOptions(node.opts);
      if (node.name === undefined) {
        // A label placed along the last segment: `(a) -- (b) node[midway] {x}`.
        const along = [...opts.keys()].some((k) => POSITION_ON_PATH.test(k));
        if (seg.last && node.label !== undefined && along) {
          seg.last.symbols.push(...texToSymbols(node.label));
          for (const [k, v] of opts) seg.last.labelOpts.set(k, v);
        }
        continue;
      }
      const name = node.name;
      const found: Vec | null = node.at
        ? resolve(ctx, node.at, current).pos
        : (positioned(ctx, opts, ctx.onGrid || opts.has('on grid')) ?? current?.pos ?? null);
      const pos = found ?? { x: 0, y: 0 };
      const state =
        tok.text === 'node' &&
        (ctx.stateStyled ? isStateStyle(opts) : true) &&
        node.label !== undefined;
      if (state) {
        const label = texToText(node.label ?? '').trim();
        const initial = isInitial(opts);
        ctx.states.set(name, {
          name,
          label: label === '' ? name : label,
          pos,
          implicit: found === null,
          initial,
          ...(initial ? { startDegrees: initialDegrees(opts, ctx.initialWhere) } : {}),
          accepting: isAccepting(opts),
        });
        current = { state: name, pos };
      } else {
        ctx.points.set(name, pos);
        current = { pos };
      }
    } else if (tok.t === 'coord') {
      const base = tok.rel !== '' ? null : current;
      let place = resolve(ctx, tok.text, base);
      if (tok.rel !== '') {
        const off = resolve(ctx, tok.text, null).pos;
        const from = current?.pos ?? null;
        place = { pos: off && from ? { x: from.x + off.x, y: from.y + off.y } : null };
      }
      if (pending) {
        const p = pending;
        pending = null;
        const target: Place = tok.text === '' ? (current ?? { pos: null }) : place;
        connect(current, target, p);
        if (p.kind === 'to') current = target;
      } else {
        current = place;
      }
    } else if (tok.t === 'word') {
      // circle, rectangle, arc, grid, plot, cycle…: nothing an automaton needs.
      pending = null;
    }
  }
}

/** The statements of a picture body: `\node`, `\draw`, `\path`, … up to their `;`. */
function statements(body: string): { command: string; rest: string }[] {
  const out: { command: string; rest: string }[] = [];
  const re = /\\(node|draw|path|coordinate|filldraw|fill)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    let i = m.index + m[0].length;
    let depth = 0;
    for (; i < body.length; i++) {
      const ch = body[i];
      if (ch === '\\') i++;
      else if (ch === '{' || ch === '[' || ch === '(') depth++;
      else if (ch === '}' || ch === ']' || ch === ')') depth--;
      else if (ch === ';' && depth <= 0) break;
    }
    out.push({ command: m[1] as string, rest: body.slice(m.index + m[0].length, i) });
    re.lastIndex = i + 1;
  }
  return out;
}

/** Bend (world px, positive to the left on screen) of an edge's options, or undefined for automatic. */
const SWAP = (opts: Map<string, string>): boolean => opts.has('swap') || opts.has("'");

/**
 * The side of from → to its label is drawn on. A label placed by hand (`node[below]`) is on the
 * side it is placed; otherwise `auto` puts it on the left (`auto=right`: the right), and `swap`
 * (or `'`) on the edge or its label moves it across.
 */
function labelSideOfEdge(ctx: PictureContext, edge: Edge, from: Vec, to: Vec): LabelSide {
  const flip = (side: LabelSide): LabelSide => (side === 'left' ? 'right' : 'left');
  // The way the path is drawn: from → to, or to → from when it reads `<-`.
  const [p, q] = edge.reversed ? [to, from] : [from, to];
  const place = { x: 0, y: 0 };
  for (const key of edge.labelOpts.keys()) {
    for (const word of key.split(' ')) {
      const d = DIRECTIONS[word];
      if (d) {
        place.x += d.x;
        place.y += d.y;
      }
    }
  }
  const cross = (q.x - p.x) * place.y - (q.y - p.y) * place.x;
  let side: LabelSide;
  if (Math.abs(cross) > 1e-9) side = cross > 0 ? 'left' : 'right';
  else {
    const auto = edge.opts.get('auto');
    side = auto === 'right' || (auto === undefined && ctx.autoRight) ? 'right' : 'left';
    if (SWAP(edge.opts) !== SWAP(edge.labelOpts)) side = flip(side);
  }
  return edge.reversed ? flip(side) : side;
}

function bendOf(edge: Edge, from: Vec, to: Vec, hasReverse: boolean): number | undefined {
  const chord = Math.hypot(to.x - from.x, to.y - from.y);
  const looseness = Number(edge.opts.get('looseness') ?? '1') || 1;
  for (const side of ['bend left', 'bend right'] as const) {
    if (!edge.opts.has(side)) continue;
    const value = edge.opts.get(side) ?? '';
    // A plain `bend left` on a pair of opposite edges is the automatic curve.
    if (value === '' && hasReverse) return undefined;
    const degrees = value === '' ? Number(edge.opts.get('bend angle') ?? '30') : Number(value);
    if (!Number.isFinite(degrees)) return undefined;
    const apex = BEND_APEX * chord * looseness * Math.sin((degrees * Math.PI) / 180) * PX_PER_CM;
    return side === 'bend left' ? apex : -apex;
  }
  const out = Number(edge.opts.get('out'));
  const inn = Number(edge.opts.get('in'));
  if (edge.opts.has('out') && edge.opts.has('in') && Number.isFinite(out) && Number.isFinite(inn)) {
    const chordDeg = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
    const turn = (meanDegrees(out - chordDeg, chordDeg + 180 - inn) * Math.PI) / 180;
    return BEND_APEX * chord * looseness * Math.sin(turn) * PX_PER_CM;
  }
  return undefined;
}

/** Loop direction (screen radians) of a self-loop's options, or undefined for automatic. */
function loopAngleOf(edge: Edge): number | undefined {
  for (const [key] of edge.opts) {
    const m = /^loop (above|below|left|right)$/.exec(key);
    if (m) return screenAngle(SIDE_DEGREES[m[1] as string] as number);
  }
  const out = Number(edge.opts.get('out'));
  const inn = Number(edge.opts.get('in'));
  if (edge.opts.has('out') && edge.opts.has('in') && Number.isFinite(out) && Number.isFinite(inn)) {
    return screenAngle(meanDegrees(out, inn));
  }
  return undefined;
}

function isDeterministic(a: Automaton): boolean {
  const seen = new Set<string>();
  for (const t of a.transitions) {
    for (const s of t.symbols) {
      const key = `${t.from}\u0000${s}`;
      if (seen.has(key)) return false;
      seen.add(key);
    }
  }
  return true;
}

function pictureOptionsContext(optionText: string): Omit<PictureContext, 'stateStyled'> {
  const opts = parseOptions([optionText]);
  const distance = opts.get('node distance') ?? '';
  const [v, h] = distance.split(/\s+and\s+/).map((d) => length(d));
  const vertical = v ?? DEFAULT_NODE_DISTANCE;
  return {
    states: new Map(),
    points: new Map(),
    edges: [],
    nodeDistance: { v: vertical, h: h ?? vertical },
    onGrid: opts.has('on grid'),
    scale: Number(opts.get('scale') ?? '1') || 1,
    initialWhere: opts.get('initial where') ?? 'left',
    autoRight: opts.get('auto') === 'right',
  };
}

/** One picture as an automaton, or null when it draws no states. Throws a user-facing message. */
function readPicture(
  optionText: string,
  body: string,
  name: string,
  kind: AutomatonKind | null,
): Automaton | null {
  const stmts = statements(body).map((s) => ({
    ...s,
    tokens: tokenize(
      s.command === 'node' || s.command === 'coordinate' ? `${s.command} ${s.rest}` : s.rest,
    ),
  }));
  const stateStyled = stmts.some((s) =>
    s.tokens.some((tok, i) => {
      if (tok.t !== 'word' || tok.text !== 'node') return false;
      return isStateStyle(parseOptions(readNode(s.tokens, i + 1, true).opts));
    }),
  );
  const ctx: PictureContext = { ...pictureOptionsContext(optionText), stateStyled };
  for (const s of stmts) walkPath(ctx, s.tokens);
  if (ctx.states.size === 0) return null;

  // A state given no position that lands on an earlier one moves to a row under the rest.
  const parsedStates = [...ctx.states.values()];
  const bottom = Math.min(...parsedStates.map((s) => s.pos.y)) - UNPLACED_GAP;
  let col = 0;
  parsedStates.forEach((s, i) => {
    const onTop = parsedStates
      .slice(0, i)
      .some((o) => Math.hypot(o.pos.x - s.pos.x, o.pos.y - s.pos.y) < 1e-6);
    if (s.implicit && onTop) s.pos = { x: UNPLACED_GAP * col++, y: bottom };
  });

  const ids = new Map<string, string>();
  const states: State[] = [...ctx.states.values()].map((s) => {
    const id = newId();
    ids.set(s.name, id);
    const pos = s.pos;
    const state: State = { id, label: s.label, x: pos.x * PX_PER_CM, y: -pos.y * PX_PER_CM };
    if (s.initial && s.startDegrees !== undefined) {
      // From the left is the default: leave it unset.
      const angle = screenAngle(s.startDegrees);
      if (Math.abs(Math.cos(angle) + 1) > 1e-9) state.startAngle = angle;
    }
    return state;
  });
  const parsed = [...ctx.states.values()];
  const starts = parsed.filter((s) => s.initial).map((s) => ids.get(s.name) as string);
  const accepting = parsed.filter((s) => s.accepting).map((s) => ids.get(s.name) as string);

  const transitions: Transition[] = [];
  const pairs = new Set(ctx.edges.map((e) => `${e.from}\u0000${e.to}`));
  for (const e of ctx.edges) {
    const from = ids.get(e.from) as string;
    const to = ids.get(e.to) as string;
    const existing = transitions.find((t) => t.from === from && t.to === to);
    const t: Transition = existing ?? { id: newId(), from, to, symbols: [] };
    for (const s of e.symbols) if (!t.symbols.includes(s)) t.symbols.push(s);
    if (from === to) {
      const angle = t.loopAngle ?? loopAngleOf(e);
      if (angle !== undefined) t.loopAngle = angle;
    } else if (t.bend === undefined) {
      const a = (ctx.states.get(e.from) as ParsedState).pos;
      const b = (ctx.states.get(e.to) as ParsedState).pos;
      const bend = bendOf(e, a, b, pairs.has(`${e.to}\u0000${e.from}`));
      // Kept even when ~0: `bend left=0` on a pair says straight, not the automatic curve.
      if (bend !== undefined) t.bend = Math.abs(bend) < 1e-9 ? 0 : bend;
      // Only when it isn't where AutoMotion would put it anyway: outside the curve, left if straight.
      const side = labelSideOfEdge(ctx, e, a, b);
      if (side !== ((t.bend ?? 0) < 0 ? 'right' : 'left')) t.labelSide = side;
    }
    if (!existing) transitions.push(t);
  }
  // A transition drawn with no label reads nothing: leave it out.
  const used = transitions.filter((t) => t.symbols.length > 0);

  const automaton = syncAlphabet({
    id: newId(),
    name,
    kind: 'NFA',
    alphabet: [],
    states,
    starts,
    accepting,
    transitions: used,
  });
  // Exported with a kind: keep it (a DFA with two arrows on one symbol is just an invalid DFA),
  // unless only an NFA can have it. Otherwise: a DFA if it is deterministic.
  const nfaOnly =
    automaton.starts.length > 1 || automaton.transitions.some((t) => t.symbols.includes(EPSILON));
  automaton.kind = nfaOnly ? 'NFA' : (kind ?? (isDeterministic(automaton) ? 'DFA' : 'NFA'));
  return automaton;
}

/** The base name of an imported file, for automata without an AutoMotion comment. */
export function nameFromFile(filename: string): string {
  const base = filename.replace(/^.*[\\/]/, '').replace(/\.(tex|tikz|txt)$/i, '');
  return base.trim() === '' ? 'Imported' : base;
}

/** Does this text look like LaTeX (rather than our JSON)? */
export function looksLikeLatex(text: string): boolean {
  return /\\begin\s*\{tikzpicture\}/.test(text);
}

export function parseLatex(text: string, fallbackName: string): ParseResult {
  const pictures: {
    options: string;
    body: string;
    meta?: { kind: AutomatonKind; name: string };
    /** State label → `mergedFrom`, from the picture's merged comments. */
    merged: Map<string, string[]>;
  }[] = [];
  const metas = [...text.matchAll(META_COMMENT)].map((m) => ({
    at: m.index,
    kind: m[1] as AutomatonKind,
    name: (m[2] as string).trim(),
  }));
  const begin = /\\begin\s*\{tikzpicture\}/g;
  let m: RegExpExecArray | null;
  let prevEnd = 0;
  while ((m = begin.exec(text))) {
    const beginAt = m.index;
    const endMatch = /\\end\s*\{tikzpicture\}/g;
    endMatch.lastIndex = m.index;
    const end = endMatch.exec(text);
    if (!end) break;
    let bodyStart = m.index + m[0].length;
    let options = '';
    const raw = text.slice(bodyStart, end.index);
    const merged = new Map(
      [...raw.matchAll(MERGED_COMMENT)].map((c) => [
        (c[1] as string).trim(),
        splitMembers(c[2] as string),
      ]),
    );
    const rest = stripComments(raw);
    const lead = /^\s*\[/.exec(rest);
    let body = rest;
    if (lead) {
      const close = skipGroup(rest, lead[0].length - 1);
      options = rest.slice(lead[0].length, close - 1);
      body = rest.slice(close);
    }
    bodyStart = end.index + end[0].length;
    const meta = metas.filter((x) => x.at >= prevEnd && x.at < beginAt).pop();
    pictures.push({ options, body, merged, ...(meta ? { meta } : {}) });
    prevEnd = bodyStart;
    begin.lastIndex = bodyStart;
  }
  if (pictures.length === 0) {
    return { ok: false, error: 'No tikzpicture found in the LaTeX file' };
  }

  const automata: Automaton[] = [];
  for (const [i, p] of pictures.entries()) {
    const fallback = pictures.length === 1 ? fallbackName : `${fallbackName} ${i + 1}`;
    const name = p.meta?.name || fallback;
    let a: Automaton | null;
    try {
      a = readPicture(p.options, p.body, name, p.meta?.kind ?? null);
    } catch (e) {
      const where = pictures.length === 1 ? '' : `Picture ${i + 1}: `;
      return {
        ok: false,
        error: `${where}${e instanceof Error ? e.message : 'Could not read it'}`,
      };
    }
    if (!a) continue;
    if (p.merged.size > 0) {
      a = {
        ...a,
        states: a.states.map((s) => {
          const mergedFrom = p.merged.get(s.label);
          return mergedFrom && mergedFrom.length > 0 ? { ...s, mergedFrom } : s;
        }),
      };
    }
    const checked = automatonSchema.safeParse(a);
    if (!checked.success) {
      return {
        ok: false,
        error: checked.error.issues[0]?.message ?? 'Could not read the LaTeX file',
      };
    }
    automata.push(a);
  }
  if (automata.length === 0) {
    return { ok: false, error: 'No automaton found: expected \\node[state] … in a tikzpicture' };
  }
  return { ok: true, automata };
}
