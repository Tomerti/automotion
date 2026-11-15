import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** How far the corners stand off the element they frame (px). */
const OUTSET = 8;
/**
 * The same for a button (a toolbar button, the player's buttons): they sit near the window's top
 * edge or right next to other buttons, so the frame hugs them and breathes less (`data-tight`).
 */
const TIGHT_OUTSET = 3;
/**
 * A button that starts with an icon: the icon's thin left end reads as extra space, so the frame,
 * though centred on the button, looks shifted left. Move it right this much.
 */
const ICON_NUDGE = 2;
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
        const tight = target instanceof HTMLButtonElement;
        el.toggleAttribute('data-tight', tight);
        const out = tight ? TIGHT_OUTSET : OUTSET;
        const nudge = tight && target.firstElementChild instanceof SVGElement ? ICON_NUDGE : 0;
        if (box && box.width + box.height > 0) {
          el.style.display = '';
          el.style.left = `${box.left - out + nudge}px`;
          el.style.top = `${box.top - out}px`;
          el.style.width = `${box.width + 2 * out}px`;
          el.style.height = `${box.height + 2 * out}px`;
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
