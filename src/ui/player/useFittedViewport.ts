import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { State } from '../../core/model';
import type { Viewport } from '../../store/types';
import { DRAG_THRESHOLD, ZOOM_STEP, fitToView, zoomAt } from '../canvas/viewport';

/** Size used until the element has been measured (and always in jsdom, which lays nothing out). */
const FALLBACK_SIZE = { width: 800, height: 500 };

/**
 * Current content-box size (inside any padding) of the element behind the returned ref, kept up
 * to date as it resizes.
 */
export function useElementSize(): {
  ref: React.RefObject<HTMLDivElement | null>;
  size: { width: number; height: number };
} {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(FALLBACK_SIZE);

  const measure = useCallback((): void => {
    const el = ref.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const width =
      el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const height =
      el.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
    if (width <= 0 || height <= 0) return;
    setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
  }, []);

  // Measured after every commit, before the browser paints: a ResizeObserver's update renders a
  // frame late, so the diagram would first show fitted to the fallback size (shifted to the
  // left on a wide canvas), or to the padding of the dock that was there before.
  useLayoutEffect(measure);

  // Later resizes (the window, the history bar).
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return { ref, size };
}

export interface FittedViewport {
  ref: React.RefObject<HTMLDivElement | null>;
  viewport: Viewport;
  /** The user zoomed or panned away from the fitted view. */
  moved: boolean;
  /** Back to the fitted view. */
  fit: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
}

/**
 * What the user's view is tied to: the states' extent and the pane's width. The height is left
 * out: it follows the dock, the tutorial card and the minimize legend, which change while stepping.
 */
function viewKey(states: readonly State[], width: number): string {
  if (states.length === 0) return JSON.stringify([width]);
  const xs = states.map((s) => s.x);
  const ys = states.map((s) => s.y);
  const box = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), width];
  return JSON.stringify([states.length === 1, ...box.map((n) => Math.round(n * 100))]);
}

/**
 * Viewport fitting `states` to the size of the element behind the returned ref. Unless
 * `interactive` is false, the wheel zooms around the pointer and dragging pans. The user's view
 * is kept until the states' extent or the pane's width changes, then it is fitted again; a
 * height-only change keeps it, shifted by half the difference so the content stays centred.
 */
export function useFittedViewport(
  states: readonly State[],
  opts: { interactive?: boolean } = {},
): FittedViewport {
  const interactive = opts.interactive ?? true;
  const { ref, size } = useElementSize();
  const fitted = fitToView(
    states.map((s) => ({ x: s.x, y: s.y })),
    size,
  );
  const key = viewKey(states, size.width);
  const height = size.height;
  // `height`: the pane's height when the view was set.
  const [user, setUser] = useState<{ vp: Viewport; key: string; height: number } | null>(null);
  const moved = user !== null && user.key === key;
  const viewport =
    user !== null && moved ? { ...user.vp, y: user.vp.y + (height - user.height) / 2 } : fitted;
  // A view of another fitted target is dropped for good, not just hidden: it must not come back
  // when the target returns to an earlier key.
  if (user !== null && !moved) setUser(null);

  // The latest values for the native listeners, which are registered once.
  const latest = useRef({ viewport, key, height });
  useLayoutEffect(() => {
    latest.current = { viewport, key, height };
  });

  const fit = useCallback((): void => setUser(null), []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      if (e.deltaY === 0) return;
      const r = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const point = { x: e.clientX - r.left, y: e.clientY - r.top };
      const { viewport: vp, key: k, height: h } = latest.current;
      const next = zoomAt(vp, point, factor);
      // Before the re-render, so a second event in the same frame builds on this one.
      latest.current = { viewport: next, key: k, height: h };
      setUser({ vp: next, key: k, height: h });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref, interactive]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent): void => {
      if (!interactive || e.button !== 0) return;
      const el = ref.current;
      const start = { x: e.clientX, y: e.clientY };
      const base = latest.current;
      const pointerId = e.pointerId;
      let dragging = false;
      const move = (ev: PointerEvent): void => {
        if (ev.pointerId !== pointerId) return;
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        if (!dragging) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          dragging = true;
          el?.setPointerCapture?.(pointerId);
        }
        const vp = { ...base.viewport, x: base.viewport.x + dx, y: base.viewport.y + dy };
        setUser({ vp, key: base.key, height: base.height });
      };
      const up = (ev: PointerEvent): void => {
        if (ev.pointerId !== pointerId) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    [ref, interactive],
  );

  return { ref, viewport, moved, fit, onPointerDown };
}
