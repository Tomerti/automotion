import { canMinimize } from '../../core/minimize';
import type { AnyTrace, MinimizeTrace, SubsetTrace } from '../../core/trace';
import { appStore } from '../../store/store';
import { startMinimize } from '../../store/traceActions';
import { ownsId } from '../tutorial/engine';
import { useTutorial } from '../tutorial/tutorialStore';

/** Extra player buttons for the open trace (rendered by TracePlayer's `extraActions`). */
export function TraceExtraActions({
  trace,
  stepIndex,
}: {
  trace: AnyTrace;
  stepIndex: number;
}): React.JSX.Element | null {
  // A lesson's walkthrough offers only Save: its card asks for that, and Minimize has its own lesson.
  const inLesson = useTutorial((s) => s.active && ownsId(s.owned, trace));
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
          {!inLesson && canMinimize(trace.result) === null && (
            <SaveAndMinimizeButton trace={trace} />
          )}
        </>
      );
    case 'run':
    case 'eliminate':
      return null;
  }
}

/** Adds the result as a new automaton; that opens it and closes the trace. */
function SaveButton({ trace }: { trace: SubsetTrace | MinimizeTrace }): React.JSX.Element {
  return (
    <button
      type="button"
      className="av-primary"
      data-testid="save-trace-result"
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
      data-testid="save-and-minimize"
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
