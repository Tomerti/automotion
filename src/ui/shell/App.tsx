import { useAppStore } from '../../store/store';
import { Canvas } from '../canvas/Canvas';
import { useAutosave } from '../../persistence/useAutosave';
import { RunPanel } from '../player/RunPanel';
import { TracePlayer } from '../player/TracePlayer';
import { TraceView } from '../player/TraceView';
import { AutomatonList } from './AutomatonList';
import { importFile } from './importFile';
import { RightPanel } from './RightPanel';
import { Toasts } from './Toasts';
import { Toolbar } from './Toolbar';
import '../player/player.css';
import './App.css';

export default function App(): React.JSX.Element {
  useAutosave();
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
      <Toasts />
    </div>
  );
}
