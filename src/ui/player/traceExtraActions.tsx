import { canMinimize } from '../../core/minimize';
import type { AnyTrace, MinimizeTrace, SubsetTrace } from '../../core/trace';
import { appStore } from '../../store/store';
import { startMinimize } from '../../store/traceActions';

/** Extra player buttons for the open trace (rendered by TracePlayer's `extraActions`). */
export function TraceExtraActions({
  trace,
  stepIndex,
}: {
  trace: AnyTrace;
  stepIndex: number;
}): React.JSX.Element | null {
  const isLast = stepIndex === trace.steps.length - 1;
  if (!isLast) return null;
  switch (trace.kind) {
    case 'minimize':
      // Saving would only add a copy of the same automaton (and "X (min) (min)" after that).
      if (trace.alreadyMinimal) {
        return (
          <span className="av-player-note" data-testid="already-minimal">
            Already minimal
          </span>
        );
      }
      return <SaveButton trace={trace} />;
    case 'subset':
      return (
        <>
          <SaveButton trace={trace} />
          {canMinimize(trace.result) === null && <SaveAndMinimizeButton trace={trace} />}
        </>
      );
    case 'run':
      return null;
  }
}

/** Adds the result as a new automaton; that opens it and closes the trace. */
function SaveButton({ trace }: { trace: SubsetTrace | MinimizeTrace }): React.JSX.Element {
  return (
    <button
      type="button"
      className="av-primary"
      onClick={() => appStore.getState().addAutomaton(trace.result)}
    >
      Save as new automaton
    </button>
  );
}

/**
 * The next step after a conversion: save the DFA and open its minimization at once (the result
 * of the subset construction is often not minimal).
 */
function SaveAndMinimizeButton({ trace }: { trace: SubsetTrace }): React.JSX.Element {
  return (
    <button
      type="button"
      title="Save the DFA as a new automaton, then minimize it step by step"
      onClick={() => {
        appStore.getState().addAutomaton(trace.result);
        startMinimize();
      }}
    >
      Save and minimize
    </button>
  );
}
