import { useEffect, useRef, useState } from 'react';
import { formatSet } from '../../core/format';
import type { MinimizeTrace } from '../../core/trace';
import { Diagram } from '../canvas/Diagram';
import { fitToView } from '../canvas/viewport';

const FALLBACK_SIZE = { width: 800, height: 500 };
const TINT_COUNT = 8;

export interface MinimizeTraceViewProps {
  trace: MinimizeTrace;
  stepIndex: number;
}

export function MinimizeTraceView({ trace, stepIndex }: MinimizeTraceViewProps): React.JSX.Element {
  const step = trace.steps[stepIndex];
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

  if (!step) return <div className="av-trace-view" />;

  const done = step.phase === 'done';
  const shown = done ? trace.result : step.automaton;
  const tints: Record<string, number> = {};
  if (!done) {
    step.blocks.forEach((block, i) => {
      for (const id of block) tints[id] = i % TINT_COUNT;
    });
  }
  const viewport = fitToView(
    shown.states.map((s) => ({ x: s.x, y: s.y })),
    size,
  );
  const legendBlocks = step.blocks;

  return (
    <div className="av-trace-view">
      <div className="av-trace-diagram" ref={ref}>
        <Diagram
          automaton={shown}
          viewport={viewport}
          highlight={{
            tints,
            faded: done ? undefined : step.removed,
            active: step.phase === 'split' ? step.focus.states : undefined,
          }}
        />
      </div>
      <ul className="av-block-legend" data-testid="block-legend">
        {legendBlocks.map((block, i) => (
          <li key={i} className="av-block-legend-item">
            <span className="av-block-swatch" data-tint={i % TINT_COUNT} aria-hidden="true" />
            {`${String.fromCharCode(65 + i)}: ${formatSet(step.automaton, block)}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
