import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { State } from '../../core/model';
import type { Viewport } from '../../store/types';
import { fitToView } from '../canvas/viewport';

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

/** Viewport fitting `states` to the size of the element behind the returned ref. */
export function useFittedViewport(states: readonly State[]): {
  ref: React.RefObject<HTMLDivElement | null>;
  viewport: Viewport;
} {
  const { ref, size } = useElementSize();
  const viewport = fitToView(
    states.map((s) => ({ x: s.x, y: s.y })),
    size,
  );
  return { ref, viewport };
}
