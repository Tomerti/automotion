import { formatSet } from '../../core/format';
import type { MinimizeTrace } from '../../core/trace';
import { Diagram } from '../canvas/Diagram';
import { LabelText } from '../LabelText';
import { useFittedViewport } from './useFittedViewport';

const TINT_COUNT = 8;

export interface MinimizeTraceViewProps {
  trace: MinimizeTrace;
  stepIndex: number;
}

export function MinimizeTraceView({ trace, stepIndex }: MinimizeTraceViewProps): React.JSX.Element {
  const step = trace.steps[stepIndex];
  const done = step?.phase === 'done';
  const shown = !step || done ? trace.result : step.automaton;
  const { ref, viewport } = useFittedViewport(shown.states);

  if (!step) return <div className="av-trace-view" />;

  // Block i is tint i % 8, as in the legend. On the done step result state i is block i.
  const tints: Record<string, number> = {};
  if (done) {
    trace.result.states.forEach((s, i) => {
      tints[s.id] = i % TINT_COUNT;
    });
  } else {
    step.blocks.forEach((block, i) => {
      for (const id of block) tints[id] = i % TINT_COUNT;
    });
  }

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
        {step.blocks.map((block, i) => (
          <li key={i} className="av-block-legend-item">
            <span className="av-block-swatch" data-tint={i % TINT_COUNT} aria-hidden="true" />
            <LabelText
              text={`${String.fromCharCode(65 + i)}: ${formatSet(step.automaton, block)}`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
