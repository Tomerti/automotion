import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addAlphabetSymbol,
  addState,
  moveState,
  parseSymbolInput,
  removeState,
  removeTransition,
  renameState,
  setEdgeSymbols,
  setStart,
  toggleAccepting,
} from '../../core/edit';
import { EPSILON } from '../../core/model';
import type { Automaton, StateId } from '../../core/model';
import { appStore, useAppStore } from '../../store/store';
import type { Selection, Viewport } from '../../store/types';
import { toast } from '../shell/toastStore';
import type { MenuItem } from './ContextMenu';
import { hitRing, STATE_RADIUS, type Point } from './geometry';
import { fitToView, screenToWorld, zoomAt } from './viewport';

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

/** Screen pixels a press must travel before it becomes a drag. */
const DRAG_THRESHOLD = 3;
const ZOOM_STEP = 1.1;
/** Where the symbol input for a new self-loop sits, above the state's center. */
const LOOP_INPUT_OFFSET = STATE_RADIUS + 40;
/** World distance from an edge label's anchor that still counts as hitting it. */
const LABEL_HIT_RADIUS = 12;

const NO_SELECTION: Selection = { states: [], transitions: [] };

type Gesture = { pointerId: number; start: Point; moved: boolean } & (
  | { kind: 'pan'; viewport: Viewport }
  | { kind: 'move'; stateId: StateId; offset: Point }
  | { kind: 'draw'; from: StateId }
);

interface InlineEdit {
  key: number;
  testId: 'symbol-input' | 'rename-input';
  label: string;
  initial: string;
  /** World position the input is centered on. */
  at: Point;
  submit(text: string): string | null;
}

