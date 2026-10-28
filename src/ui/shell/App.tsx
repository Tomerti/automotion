import { useAppStore } from '../../store/store';
import { Canvas } from '../canvas/Canvas';
import { RunPanel } from '../player/RunPanel';
import { TracePlayer } from '../player/TracePlayer';
import { TraceView } from '../player/TraceView';
import { AutomatonList } from './AutomatonList';
import { RightPanel } from './RightPanel';
import { Toolbar } from './Toolbar';
import '../player/player.css';
import './App.css';

export default function App(): React.JSX.Element {
  const trace = useAppStore((s) => s.trace);
  const stepIndex = useAppStore((s) => s.stepIndex);
  const setStep = useAppStore((s) => s.setStep);
  const closeTrace = useAppStore((s) => s.closeTrace);
  const step = trace?.steps[stepIndex];

  return (
    <div className="av-app">
      <aside className="av-sidebar">
        <h1>Automaton Vis</h1>
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
            stepCount={trace.steps.length}
            index={stepIndex}
            onIndex={setStep}
            explanation={step.explanation}
            onClose={closeTrace}
          />
        )}
      </section>
    </div>
  );
}
