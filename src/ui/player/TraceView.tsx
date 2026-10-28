import type { AnyTrace } from '../../core/trace';
import { RunTraceView } from './RunTraceView';

/** Canvas-area view for an open trace. Subset and minimize views arrive with their tasks. */
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
    case 'minimize':
      return null;
  }
}
