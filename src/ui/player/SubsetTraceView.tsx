import type { SubsetTrace } from '../../core/trace';
import { Diagram } from '../canvas/Diagram';
import { useFittedViewport } from './useFittedViewport';

export interface SubsetTraceViewProps {
  trace: SubsetTrace;
  stepIndex: number;
}

export function SubsetTraceView({ trace, stepIndex }: SubsetTraceViewProps): React.JSX.Element {
  const step = trace.steps[stepIndex];
  const { ref: nfaRef, viewport: nfaViewport } = useFittedViewport(trace.source.states);
  const { ref: dfaRef, viewport: dfaViewport } = useFittedViewport(trace.result.states);

  return (
    <div className="av-subset-view">
      <section className="av-subset-pane" data-testid="subset-nfa">
        <h3>NFA</h3>
        <div className="av-trace-diagram" ref={nfaRef}>
          <Diagram
            automaton={trace.source}
            viewport={nfaViewport}
            highlight={{ active: step?.focus.states }}
          />
        </div>
      </section>
      <section className="av-subset-pane" data-testid="subset-dfa">
        <h3>DFA</h3>
        <div className="av-trace-diagram" ref={dfaRef}>
          <Diagram
            automaton={trace.result}
            viewport={dfaViewport}
            highlight={{
              visibleStates: step?.revealedStates ?? [],
              visibleTransitions: step?.revealedTransitions ?? [],
              active: step?.dfaFocus.states,
              taken: step?.dfaFocus.transitions,
            }}
          />
        </div>
      </section>
    </div>
  );
}
