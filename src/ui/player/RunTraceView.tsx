import type { RunTrace } from '../../core/trace';
import { Diagram } from '../canvas/Diagram';
import { useFittedViewport } from './useFittedViewport';

export interface RunTraceViewProps {
  trace: RunTrace;
  stepIndex: number;
}

export function RunTraceView({ trace, stepIndex }: RunTraceViewProps): React.JSX.Element {
  const step = trace.steps[stepIndex];
  const { ref, viewport } = useFittedViewport(trace.source.states);

  if (!step) return <div className="av-trace-view" />;

  const chars = [...trace.word];
  const currentIndex =
    step.phase === 'read' ? step.position - 1 : step.phase === 'stuck' ? step.position : -1;
  const charState = (i: number): 'consumed' | 'current' | 'pending' =>
    i === currentIndex ? 'current' : i < step.position ? 'consumed' : 'pending';

  const isLast = stepIndex === trace.steps.length - 1;

  return (
    <div className="av-trace-view">
      <div className="av-word" aria-label="Word progress">
        {chars.length === 0 ? (
          <span className="av-word-empty">ε</span>
        ) : (
          chars.map((ch, i) => (
            <span key={i} className="av-word-char" data-testid="word-char" data-state={charState(i)}>
              {ch}
            </span>
          ))
        )}
        {isLast && (
          <span
            className="av-verdict"
            data-testid="verdict"
            data-accepted={trace.accepted ? 'true' : 'false'}
          >
            {trace.accepted ? 'Accepted' : 'Rejected'}
          </span>
        )}
      </div>
      <div className="av-trace-diagram" ref={ref}>
        <Diagram
          automaton={trace.source}
          viewport={viewport}
          highlight={{
            active: step.phase === 'stuck' ? step.before : step.active,
            taken: step.taken,
          }}
        />
      </div>
    </div>
  );
}
