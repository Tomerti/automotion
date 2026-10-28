import type { AnyTrace } from '../../core/trace';
import { useAppStore } from '../../store/store';
import { Canvas } from '../canvas/Canvas';
import { useAutosave } from '../../persistence/useAutosave';
import { RunPanel } from '../player/RunPanel';
import { TraceExtraActions } from '../player/traceExtraActions';
import { TracePlayer } from '../player/TracePlayer';
import { TraceView } from '../player/TraceView';
import { ControlsDialog } from './ControlsDialog';
import { useControlsHelp } from './help';
import { importFile } from './importFile';
import { toast } from './toastStore';
import { Toasts } from './Toasts';
import { TopBar } from './TopBar';
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

export default function App(): React.JSX.Element {
  useAutosave({ onFail: (m) => toast(m, 'error') });
  const trace = useAppStore((s) => s.trace);
  const stepIndex = useAppStore((s) => s.stepIndex);
  const setStep = useAppStore((s) => s.setStep);
  const closeTrace = useAppStore((s) => s.closeTrace);
  const [helpOpen, setHelpOpen] = useControlsHelp();
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
      <TopBar onHelp={() => setHelpOpen(true)} />
      <main className="av-canvas-area">
        {trace ? <TraceView trace={trace} stepIndex={stepIndex} /> : <Canvas />}
        <div className="av-dock" data-testid="dock" data-mode={trace ? 'trace' : 'run'}>
          <RunPanel hidden={trace !== null} />
          {trace && step && (
            <TracePlayer
              key={traceKey(trace)}
              stepCount={trace.steps.length}
              index={stepIndex}
              onIndex={setStep}
              explanation={step.explanation}
              onClose={closeTrace}
              autoPlay={trace.kind === 'run' || trace.kind === 'subset'}
              extraActions={<TraceExtraActions trace={trace} stepIndex={stepIndex} />}
            />
          )}
        </div>
      </main>
      <Toasts />
      {helpOpen && <ControlsDialog onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
