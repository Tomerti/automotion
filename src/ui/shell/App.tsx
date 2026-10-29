import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AnyTrace } from '../../core/trace';
import { useAppStore } from '../../store/store';
import { Canvas } from '../canvas/Canvas';
import { useAutosave } from '../../persistence/useAutosave';
import { RunPanel } from '../player/RunPanel';
import { TraceExtraActions } from '../player/traceExtraActions';
import { TracePlayer } from '../player/TracePlayer';
import { TraceView } from '../player/TraceView';
import { TutorialCard } from '../tutorial/TutorialCard';
import { startTutorial } from '../tutorial/tutorialStore';
import { WelcomeCard } from '../tutorial/WelcomeCard';
import { ControlsDialog } from './ControlsDialog';
import { useControlsHelp, useWelcome } from './help';
import { HistoryBar } from './HistoryBar';
import { useHistoryOpen } from './historyPrefs';
import { importFile } from './importFile';
import { KindPill } from './KindPill';
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

/**
 * Height of the floating dock (run pill or player), kept current as it changes. Trace views pad
 * their bottom by it (`--av-dock-h`), so nothing they fit to view ends up behind the player.
 */
function useDockHeight(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const measure = useCallback((): void => {
    if (ref.current) setHeight(ref.current.offsetHeight);
  }, []);
  // After every commit, before the paint, so a trace view opening with the player under it is
  // padded for the player from its first frame (the observer's update would land a frame late).
  useLayoutEffect(measure);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);
  return [ref, height];
}

export default function App(): React.JSX.Element {
  useAutosave({ onFail: (m) => toast(m, 'error') });
  const trace = useAppStore((s) => s.trace);
  const stepIndex = useAppStore((s) => s.stepIndex);
  const setStep = useAppStore((s) => s.setStep);
  const closeTrace = useAppStore((s) => s.closeTrace);
  const [helpOpen, setHelpOpen] = useControlsHelp();
  const [welcomeOpen, closeWelcome] = useWelcome();
  const [historyOpen, toggleHistory] = useHistoryOpen();
  const step = trace?.steps[stepIndex];
  const [dockRef, dockHeight] = useDockHeight();

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
      <TopBar
        onHelp={() => setHelpOpen(true)}
        historyOpen={historyOpen}
        onToggleHistory={toggleHistory}
      />
      <div className="av-body">
        {historyOpen && <HistoryBar />}
        <main
          className="av-canvas-area"
          data-history={historyOpen}
          style={{ '--av-dock-h': `${dockHeight}px` } as React.CSSProperties}
        >
          {trace ? <TraceView trace={trace} stepIndex={stepIndex} /> : <Canvas />}
          <KindPill />
          <TutorialCard />
          <div
            ref={dockRef}
            className="av-dock"
            data-testid="dock"
            data-mode={trace ? 'trace' : 'run'}
          >
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
      </div>
      <Toasts />
      {helpOpen && (
        <ControlsDialog
          onClose={() => setHelpOpen(false)}
          onStartTutorial={() => {
            setHelpOpen(false);
            startTutorial();
          }}
        />
      )}
      {welcomeOpen && (
        <WelcomeCard
          onClose={closeWelcome}
          onStart={() => {
            closeWelcome();
            startTutorial();
          }}
        />
      )}
    </div>
  );
}
