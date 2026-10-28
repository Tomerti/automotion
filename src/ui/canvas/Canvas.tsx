import { useMemo } from 'react';
import { validate } from '../../core/validate';
import { useAppStore } from '../../store/store';
import type { Viewport } from '../../store/types';
import { Diagram } from './Diagram';

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

export function Canvas(): React.JSX.Element {
  const automata = useAppStore((s) => s.automata);
  const activeId = useAppStore((s) => s.activeId);
  const stored = useAppStore((s) => (s.activeId === null ? undefined : s.viewports[s.activeId]));
  const automaton = automata.find((a) => a.id === activeId);

  const highlight = useMemo(() => {
    if (!automaton) return {};
    const issues = validate(automaton).filter((i) => i.severity === 'error');
    return {
      errorStates: issues.flatMap((i) => (i.stateId ? [i.stateId] : [])),
      errorTransitions: issues.flatMap((i) => (i.transitionId ? [i.transitionId] : [])),
    };
  }, [automaton]);

  if (!automaton) {
    return (
      <div className="av-canvas av-canvas-empty" data-testid="canvas">
        Create an automaton to get started
      </div>
    );
  }
  return (
    <div className="av-canvas" data-testid="canvas">
      <Diagram automaton={automaton} viewport={stored ?? DEFAULT_VIEWPORT} highlight={highlight} />
    </div>
  );
}
