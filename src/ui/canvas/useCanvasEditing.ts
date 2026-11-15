import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { internalTransitions } from '../../core/clipboard';
import {
  addState,
  commitEdgeSymbols,
  moveState,
  normalizeStateLabel,
  normalizeSymbolText,
  parseSymbolInput,
  removeState,
  removeTransition,
  renameState,
  setEdgeBend,
  setLabelSide,
  setLoopAngle,
  setStart,
  setStartAngle,
  toggleAccepting,
  toggleStart,
} from '../../core/edit';
import { labelBaselineOffset } from '../../core/label';
import type { Automaton, State, StateId, Transition } from '../../core/model';
import { appStore, useAppStore } from '../../store/store';
import type { Selection, Viewport } from '../../store/types';
import { deferPaste, systemClipboardMayBeNewer } from '../shell/pasteLatex';
import { isCtrlLetter, shortcutLetter } from '../shell/shortcut';
import { toast } from '../shell/toastStore';
import type { MenuItem } from './ContextMenu';
import {
  autoBend,
  bendThrough,
  hitState,
  labelFontSize,
  labelSideAt,
  labelSideOf,
  loopAngleToward,
  snapAngle,
  STATE_RADIUS,
  transitionGeometry,
  type PathGeometry,
  type Point,
} from '../../core/geometry';
import { snapPosition, type Snap } from './snap';
import { DRAG_THRESHOLD, ZOOM_STEP, fitToViewInset, screenToWorld, zoomAt } from './viewport';

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

/** Screen pixels a press must travel before it becomes a drag. */
/** World distance from an edge label's anchor that still counts as hitting it. */
const LABEL_HIT_RADIUS = 12;
/** A dragged edge whose bend is within this many screen px of straight snaps straight. */
const STRAIGHT_SNAP = 6;
/** A dragged start arrow or self-loop snaps to the nearest multiple of 45° within this many radians (~8°). */
const ANGLE_STEP = Math.PI / 4;
const ANGLE_SNAP = 0.14;
/** Keep in sync with .av-edge-label in diagramStyles.ts. */
const EDGE_LABEL_FONT_SIZE = 15;

const NO_SELECTION: Selection = { states: [], transitions: [] };
const NO_SNAP_MARKS: SnapMarks = { guides: [], gaps: [] };

/** The snap guides and equal-gap markers of the state being dragged. */
type SnapMarks = Omit<Snap, 'pos'>;

type Gesture = { pointerId: number; start: Point; moved: boolean } & (
  | { kind: 'pan'; viewport: Viewport }
  /**
   * `group`: every state that moves along, by its offset from the grabbed state. `collapse`: a
   * click (no drag) on a state of a multi-selection selects that state alone.
   */
  | {
      kind: 'move';
      stateId: StateId;
      offset: Point;
      group: { id: StateId; dx: number; dy: number }[];
      collapse: boolean;
    }
  /** Ctrl + drag on the canvas: a selection box from `origin`, adding to `base`. */
  | { kind: 'box'; origin: Point; base: Selection }
  | { kind: 'draw'; from: StateId }
  /** `grab`: the bend at the press minus the bend through the press point, so the edge doesn't jump. */
  | { kind: 'bend'; transitionId: string; from: Point; to: Point; grab: number }
  /** An edge's label dragged across it. `recorded`: the undo checkpoint is taken (on the first flip). */
  | { kind: 'label'; transitionId: string; from: Point; to: Point; bend: number; recorded: boolean }
  | { kind: 'loop'; transitionId: string; center: Point }
  | { kind: 'start'; stateId: StateId; center: Point }
);

/** The arrow of a new transition, while it is Shift-dragged and named, in world coordinates. */
export type RubberBand = Pick<PathGeometry, 'd' | 'end' | 'endAngle'> & { loop: boolean };

/** The selection box being dragged, in world coordinates. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface InlineEdit {
  key: number;
  testId: 'symbol-input' | 'rename-input';
  label: string;
  initial: string;
  /** World position the input is centered on. */
  at: Point;
  /** World font size of the label it replaces. */
  fontSize: number;
  /** Where the label it replaces puts its baseline (see `InlineInputProps.baseline`). */
  baseline?(text: string): number;
  /** State or transition whose drawn label the input covers. */
  covers?: string;
  /** The arrow of a new transition, kept on screen while its symbols are typed. */
  draft?: RubberBand;
  normalize?(text: string): string;
  submit(text: string): string | null;
}

export interface InlineView extends Omit<InlineEdit, 'submit' | 'covers' | 'draft'> {
  onSubmit(text: string): string | null;
  /** Escape: close and hand the keyboard back to the canvas. */
  onCancel(): void;
  /** Focus moved elsewhere: commit, close and leave focus where the user put it. */
  onBlur(text: string): void;
}

