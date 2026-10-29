import { useEffect, useId, useRef, useState } from 'react';
import { CloseIcon } from './icons';

type Mouse = 'click' | 'double' | 'drag' | 'right' | 'scroll';

/** How to do it: keys held (as <kbd>) and/or a mouse action, and where. */
interface Gesture {
  keys?: string[];
  mouse?: Mouse;
  on?: string;
}

interface Row {
  gesture: Gesture;
  action: string;
  hint?: string;
}

interface Tab {
  id: string;
  title: string;
  rows: Row[];
}

const TABS: Tab[] = [
  {
    id: 'build',
    title: 'Build',
    rows: [
      { gesture: { mouse: 'double', on: 'empty canvas' }, action: 'Add a state' },
      {
        gesture: { keys: ['Shift'], mouse: 'drag', on: 'state to state' },
        action: 'Add a transition',
        hint: 'Drop it on the same state for a self-loop',
      },
      {
        gesture: { mouse: 'double', on: 'a state' },
        action: 'Rename the state',
        hint: 'Type \\emptyset for ∅',
      },
      {
        gesture: { mouse: 'double', on: 'an arrow' },
        action: 'Edit its symbols',
        hint: 'Type \\epsilon for ε',
      },
      { gesture: { mouse: 'right', on: 'state or arrow' }, action: 'More options' },
    ],
  },
  {
    id: 'arrange',
    title: 'Arrange',
    rows: [
      {
        gesture: { mouse: 'drag', on: 'a state' },
        action: 'Move it',
        hint: 'Snaps into line; hold Alt to place freely',
      },
      {
        gesture: { mouse: 'drag', on: 'an arrow' },
        action: 'Bend it',
        hint: 'A self-loop turns around its state',
      },
      {
        gesture: { mouse: 'drag', on: 'the start arrow' },
        action: 'Turn it around its state',
        hint: 'Snaps to 45° steps; hold Alt to turn freely',
      },
      { gesture: { mouse: 'drag', on: 'empty canvas' }, action: 'Pan' },
      { gesture: { mouse: 'scroll' }, action: 'Zoom' },
      { gesture: { mouse: 'click', on: 'empty canvas' }, action: 'Clear the selection' },
    ],
  },
  {
    id: 'run',
    title: 'Run',
    rows: [
      {
        gesture: { keys: ['Enter'], on: 'in “Test a word”' },
        action: 'Run the word',
        hint: 'It plays right away. ε or an empty box is the empty word',
      },
      { gesture: { keys: ['Space'] }, action: 'Pause or play' },
      { gesture: { keys: ['→'] }, action: 'Step forward' },
      { gesture: { keys: ['←'] }, action: 'Step back' },
      { gesture: { keys: ['Esc'] }, action: 'Back to editing' },
    ],
  },
  {
    id: 'keys',
    title: 'Keys',
    rows: [
      { gesture: { keys: ['S'], on: 'selected state' }, action: 'Toggle start state' },
      { gesture: { keys: ['A'], on: 'selected state' }, action: 'Toggle accepting' },
      { gesture: { keys: ['Delete'] }, action: 'Delete the selection' },
      {
        gesture: { keys: ['Delete'], on: 'clicked history entry' },
        action: 'Delete that automaton',
      },
      { gesture: { keys: ['Ctrl', 'Z'] }, action: 'Undo' },
      { gesture: { keys: ['Ctrl', 'Y'] }, action: 'Redo' },
      { gesture: { keys: ['?'] }, action: 'Open this guide' },
    ],
  },
];

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

function GestureChip({ gesture }: { gesture: Gesture }): React.JSX.Element {
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
      {on && <span className="av-gesture-on">{on}</span>}
    </span>
  );
}

/**
 * Modal guide to the controls, one tab per task. Escape, the backdrop or the close button
 * dismiss it; ←/→ move between tabs.
 */
export function ControlsDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  const latestClose = useRef(onClose);
  const [tab, setTab] = useState(0);
  const baseId = useId();
  useEffect(() => {
    latestClose.current = onClose;
  });

  useEffect(() => {
    const before = document.activeElement;
    // The dialog itself takes focus (no ring on a button when it opens by itself).
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        // Keep Escape from also closing a trace or a menu underneath.
        e.stopPropagation();
        latestClose.current();
      } else if (e.key === 'Tab') {
        // Keep focus inside the dialog: cycle through the selected tab and the close button.
        const stops = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>('[data-focus-stop]') ?? [],
        ).filter((el) => el.tabIndex >= 0);
        if (stops.length === 0) return;
        e.preventDefault();
        const at = stops.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey
          ? at <= 0
            ? stops.length - 1
            : at - 1
          : at === -1 || at === stops.length - 1
            ? 0
            : at + 1;
        stops[next]?.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (before instanceof HTMLElement) before.focus();
    };
  }, []);

  const tabKeys = (e: React.KeyboardEvent): void => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = (tab + delta + TABS.length) % TABS.length;
    setTab(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  };

  return (
    <div
      className="av-modal-backdrop"
      data-testid="modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="av-modal av-guide"
        role="dialog"
        aria-modal="true"
        aria-label="Controls"
        tabIndex={-1}
      >
        <header className="av-modal-head">
          <h2>Controls</h2>
          <button
            type="button"
            className="av-icon-button"
            aria-label="Close controls"
            title="Close (Esc)"
            data-focus-stop
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>
        <div className="av-guide-tabs" role="tablist" aria-label="Topics" onKeyDown={tabKeys}>
          {TABS.map((t, i) => (
            <button
              key={t.id}
              id={`${baseId}-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={i === tab}
              aria-controls={`${baseId}-panel-${i}`}
              tabIndex={i === tab ? 0 : -1}
              data-focus-stop
              onClick={() => setTab(i)}
            >
              {t.title}
            </button>
          ))}
        </div>
        {/* Every panel sits in the same grid cell, so the dialog is as tall as the longest tab. */}
        <div className="av-guide-panels">
          {TABS.map((t, i) => (
            <ul
              key={t.id}
              id={`${baseId}-panel-${i}`}
              className="av-guide-list"
              role="tabpanel"
              aria-labelledby={`${baseId}-tab-${i}`}
              aria-hidden={i === tab ? undefined : true}
              inert={i !== tab}
              data-current={i === tab}
            >
              {t.rows.map((r) => (
                <li key={r.action} className="av-guide-row">
                  <GestureChip gesture={r.gesture} />
                  <span className="av-guide-what">
                    <span className="av-guide-action">{r.action}</span>
                    {r.hint && <span className="av-guide-hint">{r.hint}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
}
