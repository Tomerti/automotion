import { useMemo } from 'react';
import type { Automaton } from '../../core/model';
import { validate } from '../../core/validate';
import { useAppStore } from '../../store/store';
import type { Viewport } from '../../store/types';
import { ContextMenu } from './ContextMenu';
import { Diagram } from './Diagram';
import { InlineInput } from './InlineInput';
import { DEFAULT_VIEWPORT, useCanvasEditing } from './useCanvasEditing';
import './Canvas.css';

export function Canvas(): React.JSX.Element {
  const automata = useAppStore((s) => s.automata);
  const activeId = useAppStore((s) => s.activeId);
  const stored = useAppStore((s) => (s.activeId === null ? undefined : s.viewports[s.activeId]));
  const automaton = automata.find((a) => a.id === activeId);

  if (!automaton) {
    return (
      <div className="av-canvas av-canvas-empty" data-testid="canvas">
        Create an automaton to get started
      </div>
    );
  }
  // Keyed so switching automata drops any gesture, inline input or menu in progress.
  return (
    <EditableCanvas
      key={automaton.id}
      automaton={automaton}
      viewport={stored ?? DEFAULT_VIEWPORT}
    />
  );
}

function EditableCanvas(props: { automaton: Automaton; viewport: Viewport }): React.JSX.Element {
  const { automaton, viewport } = props;
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
