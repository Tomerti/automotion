import { useEffect, useMemo } from 'react';
import type { Automaton } from '../../core/model';
import { ignoringIncomplete, validate } from '../../core/validate';
import { appStore, useAppStore } from '../../store/store';
import type { Viewport } from '../../store/types';
import { ContextMenu } from './ContextMenu';
import { Diagram } from './Diagram';
import { Arrowhead } from './EdgeView';
import { InlineInput } from './InlineInput';
import { useIssueMarks } from './issueMarks';
import type { Gap } from './snap';
import { DEFAULT_VIEWPORT, historyInset, useCanvasEditing } from './useCanvasEditing';
import { fitToViewInset } from './viewport';
import './Canvas.css';

/** Same fallback the trace views use when the element has no measurable size (jsdom). */
const FALLBACK_SIZE = { width: 800, height: 500 };
/** Half the length of the end ticks on an equal-gap marker, in world units. */
const GAP_TICK = 5;

/** An equal-gap marker as a dimension line: the gap's span with a tick across each end. */
function gapMarkerPath({ x1, y1, x2, y2 }: Gap): string {
  const [tx, ty] = y1 === y2 ? [0, GAP_TICK] : [GAP_TICK, 0];
  return (
    `M${x1} ${y1}L${x2} ${y2}` +
    `M${x1 - tx} ${y1 - ty}L${x1 + tx} ${y1 + ty}` +
    `M${x2 - tx} ${y2 - ty}L${x2 + tx} ${y2 + ty}`
  );
}

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
        <p className="av-empty-hint">Use Create or Import in the history bar.</p>
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
    guides,
    gaps,
    box,
    inline,
    editing,
    menu,
    closeMenu,
  } = useCanvasEditing(automaton, viewport);

  // First time this automaton is shown: fit it once; later pans and zooms are kept.
  useEffect(() => {
    if (hasViewport || automaton.states.length === 0) return;
    const el = containerRef.current;
    const width = el && el.clientWidth > 0 ? el.clientWidth : FALLBACK_SIZE.width;
    const height = el && el.clientHeight > 0 ? el.clientHeight : FALLBACK_SIZE.height;
    appStore
      .getState()
      .setViewport(
        automaton.id,
        fitToViewInset(automaton.states, { width, height }, historyInset(el)),
      );
    // Intentionally once per mount (the canvas is keyed by automaton id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issueMarks = useIssueMarks();
  const errors = useMemo(() => {
    // An incomplete DFA is normal mid-build: its states are marked only while the issues
    // popover is open (`issueMarks`), not painted red all the time.
    const issues = ignoringIncomplete(validate(automaton)).filter((i) => i.severity === 'error');
    return {
      errorStates: issues.flatMap((i) => (i.stateId ? [i.stateId] : [])),
      errorTransitions: issues.flatMap((i) => (i.transitionId ? [i.transitionId] : [])),
    };
  }, [automaton]);

  const highlight = useMemo(
    () => ({
      ...errors,
      issueMarks,
      selectedStates: selection.states,
      selectedTransitions: selection.transitions,
      editing,
    }),
    [errors, issueMarks, selection, editing],
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
        {guides.map((g) => (
          <line
            key={g.x1 === g.x2 ? 'vertical' : 'horizontal'}
            className="av-snap-guide"
            data-testid="snap-guide"
            x1={g.x1}
            y1={g.y1}
            x2={g.x2}
            y2={g.y2}
          />
        ))}
        {gaps.map((g) => (
          <path
            key={`${g.x1},${g.y1}`}
            className="av-gap-guide"
            data-testid="gap-guide"
            d={gapMarkerPath(g)}
          />
        ))}
        {box && (
          <rect
            className="av-select-box"
            data-testid="select-box"
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
          />
        )}
        {rubberBand && (
          <g
            className="av-rubber-band"
            data-testid="rubber-band"
            data-loop={String(rubberBand.loop)}
          >
            <path className="av-edge-path" d={rubberBand.d} />
            <Arrowhead end={rubberBand.end} angle={rubberBand.endAngle} />
          </g>
        )}
      </Diagram>
      {automaton.states.length === 0 && (
        <div className="av-canvas-hint" data-testid="canvas-hint">
          <p className="av-canvas-hint-main">Double-click to add a state · Press ? for controls</p>
          <p className="av-canvas-hint-alt">
            Or paste a TikZ picture with Ctrl+V, or drop a .json or .tex file here
          </p>
        </div>
      )}
      {inline && (
        <InlineInput
          key={inline.key}
          testId={inline.testId}
          label={inline.label}
          initial={inline.initial}
          at={inline.at}
          fontSize={inline.fontSize}
          normalize={inline.normalize}
          onSubmit={inline.onSubmit}
          onCancel={inline.onCancel}
          onBlur={inline.onBlur}
        />
      )}
      {menu && <ContextMenu at={menu.at} items={menu.items} onClose={closeMenu} />}
    </div>
  );
}