export interface MenuView {
  at: Point;
  items: MenuItem[];
}

type Pointer = { clientX: number; clientY: number };

function activeAutomaton(): Automaton | undefined {
  const s = appStore.getState();
  return s.automata.find((a) => a.id === s.activeId);
}

/** Ctrl, or ⌘ on a Mac: adds to the selection instead of replacing it. */
const isAdditive = (e: { ctrlKey: boolean; metaKey: boolean }): boolean => e.ctrlKey || e.metaKey;

/** Add state `id` to the selection (with its arrows to selected states) or take it out. */
export function toggleStateInSelection(a: Automaton, sel: Selection, id: StateId): Selection {
  if (sel.states.includes(id)) {
    return {
      states: sel.states.filter((x) => x !== id),
      transitions: sel.transitions.filter((tid) => {
        const t = a.transitions.find((x) => x.id === tid);
        return t !== undefined && t.from !== id && t.to !== id;
      }),
    };
  }
  const states = [...sel.states, id];
  return { states, transitions: union(sel.transitions, internalTransitions(a, states)) };
}

function union(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)
  );
}

function canvasSize(): { width: number; height: number } {
  const el = document.querySelector<HTMLElement>('[data-testid="canvas"]');
  return { width: el?.clientWidth ?? 0, height: el?.clientHeight ?? 0 };
}

/** How far a fit keeps clear of each side: the open history bar's width (`--av-history-inset`). */
export function historyInset(el: Element | null): number {
  if (!el) return 0;
  return parseFloat(getComputedStyle(el).getPropertyValue('--av-history-inset')) || 0;
}

/** How far down a fit keeps clear: the tutorial card while there is one (`--av-tutorial-pad`). */
export function tutorialInset(el: Element | null): number {
  if (!el) return 0;
  return parseFloat(getComputedStyle(el).getPropertyValue('--av-tutorial-pad')) || 0;
}

/**
 * Fit the active automaton's states into the canvas (no-op while the canvas has no size), below
 * the tutorial card while there is one (`--av-tutorial-pad`).
 */
export function fitActive(): void {
  const a = activeAutomaton();
  const size = canvasSize();
  if (!a || size.width === 0 || size.height === 0) return;
  const el = document.querySelector('[data-testid="canvas"]');
  appStore
    .getState()
    .setViewport(a.id, fitToViewInset(a.states, size, historyInset(el), tutorialInset(el)));
}

/**
 * Auto-layout the active automaton as one undo step, then fit it. A layout that draws it as it
 * already is (Tidy pressed again) only fits: no undo entry, no edit. A layout failure shows an
 * error toast; if the automaton, the active automaton or the trace changes meanwhile, the layout
 * is dropped.
 */
export async function tidyActive(): Promise<void> {
  const a = activeAutomaton();
  if (!a || appStore.getState().trace) return;
  let laidOut: Automaton;
  try {
    // In a worker (elk is large, and a big layout takes a second), loaded on first use.
    const { layoutInWorker } = await import('../../layout/layoutClient');
    laidOut = await layoutInWorker(a);
  } catch {
    toast('Could not lay out the automaton', 'error');
    return;
  }
  const now = appStore.getState();
  if (now.activeId !== a.id || activeAutomaton() !== a || now.trace) return;
  if (!sameDrawing(a, withDrawing(a, laidOut))) {
    // Checkpoint and edit together, after the await, so a dropped layout leaves no undo entry.
    now.checkpoint();
    now.edit((cur) => withDrawing(cur, laidOut), { record: false });
  }
  fitActive();
}

/**
 * Whether `a` and `b` (the same automaton, as `withDrawing` makes them) are drawn alike: what
 * `withDrawing` sets is equal on every state and transition.
 */
function sameDrawing(a: Automaton, b: Automaton): boolean {
  const states = new Map(b.states.map((s) => [s.id, s]));
  const transitions = new Map(b.transitions.map((t) => [t.id, t]));
  return (
    a.states.length === b.states.length &&
    a.transitions.length === b.transitions.length &&
    a.states.every((s) => {
      const o = states.get(s.id);
      return o !== undefined && s.x === o.x && s.y === o.y && s.startAngle === o.startAngle;
    }) &&
    a.transitions.every((t) => {
      const o = transitions.get(t.id);
      return (
        o !== undefined &&
        t.bend === o.bend &&
        t.loopAngle === o.loopAngle &&
        t.labelSide === o.labelSide
      );
    })
  );
}