export interface InlineView extends Omit<InlineEdit, 'submit'> {
  onSubmit(text: string): string | null;
  onCancel(): void;
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

/** Fit the active automaton's states into the canvas (no-op while the canvas has no size). */
export function fitActive(): void {
  const a = activeAutomaton();
  const size = canvasSize();
  if (!a || size.width === 0 || size.height === 0) return;
  appStore.getState().setViewport(a.id, fitToView(a.states, size));
}

/**
 * Auto-layout the active automaton as one undo step, then fit it. A layout failure shows an
 * error toast; if the automaton, the active automaton or the trace changes meanwhile, the layout
 * is dropped.
 */
export async function tidyActive(): Promise<void> {
  const a = activeAutomaton();
  if (!a || appStore.getState().trace) return;
  let laidOut: Automaton;
  try {
    // elkjs is large: load it on first use so it stays out of the main bundle.
    const { layoutAutomaton } = await import('../../layout/layout');
    laidOut = await layoutAutomaton(a);
  } catch {
    toast('Could not lay out the automaton', 'error');
    return;
  }
  const now = appStore.getState();
  if (now.activeId !== a.id || activeAutomaton() !== a || now.trace) return;
  const pos = new Map(laidOut.states.map((s) => [s.id, s]));
  // Checkpoint and edit together, after the await, so a dropped layout leaves no undo entry.
  now.checkpoint();
  now.edit(
    (cur) => ({
      ...cur,
      states: cur.states.map((s) => {
        const p = pos.get(s.id);
        return p ? { ...s, x: p.x, y: p.y } : s;
      }),
    }),
    { record: false },
  );
  fitActive();
}

/** Symbols typed for (from, to): unknown ones join the alphabet in the same undo step. */
function commitSymbols(
  from: StateId,
  to: StateId,
  text: string,
  mode: 'merge' | 'replace',
): string | null {
  const a = activeAutomaton();
  if (!a) return null;
  const parsed = parseSymbolInput(text, a.kind);
  if (!parsed.ok) return parsed.error;
  const current = a.transitions.find((t) => t.from === from && t.to === to)?.symbols ?? [];
  const next = mode === 'merge' ? [...current, ...parsed.symbols] : parsed.symbols;
  const unchanged = next.length === current.length && next.every((s) => current.includes(s));
  if (unchanged && parsed.symbols.every((s) => s === EPSILON || a.alphabet.includes(s))) {
    return null;
  }
  appStore.getState().edit((cur) => {
    let out = cur;
    for (const s of parsed.symbols) if (s !== EPSILON) out = addAlphabetSymbol(out, s);
    return setEdgeSymbols(out, from, to, next);
  });
  return null;
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
  const spaceHeld = useRef(false);
  const nextKey = useRef(0);
  const locked = useAppStore((s) => s.trace !== null);
  const selection = useAppStore((s) => s.selection);
  const [rubberBand, setRubberBand] = useState<{ from: Point; to: Point } | null>(null);
  const [inline, setInline] = useState<InlineEdit | null>(null);
  const [menu, setMenu] = useState<MenuView | null>(null);

  const closeMenu = useCallback(() => setMenu(null), []);
  const cancelInline = useCallback(() => setInline(null), []);

  const rect = (): { left: number; top: number } =>
    svgRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
  const toWorld = (e: Pointer): Point =>
    screenToWorld({ x: e.clientX, y: e.clientY }, rect(), viewport);
  const toScreen = (p: Point): Point => ({
    x: p.x * viewport.zoom + viewport.x,
    y: p.y * viewport.zoom + viewport.y,
  });
  const stateAt = (p: Point) => automaton.states.findLast((s) => hitRing(s, p) !== null);
  const edit = (fn: (a: Automaton) => Automaton): void => appStore.getState().edit(fn);

  const openInline = (next: Omit<InlineEdit, 'key'>): void => {
    setMenu(null);
    setInline({ ...next, key: nextKey.current++ });
  };

  const openNewEdge = (from: StateId, to: StateId): void => {
    const a = automaton.states.find((s) => s.id === from);
    const b = automaton.states.find((s) => s.id === to);
    if (!a || !b) return;
    const at =
      from === to
        ? { x: a.x, y: a.y - LOOP_INPUT_OFFSET }
        : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    openInline({
      testId: 'symbol-input',
      label: 'Transition symbols',
      initial: '',
      at,
      submit: (text) => commitSymbols(from, to, text, 'merge'),
    });
  };

  const openEdgeEdit = (transitionId: string, edgeEl: Element): void => {
    const t = automaton.transitions.find((x) => x.id === transitionId);
    const a = automaton.states.find((s) => s.id === t?.from);
    const b = automaton.states.find((s) => s.id === t?.to);
    if (!t || !a || !b) return;
    openInline({
      testId: 'symbol-input',
      label: 'Transition symbols',
      initial: t.symbols.join(', '),
      at: edgeLabelPoint(edgeEl, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }),
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
      stateEl: el?.closest('[data-state-id]') ?? null,
      edgeEl: el?.closest('[data-transition-id]') ?? null,
    };
  };

  const endGesture = (): Gesture | null => {
    const g = gesture.current;
    gesture.current = null;
    svgRef.current?.removeAttribute('data-dragging');
    setRubberBand(null);
    return g;
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>): void => {
    if (e.button !== 0) return;
    containerRef.current?.focus();
    setMenu(null);
    const base = { pointerId: e.pointerId, start: { x: e.clientX, y: e.clientY }, moved: false };
    const { stateEl, edgeEl } = targets(e.target);
    const store = appStore.getState();

    if (locked || spaceHeld.current || (!stateEl && !edgeEl)) {
      gesture.current = { ...base, kind: 'pan', viewport };
      return;
    }
    if (stateEl) {
      const state = automaton.states.find((s) => s.id === stateEl.getAttribute('data-state-id'));
      if (!state) return;
      const p = toWorld(e);
      if (hitRing(state, p) === 'ring') {
        gesture.current = { ...base, kind: 'draw', from: state.id };
      } else {
        store.select({ states: [state.id], transitions: [] });
        const offset = { x: p.x - state.x, y: p.y - state.y };
        gesture.current = { ...base, kind: 'move', stateId: state.id, offset };
      }
      return;
    }
    const transitionId = edgeEl?.getAttribute('data-transition-id');
    if (transitionId) store.select({ states: [], transitions: [transitionId] });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;
    if (!g.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      g.moved = true;
      // Capture only now: capturing on press would retarget click/dblclick to the <svg>.
      svgRef.current?.setPointerCapture?.(g.pointerId);
      if (g.kind === 'move') {
        appStore.getState().checkpoint();
        svgRef.current?.setAttribute('data-dragging', '');
      }
    }
    const store = appStore.getState();
    if (g.kind === 'pan') {
      store.setViewport(automaton.id, {
        ...g.viewport,
        x: g.viewport.x + dx,
        y: g.viewport.y + dy,
      });
    } else if (g.kind === 'move') {
      const p = toWorld(e);
      const pos = { x: p.x - g.offset.x, y: p.y - g.offset.y };
      store.edit((a) => moveState(a, g.stateId, pos), { record: false });
    } else {
      const from = automaton.states.find((s) => s.id === g.from);
      if (!from) return;
      const to = toWorld(e);
      const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      const edge = {
        x: from.x + ((to.x - from.x) / len) * STATE_RADIUS,
        y: from.y + ((to.y - from.y) / len) * STATE_RADIUS,
      };
      setRubberBand({ from: edge, to });
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
    } else if (g.kind === 'draw') {
      if (!g.moved) {
        appStore.getState().select({ states: [g.from], transitions: [] });
        return;
      }
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
        setMenu(null);
        run();
      },
    });
    if (stateId) {
      store.select({ states: [stateId], transitions: [] });
      setMenu({
        at,
        items: [
          item('Set as start', () => edit((a) => setStart(a, stateId))),
          item('Toggle accepting', () => edit((a) => toggleAccepting(a, stateId))),
          item('Delete', () => {
            edit((a) => removeState(a, stateId));
            appStore.getState().select(NO_SELECTION);
          }),
        ],
      });
    } else if (edgeEl && transitionId) {
      store.select({ states: [], transitions: [transitionId] });
      setMenu({
        at,
        items: [
          item('Edit symbols', () => openEdgeEdit(transitionId, edgeEl)),
          item('Delete', () => {
            edit((a) => removeTransition(a, transitionId));
            appStore.getState().select(NO_SELECTION);
          }),
        ],
      });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (locked || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    // Undo can remove a selected item; act only on what still exists.
    const { selection: sel } = appStore.getState();
    const states = sel.states.filter((id) => automaton.states.some((s) => s.id === id));
    const transitions = sel.transitions.filter((id) =>
      automaton.transitions.some((t) => t.id === id),
    );
    const stateId = states[0];
    const key = e.key.toLowerCase();
    if (key === 's' && stateId) {
      edit((a) => setStart(a, stateId));
    } else if (key === 'a' && stateId) {
      edit((a) => toggleAccepting(a, stateId));
    } else if (
      (e.key === 'Delete' || e.key === 'Backspace') &&
      states.length + transitions.length > 0
    ) {
      e.preventDefault();
      edit((a) => {
        let out = a;
        for (const t of transitions) out = removeTransition(out, t);
        for (const s of states) out = removeState(out, s);
        return out;
      });
      appStore.getState().select(NO_SELECTION);
    }
  };

  // Undo/redo and Space (held for panning) are listened for app-wide.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isTyping(e.target)) return;
      if (e.key === ' ') {
        spaceHeld.current = true;
        if (e.target === containerRef.current) e.preventDefault();
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
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
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.key === ' ') spaceHeld.current = false;
    };
    const onBlur = (): void => {
      spaceHeld.current = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
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
          onSubmit: (text) => {
            const error = inline.submit(text);
            if (error === null) setInline(null);
            return error;
          },
          onCancel: cancelInline,
        };

  return {
    containerRef,
    svgRef,
    selection,
    rubberBand,
    inline: inlineView,
    menu,
    closeMenu,
    containerProps: { onKeyDown, onPointerMove, onPointerUp, onPointerCancel },
    svgProps: { onPointerDown, onDoubleClick, onContextMenu },
  };
}
