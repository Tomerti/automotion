import { useEffect, useMemo } from 'react';
import type { Automaton } from '../../core/model';
import { validate } from '../../core/validate';
import { appStore, useAppStore } from '../../store/store';
import type { Viewport } from '../../store/types';
import { ContextMenu } from './ContextMenu';
import { Diagram } from './Diagram';
import { InlineInput } from './InlineInput';
import { DEFAULT_VIEWPORT, useCanvasEditing } from './useCanvasEditing';
import { fitToView } from './viewport';
import './Canvas.css';

/** Same fallback the trace views use when the element has no measurable size (jsdom). */
const FALLBACK_SIZE = { width: 800, height: 500 };

export function Canvas(): React.JSX.Element {
  const automata = useAppStore((s) => s.automata);
  const activeId = useAppStore((s) => s.activeId);
  const stored = useAppStore((s) => (s.activeId === null ? undefined : s.viewports[s.activeId]));
  const automaton = automata.find((a) => a.id === activeId);

  if (!automaton) {
    return (
      <div className="av-canvas av-canvas-empty" data-testid="canvas">
        <svg className="av-empty-mark" viewBox="0 0 120 64" aria-hidden="true">
          <path d="M4 32h22" />
          <path className="av-empty-head" d="M20 26l7 6-7 6z" />
          <circle cx="52" cy="32" r="22" />
          <path d="M74 32h18" strokeDasharray="3 5" />
          <circle cx="104" cy="32" r="12" strokeDasharray="3 5" />
        </svg>
        <p className="av-empty-title">Create an automaton to get started</p>
        <p className="av-empty-hint">Start with New DFA or New NFA, or import a file.</p>
      </div>
    );
  }
  // Keyed so switching automata drops any gesture, inline input or menu in progress.
  return (
    <EditableCanvas
      key={automaton.id}
      automaton={automaton}
      viewport={stored ?? DEFAULT_VIEWPORT}
      hasViewport={stored !== undefined}
    />
  );
}

function EditableCanvas(props: {
  automaton: Automaton;
  viewport: Viewport;
  hasViewport: boolean;
}): React.JSX.Element {
  const { automaton, viewport, hasViewport } = props;
  const {
    containerRef,
    svgRef,
    containerProps,
    svgProps,
    selection,
    rubberBand,
    inline,
    menu,
    closeMenu,
  } = useCanvasEditing(automaton, viewport);

  // First time this automaton is shown: fit it once; later pans and zooms are kept.
  useEffect(() => {
    if (hasViewport || automaton.states.length === 0) return;
    const el = containerRef.current;
    const width = el && el.clientWidth > 0 ? el.clientWidth : FALLBACK_SIZE.width;
    const height = el && el.clientHeight > 0 ? el.clientHeight : FALLBACK_SIZE.height;
    appStore.getState().setViewport(automaton.id, fitToView(automaton.states, { width, height }));
    // Intentionally once per mount (the canvas is keyed by automaton id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const errors = useMemo(() => {
    const issues = validate(automaton).filter((i) => i.severity === 'error');
    return {
      errorStates: issues.flatMap((i) => (i.stateId ? [i.stateId] : [])),
      errorTransitions: issues.flatMap((i) => (i.transitionId ? [i.transitionId] : [])),
    };
  }, [automaton]);

  const highlight = useMemo(
    () => ({
      ...errors,
      selectedStates: selection.states,
      selectedTransitions: selection.transitions,
    }),
    [errors, selection],
  );

  return (
    <div
      className="av-canvas"
      data-testid="canvas"
      tabIndex={0}
      ref={containerRef}
      {...containerProps}
    >
      <Diagram
        automaton={automaton}
        viewport={viewport}
        highlight={highlight}
        svgRef={svgRef}
        {...svgProps}
      >
        {rubberBand && (
          <line
            className="av-rubber-band"
            data-testid="rubber-band"
            x1={rubberBand.from.x}
            y1={rubberBand.from.y}
            x2={rubberBand.to.x}
            y2={rubberBand.to.y}
          />
        )}
      </Diagram>
      {inline && (
        <InlineInput
          key={inline.key}
          testId={inline.testId}
          label={inline.label}
          initial={inline.initial}
          at={inline.at}
          onSubmit={inline.onSubmit}
          onCancel={inline.onCancel}
        />
      )}
      {menu && <ContextMenu at={menu.at} items={menu.items} onClose={closeMenu} />}
    </div>
  );
}