/**
 * `a` drawn as `laidOut` draws it: each state's position and start arrow direction, each
 * transition's bend, loop direction and label side (absent there means automatic here too).
 */
function withDrawing(a: Automaton, laidOut: Automaton): Automaton {
  const states = new Map(laidOut.states.map((s) => [s.id, s]));
  const transitions = new Map(laidOut.transitions.map((t) => [t.id, t]));
  return {
    ...a,
    states: a.states.map((s) => {
      const p = states.get(s.id);
      if (!p) return s;
      const next: State = { ...s, x: p.x, y: p.y };
      delete next.startAngle;
      if (p.startAngle !== undefined) next.startAngle = p.startAngle;
      return next;
    }),
    transitions: a.transitions.map((t) => {
      const p = transitions.get(t.id);
      if (!p) return t;
      const next: Transition = { ...t };
      delete next.bend;
      delete next.loopAngle;
      delete next.labelSide;
      if (p.bend !== undefined) next.bend = p.bend;
      if (p.loopAngle !== undefined) next.loopAngle = p.loopAngle;
      if (p.labelSide !== undefined) next.labelSide = p.labelSide;
      return next;
    }),
  };
}

/**
 * Symbols typed for (from, to). ε is accepted on a DFA too: it switches the automaton to an NFA
 * (with a toast). The store keeps the alphabet in sync.
 */
function commitSymbols(
  from: StateId,
  to: StateId,
  text: string,
  mode: 'merge' | 'replace',
): string | null {
  const a = activeAutomaton();
  if (!a) return null;
  const parsed = parseSymbolInput(text, 'NFA');
  if (!parsed.ok) return parsed.error;
  const current = a.transitions.find((t) => t.from === from && t.to === to)?.symbols ?? [];
  const next = mode === 'merge' ? [...current, ...parsed.symbols] : parsed.symbols;
  const unchanged = next.length === current.length && next.every((s) => current.includes(s));
  if (unchanged) return null;
  let promoted = false;
  appStore.getState().edit((cur) => {
    const result = commitEdgeSymbols(cur, from, to, next);
    promoted = result.promoted;
    return result.automaton;
  });
  if (promoted) toast('Switched to NFA: ε-transitions need an NFA', 'info');
  return null;
}

/** Paste what was copied into the active automaton, centred on world point `at` if given. */
function pasteAt(at?: Point): void {
  const result = appStore.getState().paste(at);
  if (result?.promoted) toast('Switched to NFA: ε-transitions need an NFA', 'info');
}

function commitRename(id: StateId, text: string): string | null {
  const a = activeAutomaton();
  const state = a?.states.find((s) => s.id === id);
  const label = text.trim();
  if (!a || !state || label === '' || label === state.label) return null;
  if (a.states.some((s) => s.id !== id && s.label === label)) {
    return `Two states are named ${label}`;
  }
  appStore.getState().edit((cur) => renameState(cur, id, label));
  return null;
}

/** Straighten an edge; a self-loop goes back to its automatic direction instead. */
function straighten(a: Automaton, transitionId: string): Automaton {
  return {
    ...a,
    transitions: a.transitions.map((t) => {
      if (t.id !== transitionId) return t;
      if (t.from !== t.to) return { ...t, bend: 0 };
      const rest = { ...t };
      delete rest.loopAngle;
      return rest;
    }),
  };
}

/** Draw an edge's label on the other side of it from where it is drawn now. */
function flipLabel(a: Automaton, transitionId: string): Automaton {
  const t = a.transitions.find((x) => x.id === transitionId);
  if (!t) return a;
  const hasReverse = a.transitions.some((o) => o.from === t.to && o.to === t.from);
  const side = labelSideOf(t.bend ?? autoBend(hasReverse), t.labelSide);
  return setLabelSide(a, transitionId, side === 'left' ? 'right' : 'left');
}

/** World position of an edge's label, read from the rendered diagram. */
function edgeLabelPoint(edgeEl: Element, fallback: Point): Point {
  const label = edgeEl.querySelector('[data-testid="edge-label"]');
  const x = Number(label?.getAttribute('x'));
  const y = Number(label?.getAttribute('y'));
  return label && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : fallback;
}

