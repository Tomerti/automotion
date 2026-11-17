import type { AnyTrace } from '../../core/trace';
import { EliminateTraceView } from './EliminateTraceView';
import { MinimizeTraceView } from './MinimizeTraceView';
import { RunTraceView } from './RunTraceView';
import { SubsetTraceView } from './SubsetTraceView';
import { ThompsonTraceView } from './ThompsonTraceView';

/** Canvas-area view for an open trace. */
export function TraceView({
  trace,
  stepIndex,
}: {
  trace: AnyTrace;
  stepIndex: number;
}): React.JSX.Element | null {
  switch (trace.kind) {
    case 'run':
      return <RunTraceView trace={trace} stepIndex={stepIndex} />;
    case 'subset':
      return <SubsetTraceView trace={trace} stepIndex={stepIndex} />;
    case 'minimize':
      return <MinimizeTraceView trace={trace} stepIndex={stepIndex} />;
    case 'thompson':
      return <ThompsonTraceView trace={trace} stepIndex={stepIndex} />;
    case 'eliminate':
      return <EliminateTraceView trace={trace} stepIndex={stepIndex} />;
  }
}
