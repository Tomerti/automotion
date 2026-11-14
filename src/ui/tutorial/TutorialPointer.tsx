import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** How far the corners stand off the element they frame (px). */
const OUTSET = 8;
const CORNERS = ['tl', 'tr', 'bl', 'br'] as const;

/**
 * Four breathing corner brackets framing the element `selector` finds, drawn over everything and
 * letting every click through. It follows the element each frame (states move, the canvas pans and
 * zooms) and hides while the element is missing.
 */
export function TutorialPointer({
  selector,
}: {
  selector: string | null;
}): React.ReactPortal | null {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selector === null) return;
    let frame = 0;
    const place = (): void => {
      const el = ref.current;
      const target = document.querySelector(selector);
      const box = target?.getBoundingClientRect();
      if (el) {
        // A toolbar button: over the top bar, or the bar hides the frame.
        el.toggleAttribute('data-over-bar', target?.closest('.av-topbar') != null);
        if (box && box.width + box.height > 0) {
          el.style.display = '';
          el.style.left = `${box.left - OUTSET}px`;
          el.style.top = `${box.top - OUTSET}px`;
          el.style.width = `${box.width + 2 * OUTSET}px`;
          el.style.height = `${box.height + 2 * OUTSET}px`;
        } else {
          el.style.display = 'none';
        }
      }
      frame = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [selector]);

  if (selector === null) return null;
  return createPortal(
    <div
      ref={ref}
      className="av-tutorial-pointer"
      data-testid="tutorial-pointer"
      aria-hidden="true"
      style={{ display: 'none' }}
    >
      {CORNERS.map((c) => (
        <span key={c} className="av-tutorial-corner" data-corner={c} />
      ))}
    </div>,
    document.body,
  );
}