/** Pointer, keyboard and wheel editing for the canvas showing `automaton`. */
export function useCanvasEditing(automaton: Automaton, viewport: Viewport) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const nextKey = useRef(0);
  const locked = useAppStore((s) => s.trace !== null);
  const selection = useAppStore((s) => s.selection);
  const [rubberBand, setRubberBand] = useState<RubberBand | null>(null);
  const [snapMarks, setSnapMarks] = useState<SnapMarks>(NO_SNAP_MARKS);
  const [box, setBox] = useState<Box | null>(null);
  /** Where the pointer last was over the canvas (client px), for pasting there. */
  const pointer = useRef<Point | null>(null);
  /** The current viewport, for the app-wide paste key listener. */
  const viewportRef = useRef(viewport);
  useLayoutEffect(() => {
    viewportRef.current = viewport;
  });
  const [inline, setInline] = useState<InlineEdit | null>(null);
  const [menu, setMenu] = useState<MenuView | null>(null);

  /** Give the keyboard back to the canvas so A/S/Delete work without another click. */
  const refocus = useCallback(() => containerRef.current?.focus(), []);
  const closeMenu = useCallback(() => {
    setMenu(null);
    refocus();
  }, [refocus]);
  const cancelInline = useCallback(() => {
    setInline(null);
    refocus();
  }, [refocus]);

  const rect = (): { left: number; top: number } =>
    svgRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
  const toWorld = (e: Pointer): Point =>
    screenToWorld({ x: e.clientX, y: e.clientY }, rect(), viewport);
  const toScreen = (p: Point): Point => ({
    x: p.x * viewport.zoom + viewport.x,
    y: p.y * viewport.zoom + viewport.y,
  });
  const stateAt = (p: Point) => automaton.states.findLast((s) => hitState(s, p));
  const edit = (fn: (a: Automaton) => Automaton): void => appStore.getState().edit(fn);

  const openInline = (next: Omit<InlineEdit, 'key'>): void => {
    setMenu(null);
    setInline({ ...next, key: nextKey.current++ });
  };

  const openNewEdge = (from: StateId, to: StateId): void => {
    const a = automaton.states.find((s) => s.id === from);
    const b = automaton.states.find((s) => s.id === to);
    if (!a || !b) return;
    // There is one arrow per pair: drawing it again adds to the existing arrow's symbols, typed
    // in place of its label rather than in a second input on top of it.
    const existing = automaton.transitions.find((t) => t.from === from && t.to === to);
    const existingEl = Array.from(
      svgRef.current?.querySelectorAll('[data-transition-id]') ?? [],
    ).find((el) => el.getAttribute('data-transition-id') === existing?.id);
    if (existing && existingEl) {
      openEdgeEdit(existing.id, existingEl, { append: true });
      return;
    }
    // The input sits where the new edge's label will be drawn.
    const { d, label, end, endAngle } = transitionGeometry(automaton, a, b);
    openInline({
      testId: 'symbol-input',
      label: 'Transition symbols',
      initial: '',
      at: label,
      fontSize: EDGE_LABEL_FONT_SIZE,
      draft: { loop: from === to, d, end, endAngle },
      normalize: normalizeSymbolText,
      submit: (text) => commitSymbols(from, to, text, 'merge'),
    });
  };

  /** `append`: the caret goes after a separator, ready for one more symbol. */
  const openEdgeEdit = (
    transitionId: string,
    edgeEl: Element,
    opts: { append?: boolean } = {},
  ): void => {
    const t = automaton.transitions.find((x) => x.id === transitionId);
    const a = automaton.states.find((s) => s.id === t?.from);
    const b = automaton.states.find((s) => s.id === t?.to);
    if (!t || !a || !b) return;
    // As the label draws them: in the monospace symbol font a space after each comma is a whole
    // character wide, so `0, 1` would open twice as spread out as the `0,1` it replaces.
    const symbols = t.symbols.join(',');
    openInline({
      testId: 'symbol-input',
      label: 'Transition symbols',
      initial: opts.append && symbols !== '' ? `${symbols},` : symbols,
      at: edgeLabelPoint(edgeEl, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }),
      fontSize: EDGE_LABEL_FONT_SIZE,
      covers: t.id,
      normalize: normalizeSymbolText,
      submit: (text) => commitSymbols(t.from, t.to, text, 'replace'),
    });
  };

  const openRename = (id: StateId): void => {
    const state = automaton.states.find((s) => s.id === id);
    if (!state) return;
    openInline({
      testId: 'rename-input',
      label: 'State name',
      initial: state.label,
      at: { x: state.x, y: state.y },
      fontSize: labelFontSize(state.label),
      baseline: labelBaselineOffset,
      covers: id,
      normalize: normalizeStateLabel,
      submit: (text) => commitRename(id, text),
    });
  };

  const edgeLabelAt = (p: Point): Element | null =>
    Array.from(svgRef.current?.querySelectorAll('[data-transition-id]') ?? []).find((el) => {
      const at = edgeLabelPoint(el, { x: NaN, y: NaN });
      return Math.hypot(at.x - p.x, at.y - p.y) <= LABEL_HIT_RADIUS;
    }) ?? null;

  const targets = (target: EventTarget | null) => {
    const el = target instanceof Element ? target : null;
    return {
      // A start arrow carries its state's id too: it counts as the state except when dragged.
      stateEl: el?.closest('[data-state-id]') ?? null,
      startEl: el?.closest('[data-testid="start-arrow"]') ?? null,
      edgeEl: el?.closest('[data-transition-id]') ?? null,
      labelEl: el?.closest('[data-testid="edge-label"]') ?? null,
    };
  };

  const endGesture = (): Gesture | null => {
    const g = gesture.current;
    gesture.current = null;
    svgRef.current?.removeAttribute('data-dragging');
    setRubberBand(null);
    setSnapMarks(NO_SNAP_MARKS);
    setBox(null);
    return g;
  };

  /** Delete the selected arrows and states (Delete key, or Delete on a multi-selection). */
  const deleteSelection = (sel: Selection): void => {
    edit((a) => {
      let out = a;
      for (const t of sel.transitions) out = removeTransition(out, t);
      for (const st of sel.states) out = removeState(out, st);
      return out;
    });
    appStore.getState().select(NO_SELECTION);
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>): void => {
    if (e.button !== 0) return;
    containerRef.current?.focus();
    setMenu(null);
    const base = { pointerId: e.pointerId, start: { x: e.clientX, y: e.clientY }, moved: false };
    const { stateEl, startEl, edgeEl, labelEl } = targets(e.target);
    const store = appStore.getState();

    if (locked || (!stateEl && !edgeEl)) {
      gesture.current =
        !locked && isAdditive(e)
          ? { ...base, kind: 'box', origin: toWorld(e), base: store.selection }
          : { ...base, kind: 'pan', viewport };
      return;
    }
    if (stateEl) {
      const state = automaton.states.find((s) => s.id === stateEl.getAttribute('data-state-id'));
      if (!state) return;
      // Ctrl + click: add the state to the selection or take it out.
      if (isAdditive(e) && !e.shiftKey) {
        store.select(toggleStateInSelection(automaton, store.selection, state.id));
        return;
      }
      const sel = store.selection;
      const inGroup = sel.states.length > 1 && sel.states.includes(state.id);
      if (!inGroup || e.shiftKey) store.select({ states: [state.id], transitions: [] });
      if (startEl) {
        gesture.current = { ...base, kind: 'start', stateId: state.id, center: state };
      } else if (e.shiftKey) {
        gesture.current = { ...base, kind: 'draw', from: state.id };
      } else {
        const p = toWorld(e);
        const offset = { x: p.x - state.x, y: p.y - state.y };
        const members = inGroup
          ? automaton.states.filter((s) => sel.states.includes(s.id))
          : [state];
        const group = members.map((m) => ({ id: m.id, dx: m.x - state.x, dy: m.y - state.y }));
        gesture.current = {
          ...base,
          kind: 'move',
          stateId: state.id,
          offset,
          group,
          collapse: inGroup,
        };
      }
      return;
    }
    const t = automaton.transitions.find(
      (x) => x.id === edgeEl?.getAttribute('data-transition-id'),
    );
    const from = automaton.states.find((s) => s.id === t?.from);
    const to = automaton.states.find((s) => s.id === t?.to);
    if (!t || !from || !to) return;
    // Ctrl + click: add the arrow to the selection or take it out.
    if (isAdditive(e) && !e.shiftKey) {
      const sel = store.selection;
      store.select({
        states: sel.states,
        transitions: sel.transitions.includes(t.id)
          ? sel.transitions.filter((x) => x !== t.id)
          : [...sel.transitions, t.id],
      });
      return;
    }
    store.select({ states: [], transitions: [t.id] });
    if (t.from === t.to) {
      gesture.current = { ...base, kind: 'loop', transitionId: t.id, center: from };
    } else {
      const hasReverse = automaton.transitions.some((o) => o.from === t.to && o.to === t.from);
      const bend = t.bend ?? autoBend(hasReverse);
      if (labelEl) {
        // The label moves across the arrow; the arrow itself is bent by dragging its line.
        gesture.current = {
          ...base,
          kind: 'label',
          transitionId: t.id,
          from,
          to,
          bend,
          recorded: false,
        };
      } else {
        const grab = bend - bendThrough(from, to, toWorld(e));
        gesture.current = { ...base, kind: 'bend', transitionId: t.id, from, to, grab };
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    pointer.current = { x: e.clientX, y: e.clientY };
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;
    if (!g.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      g.moved = true;
      // Capture only now: capturing on press would retarget click/dblclick to the <svg>.
      svgRef.current?.setPointerCapture?.(g.pointerId);
      if (g.kind === 'move' || g.kind === 'bend' || g.kind === 'loop' || g.kind === 'start') {
        appStore.getState().checkpoint();
        svgRef.current?.setAttribute('data-dragging', '');
      }
      // A label drag checkpoints on its first flip instead (see the 'label' branch below).
      if (g.kind === 'label') svgRef.current?.setAttribute('data-dragging', '');
    }
    const store = appStore.getState();
    const p = toWorld(e);
    if (g.kind === 'pan') {
      store.setViewport(automaton.id, {
        ...g.viewport,
        x: g.viewport.x + dx,
        y: g.viewport.y + dy,
      });
    } else if (g.kind === 'box') {
      const x = Math.min(g.origin.x, p.x);
      const y = Math.min(g.origin.y, p.y);
      const width = Math.abs(p.x - g.origin.x);
      const height = Math.abs(p.y - g.origin.y);
      setBox({ x, y, width, height });
      const inside = automaton.states
        .filter((s) => s.x >= x && s.x <= x + width && s.y >= y && s.y <= y + height)
        .map((s) => s.id);
      const states = union(g.base.states, inside);
      store.select({
        states,
        transitions: union(g.base.transitions, internalTransitions(automaton, states)),
      });
    } else if (g.kind === 'move') {
      let pos = { x: p.x - g.offset.x, y: p.y - g.offset.y };
      let marks = NO_SNAP_MARKS;
      // Alt held: free placement, no snapping. A group snaps to the states that stay put.
      if (!e.altKey) {
        const others = automaton.states.filter((s) => !g.group.some((m) => m.id === s.id));
        ({ pos, ...marks } = snapPosition(pos, others, viewport.zoom));
      }
      setSnapMarks(marks);
      store.edit(
        (a) =>
          g.group.reduce((out, m) => moveState(out, m.id, { x: pos.x + m.dx, y: pos.y + m.dy }), a),
        { record: false },
      );
    } else if (g.kind === 'bend') {
      const raw = bendThrough(g.from, g.to, p) + g.grab;
      const bend = Math.abs(raw) * viewport.zoom < STRAIGHT_SNAP ? 0 : raw;
      store.edit((a) => setEdgeBend(a, g.transitionId, bend), { record: false });
    } else if (g.kind === 'label') {
      const side = labelSideAt(g.from, g.to, g.bend, p);
      const t = activeAutomaton()?.transitions.find((x) => x.id === g.transitionId);
      if (!t || side === labelSideOf(g.bend, t.labelSide)) return;
      // One undo step for the whole drag, and none for a drag that never crosses the arrow.
      if (!g.recorded) {
        store.checkpoint();
        g.recorded = true;
      }
      store.edit((a) => setLabelSide(a, g.transitionId, side), { record: false });
    } else if (g.kind === 'loop') {
      const raw = loopAngleToward(g.center, p);
      // Alt held: any angle, no snapping.
      const angle = e.altKey ? raw : snapAngle(raw, ANGLE_STEP, ANGLE_SNAP);
      store.edit((a) => setLoopAngle(a, g.transitionId, angle), { record: false });
    } else if (g.kind === 'start') {
      const raw = loopAngleToward(g.center, p);
      // Alt held: any angle, no snapping.
      const angle = e.altKey ? raw : snapAngle(raw, ANGLE_STEP, ANGLE_SNAP);
      store.edit((a) => setStartAngle(a, g.stateId, angle), { record: false });
    } else {
      const from = automaton.states.find((s) => s.id === g.from);
      if (!from) return;
      // Over a state: show the edge (or self-loop) that releasing here would create.
      const target = stateAt(p);
      if (target) {
        const { d, end, endAngle } = transitionGeometry(automaton, from, target);
        setRubberBand({ loop: target.id === from.id, d, end, endAngle });
        return;
      }
      const len = Math.hypot(p.x - from.x, p.y - from.y) || 1;
      const edge = {
        x: from.x + ((p.x - from.x) / len) * STATE_RADIUS,
        y: from.y + ((p.y - from.y) / len) * STATE_RADIUS,
      };
      const d = `M ${edge.x} ${edge.y} L ${p.x} ${p.y}`;
      setRubberBand({ loop: false, d, end: p, endAngle: Math.atan2(p.y - from.y, p.x - from.x) });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    endGesture();
    if (locked) return;
    if (g.kind === 'pan') {
      // A click on the background (no drag) clears the selection.
      if (!g.moved) appStore.getState().select(NO_SELECTION);
    } else if (g.kind === 'move' && !g.moved && g.collapse) {
      appStore.getState().select({ states: [g.stateId], transitions: [] });
    } else if (g.kind === 'draw' && g.moved) {
      const target = stateAt(toWorld(e));
      if (target) openNewEdge(g.from, target.id);
    }
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (gesture.current?.pointerId === e.pointerId) endGesture();
  };

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>): void => {
    if (locked) return;
    const p = toWorld(e);
    // The target can be the <svg> itself (e.g. after pointer capture), so fall back to geometry.
    const hit = targets(e.target);
    const stateId =
      hit.stateEl?.getAttribute('data-state-id') ?? (hit.edgeEl ? undefined : stateAt(p)?.id);
    const edgeEl = stateId ? null : (hit.edgeEl ?? edgeLabelAt(p));
    const transitionId = edgeEl?.getAttribute('data-transition-id');
    if (stateId) openRename(stateId);
    else if (edgeEl && transitionId) openEdgeEdit(transitionId, edgeEl);
    else edit((a) => addState(a, p));
  };

  const onContextMenu = (e: React.MouseEvent<SVGSVGElement>): void => {
    e.preventDefault();
    setMenu(null);
    if (locked) return;
    const r = rect();
    const at = { x: e.clientX - r.left, y: e.clientY - r.top };
    const { stateEl, edgeEl } = targets(e.target);
    const stateId = stateEl?.getAttribute('data-state-id');
    const transitionId = edgeEl?.getAttribute('data-transition-id');
    const store = appStore.getState();
    const item = (label: string, run: () => void): MenuItem => ({
      label,
      onSelect: () => {
        closeMenu();
        run();
      },
    });
    const sel = store.selection;
    if (stateId && sel.states.length > 1 && sel.states.includes(stateId)) {
      // Right-click inside a multi-selection acts on the whole selection.
      // Undo can leave ids of states that are gone in the selection: count only those that exist.
      const n = automaton.states.filter((s) => sel.states.includes(s.id)).length;
      setMenu({
        at,
        items: [
          item(`Cut ${n} states`, () => store.cutSelection()),
          item(`Copy ${n} states`, () => store.copySelection()),
          item(`Delete ${n} states`, () => deleteSelection(appStore.getState().selection)),
        ],
      });
    } else if (stateId) {
      store.select({ states: [stateId], transitions: [] });
      const turned =
        automaton.starts.includes(stateId) &&
        automaton.states.find((s) => s.id === stateId)?.startAngle !== undefined;
      setMenu({
        at,
        items: [
          automaton.kind === 'NFA'
            ? item('Toggle start', () => edit((a) => toggleStart(a, stateId)))
            : item('Set as start', () => edit((a) => setStart(a, stateId))),
          ...(turned
            ? [
                item('Start arrow from the left', () =>
                  edit((a) => setStartAngle(a, stateId, undefined)),
                ),
              ]
            : []),
          item('Toggle accepting', () => edit((a) => toggleAccepting(a, stateId))),
          item('Rename', () => openRename(stateId)),
          item('Cut', () => appStore.getState().cutSelection()),
          item('Copy', () => appStore.getState().copySelection()),
          item('Delete', () => {
            edit((a) => removeState(a, stateId));
            appStore.getState().select(NO_SELECTION);
          }),
        ],
      });
    } else if (edgeEl && transitionId) {
      store.select({ states: [], transitions: [transitionId] });
      const t = automaton.transitions.find((x) => x.id === transitionId);
      setMenu({
        at,
        items: [
          item('Edit symbols', () => openEdgeEdit(transitionId, edgeEl)),
          ...(t && t.from !== t.to
            ? [item('Label on other side', () => edit((a) => flipLabel(a, transitionId)))]
            : []),
          item('Straighten', () => edit((a) => straighten(a, transitionId))),
          item('Delete', () => {
            edit((a) => removeTransition(a, transitionId));
            appStore.getState().select(NO_SELECTION);
          }),
        ],
      });
    } else if (!stateId && !edgeEl && store.clipboard?.kind === 'states') {
      const p = toWorld(e);
      setMenu({ at, items: [item('Paste', () => pasteAt(p))] });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (locked || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    // Enter/Space on a focused button (e.g. a menu item) belong to the button.
    if (e.target instanceof HTMLButtonElement) return;
    // Undo can remove a selected item; act only on what still exists.
    const { selection: sel } = appStore.getState();
    const states = sel.states.filter((id) => automaton.states.some((s) => s.id === id));
    const transitions = sel.transitions.filter((id) =>
      automaton.transitions.some((t) => t.id === id),
    );
    const stateId = states[0];
    const key = shortcutLetter(e);
    if (key === 's' && stateId) {
      e.preventDefault();
      edit((a) => toggleStart(a, stateId));
    } else if (key === 'a' && stateId) {
      e.preventDefault();
      edit((a) => toggleAccepting(a, stateId));
    } else if (
      (e.key === 'Delete' || e.key === 'Backspace') &&
      states.length + transitions.length > 0
    ) {
      e.preventDefault();
      deleteSelection({ states, transitions });
    }
  };

  const onPointerLeave = (): void => {
    pointer.current = null;
  };

  // Select all, cut, copy and paste are listened for app-wide (like undo), so Ctrl+V works right
  // after opening another automaton from the history bar. Typing, selected text and open dialogs
  // keep the browser's own; a key already handled (Ctrl+C on a history entry, the history bar's
  // Ctrl+A, which listens in the capture phase to come first) is left alone.
  // Ctrl+V pastes what was copied last: states into the open automaton, or a whole automaton
  // (copied in the history bar) as a new copy of it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || isTyping(e.target)) return;
      const key = (['a', 'x', 'c', 'v'] as const).find((k) => isCtrlLetter(e, k));
      if (!key) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const store = appStore.getState();
      if (store.trace) return;
      if (key === 'a') {
        const a = store.automata.find((x) => x.id === store.activeId);
        if (!a) return;
        e.preventDefault();
        store.select({
          states: a.states.map((s) => s.id),
          transitions: a.transitions.map((t) => t.id),
        });
        // So Delete, S or A act on it next.
        containerRef.current?.focus({ preventScroll: true });
        return;
      }
      if (key === 'c' || key === 'x') {
        if (window.getSelection()?.isCollapsed === false) return;
        if (key === 'c' ? store.copySelection() : store.cutSelection()) e.preventDefault();
        return;
      }
      // Nothing of the app's own: the `paste` event may still bring LaTeX (pasteLatex.ts).
      if (!store.clipboard) return;
      // At the pointer when it is over the canvas, else a step off where it was copied from.
      const svg = svgRef.current;
      const at =
        pointer.current && svg
          ? screenToWorld(pointer.current, svg.getBoundingClientRect(), viewportRef.current)
          : undefined;
      const run = (): void => {
        const { clipboard, pasteAutomaton } = appStore.getState();
        if (clipboard?.kind === 'automaton') pasteAutomaton();
        else if (clipboard) pasteAt(at);
      };
      // Something may have been copied elsewhere since: let the paste event look at it first.
      if (systemClipboardMayBeNewer()) {
        deferPaste(run);
        return;
      }
      e.preventDefault();
      run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Undo/redo are listened for app-wide, on any keyboard layout (`shortcutLetter`). Not with Alt:
  // AltGr is Ctrl+Alt on Windows, and AltGr+Z types a letter on some layouts (Polish ż).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isTyping(e.target) || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = shortcutLetter(e);
      const store = appStore.getState();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if (key === 'y') {
        e.preventDefault();
        store.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Wheel zoom needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      if (e.deltaY === 0) return;
      const s = appStore.getState();
      if (s.activeId === null) return;
      const r = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const point = { x: e.clientX - r.left, y: e.clientY - r.top };
      s.setViewport(s.activeId, zoomAt(s.viewports[s.activeId] ?? DEFAULT_VIEWPORT, point, factor));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Opening a trace locks editing: drop any edit in progress.
  useEffect(
    () =>
      appStore.subscribe((s, prev) => {
        if (s.trace && !prev.trace) {
          gesture.current = null;
          svgRef.current?.removeAttribute('data-dragging');
          setRubberBand(null);
          setSnapMarks(NO_SNAP_MARKS);
          setInline(null);
          setMenu(null);
        }
      }),
    [],
  );

  const inlineView: InlineView | null =
    inline === null
      ? null
      : {
          key: inline.key,
          testId: inline.testId,
          label: inline.label,
          initial: inline.initial,
          at: toScreen(inline.at),
          fontSize: inline.fontSize * viewport.zoom,
          baseline: inline.baseline,
          normalize: inline.normalize,
          onSubmit: (text) => {
            const error = inline.submit(text);
            if (error === null) cancelInline();
            return error;
          },
          onCancel: cancelInline,
          // An invalid entry is dropped: there is no input left to show the error under.
          onBlur: (text) => {
            inline.submit(text);
            setInline(null);
          },
        };

  return {
    containerRef,
    svgRef,
    selection,
    rubberBand: rubberBand ?? inline?.draft ?? null,
    guides: snapMarks.guides,
    gaps: snapMarks.gaps,
    box,
    inline: inlineView,
    /** Id of the state or transition whose label the inline input covers. */
    editing: inline?.covers,
    menu,
    closeMenu,
    containerProps: { onKeyDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave },
    svgProps: { onPointerDown, onDoubleClick, onContextMenu },
  };
}
