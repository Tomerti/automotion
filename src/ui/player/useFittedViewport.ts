import { useEffect, useRef, useState } from 'react';
import type { State } from '../../core/model';
import type { Viewport } from '../../store/types';
import { fitToView } from '../canvas/viewport';

const FALLBACK_SIZE = { width: 800, height: 500 };

/** Viewport fitting `states` to the size of the element behind the returned ref. */
export function useFittedViewport(states: readonly State[]): {
  ref: React.RefObject<HTMLDivElement | null>;
  viewport: Viewport;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(FALLBACK_SIZE);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = (): void => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        setSize({ width: el.clientWidth, height: el.clientHeight });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const viewport = fitToView(
    states.map((s) => ({ x: s.x, y: s.y })),
    size,
  );
  return { ref, viewport };
}
