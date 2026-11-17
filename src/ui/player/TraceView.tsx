import type { AnyTrace } from '../../core/trace';
import { MinimizeTraceView } from './MinimizeTraceView';
import { RunTraceView } from './RunTraceView';
import { SubsetTraceView } from './SubsetTraceView';

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
  }
}
