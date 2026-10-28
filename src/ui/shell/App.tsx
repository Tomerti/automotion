import type { AnyTrace } from '../../core/trace';
import { useAppStore } from '../../store/store';
import { Canvas } from '../canvas/Canvas';
import { useAutosave } from '../../persistence/useAutosave';
import { RunPanel } from '../player/RunPanel';
import { TraceExtraActions } from '../player/traceExtraActions';
import { TracePlayer } from '../player/TracePlayer';
import { TraceView } from '../player/TraceView';
import { AutomatonList } from './AutomatonList';
import { importFile } from './importFile';
import { RightPanel } from './RightPanel';
import { toast } from './toastStore';
import { Toasts } from './Toasts';
import { Toolbar } from './Toolbar';
import '../player/player.css';
import './App.css';

/** One key per trace object, so a new trace remounts the player (resetting play and speed). */
const traceKeys = new WeakMap<AnyTrace, number>();
let nextTraceKey = 0;
function traceKey(trace: AnyTrace): number {
  let key = traceKeys.get(trace);
  if (key === undefined) {
    key = nextTraceKey++;
    traceKeys.set(trace, key);
  }
  return key;
}

/** A start arrow into an accepting state: the smallest complete automaton. */
function BrandMark(): React.JSX.Element {
  return (
    <svg className="av-brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M2 16h7" />
      <path className="av-brand-head" d="M7 12.5l3.5 3.5-3.5 3.5z" />
      <circle className="av-brand-state" cx="20" cy="16" r="9" />
      <circle cx="20" cy="16" r="5.75" />
    </svg>
  );
}

export default function App(): React.JSX.Element {
  useAutosave({ onFail: (m) => toast(m, 'error') });
  const trace = useAppStore((s) => s.trace);
  const stepIndex = useAppStore((s) => s.stepIndex);
  const setStep = useAppStore((s) => s.setStep);
  const closeTrace = useAppStore((s) => s.closeTrace);
  const step = trace?.steps[stepIndex];

  return (
    <div
      className="av-app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        for (const f of Array.from(e.dataTransfer.files)) {
          if (f.name.toLowerCase().endsWith('.json')) void importFile(f);
        }
      }}
    >
      <aside className="av-sidebar">
        <div className="av-brand">
          <h1>
            <BrandMark />
            Automaton Vis
          </h1>
          <p className="av-tagline">Build finite automata and watch them run.</p>
        </div>
        <AutomatonList />
      </aside>
      <header className="av-toolbar-area">
        <Toolbar />
      </header>
      <main className="av-canvas-area">
        {trace ? <TraceView trace={trace} stepIndex={stepIndex} /> : <Canvas />}
      </main>
      <aside className="av-right" data-testid="right-panel">
        <RightPanel />
      </aside>
      <section className="av-bottom" data-testid="bottom-panel">
        <RunPanel />
        {trace && step && (
          <TracePlayer
            key={traceKey(trace)}
            stepCount={trace.steps.length}
            index={stepIndex}
            onIndex={setStep}
            explanation={step.explanation}
            onClose={closeTrace}
            extraActions={<TraceExtraActions trace={trace} stepIndex={stepIndex} />}
          />
        )}
      </section>
      <Toasts />
    </div>
  );
}
