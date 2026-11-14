import { useMemo } from 'react';
import type { Sym } from '../../core/model';
import type { SubsetTrace } from '../../core/trace';
import { Diagram } from '../canvas/Diagram';
import { FitButton } from './FitButton';
import { chooseSplitLayout } from './splitLayout';
import { useElementSize, useFittedViewport } from './useFittedViewport';

export interface SubsetTraceViewProps {
  trace: SubsetTrace;
  stepIndex: number;
}

/** Symbols on each DFA edge built by steps 0..stepIndex (by the done step, all of them). */
function symbolsBuiltSoFar(trace: SubsetTrace, stepIndex: number): Record<string, Sym[]> {
  const out: Record<string, Sym[]> = {};
  for (const step of trace.steps.slice(0, stepIndex + 1)) {
    const edge = step.dfaFocus.transitions?.[0];
    if (step.phase !== 'expand' || step.symbol === undefined || edge === undefined) continue;
    (out[edge] ??= []).push(step.symbol);
  }
  return out;
}

export function SubsetTraceView({ trace, stepIndex }: SubsetTraceViewProps): React.JSX.Element {
  const step = trace.steps[stepIndex];
  const nfa = useFittedViewport(trace.source.states);
  const dfa = useFittedViewport(trace.result.states);
  const { ref: nfaRef, viewport: nfaViewport, onPointerDown: nfaDown } = nfa;
  const { ref: dfaRef, viewport: dfaViewport, onPointerDown: dfaDown } = dfa;
  const { moved: nfaMoved, fit: nfaFit } = nfa;
  const { moved: dfaMoved, fit: dfaFit } = dfa;
  const { ref, size } = useElementSize();
  const layout = chooseSplitLayout(trace.source.states, trace.result.states, size);
  const edgeSymbols = useMemo(() => symbolsBuiltSoFar(trace, stepIndex), [trace, stepIndex]);

  return (
    <div className="av-subset-view" data-testid="subset-view" data-layout={layout} ref={ref}>
      <section className="av-subset-pane" data-testid="subset-nfa">
        <h3>NFA</h3>
        <div
          className="av-trace-diagram"
          data-interactive="true"
          ref={nfaRef}
          onPointerDown={nfaDown}
        >
          <Diagram
            automaton={trace.source}
            viewport={nfaViewport}
            highlight={{ active: step?.focus.states, taken: step?.focus.transitions }}
          />
          {nfaMoved && <FitButton onClick={nfaFit} />}
        </div>
      </section>
      <section className="av-subset-pane" data-testid="subset-dfa">
        <h3>DFA</h3>
        <div
          className="av-trace-diagram"
          data-interactive="true"
          ref={dfaRef}
          onPointerDown={dfaDown}
        >
          <Diagram
            automaton={trace.result}
            viewport={dfaViewport}
            highlight={{
              visibleStates: step?.revealedStates ?? [],
              visibleTransitions: step?.revealedTransitions ?? [],
              edgeSymbols,
              active: step?.dfaFocus.states,
              taken: step?.dfaFocus.transitions,
            }}
          />
          {dfaMoved && <FitButton onClick={dfaFit} />}
        </div>
      </section>
    </div>
  );
}
