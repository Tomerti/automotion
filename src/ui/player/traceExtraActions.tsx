import type { AnyTrace } from '../../core/trace';
import { appStore } from '../../store/store';

/** Extra player buttons for the open trace (rendered by TracePlayer's `extraActions`). */
export function TraceExtraActions({
  trace,
  stepIndex,
}: {
  trace: AnyTrace;
  stepIndex: number;
}): React.JSX.Element | null {
  const isLast = stepIndex === trace.steps.length - 1;
  switch (trace.kind) {
    case 'subset':
    case 'minimize':
      return isLast ? (
        <button
          type="button"
          className="av-primary"
          onClick={() => appStore.getState().addAutomaton(trace.result)}
        >
          Save as new automaton
        </button>
      ) : null;
    case 'run':
      return null;
  }
}
