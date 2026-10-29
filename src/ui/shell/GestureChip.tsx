import { LabelText } from '../LabelText';

export type Mouse = 'click' | 'double' | 'drag' | 'right' | 'scroll';

/** How to do it: keys held (as <kbd>) and/or a mouse action, and where. */
export interface Gesture {
  keys?: string[];
  mouse?: Mouse;
  on?: string;
}

const MOUSE_LABEL: Record<Mouse, string> = {
  click: 'Click',
  double: 'Double-click',
  drag: 'Drag',
  right: 'Right-click',
  scroll: 'Scroll',
};

/** A mouse with the button (or wheel) the gesture uses filled in. */
function MouseGlyph({ mouse }: { mouse: Mouse }): React.JSX.Element {
  return (
    <svg className="av-mouse" viewBox="0 0 14 20" width="12" height="17" aria-hidden="true">
      <rect x="1" y="1" width="12" height="18" rx="6" />
      <path d="M1 8h12 M7 1v7" />
      {mouse === 'right' ? (
        <path className="av-mouse-on" d="M7 1.6a5.4 5.4 0 0 1 5.4 5.4V7.4H7Z" />
      ) : mouse === 'scroll' ? (
        <rect className="av-mouse-on" x="5.6" y="3" width="2.8" height="4" rx="1.4" />
      ) : (
        <path className="av-mouse-on" d="M7 1.6a5.4 5.4 0 0 0 -5.4 5.4V7.4H7Z" />
      )}
    </svg>
  );
}

/** A gesture as a chip: keys as <kbd>, then the mouse action, then where to do it. */
export function GestureChip({ gesture }: { gesture: Gesture }): React.JSX.Element {
  const { keys = [], mouse, on } = gesture;
  return (
    <span className="av-gesture">
      <span className="av-gesture-input">
        {keys.map((k, i) => (
          <span key={k} className="av-gesture-part">
            {i > 0 && <span className="av-gesture-plus">+</span>}
            <kbd>{k}</kbd>
          </span>
        ))}
        {mouse && (
          <span className="av-gesture-part">
            {keys.length > 0 && <span className="av-gesture-plus">+</span>}
            <span className="av-gesture-mouse">
              <MouseGlyph mouse={mouse} />
              {MOUSE_LABEL[mouse]}
            </span>
          </span>
        )}
      </span>
      {on && <LabelText className="av-gesture-on" text={on} />}
    </span>
  );
}
