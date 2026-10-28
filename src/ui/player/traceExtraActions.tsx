import type { AnyTrace } from '../../core/trace';
import { appStore } from '../../store/store';

/** Trace-specific buttons shown in the player. */
export function TraceExtraActions({
  trace,
  stepIndex,
}: {
  trace: AnyTrace;
  stepIndex: number;
}): React.JSX.Element | null {
  switch (trace.kind) {
    case 'minimize':
      if (stepIndex !== trace.steps.length - 1) return null;
      return (
        <button type="button" onClick={() => appStore.getState().addAutomaton(trace.result)}>
          Save as new automaton
        </button>
      );
    default:
      return null;
  }
}
