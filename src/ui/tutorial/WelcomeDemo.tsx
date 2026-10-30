import { useEffect, useState } from 'react';
import { RunTraceView } from '../player/RunTraceView';
import { nextDemoRun, STEP_MS, VERDICT_HOLD_MS } from './demoRun';

/**
 * The welcome's live picture: the run view playing random words on `DEMO_NFA`, one step at a
 * time, forever (while it is mounted). Decorative: hidden from assistive tech and inert.
 */
export function WelcomeDemo({
  random = Math.random,
}: {
  random?: () => number;
}): React.JSX.Element {
  const [run, setRun] = useState(() => ({ trace: nextDemoRun(random), stepIndex: 0 }));

  useEffect(() => {
    const last = run.stepIndex === run.trace.steps.length - 1;
    const timer = setTimeout(
      () =>
        setRun((r) =>
          last
            ? { trace: nextDemoRun(random, r.trace.word), stepIndex: 0 }
            : { ...r, stepIndex: r.stepIndex + 1 },
        ),
      last ? VERDICT_HOLD_MS : STEP_MS,
    );
    return () => clearTimeout(timer);
  }, [run, random]);

  return (
    <div
      className="av-welcome-demo"
      data-testid="welcome-demo"
      data-word={run.trace.word}
      data-step={run.stepIndex}
      aria-hidden="true"
    >
      <RunTraceView trace={run.trace} stepIndex={run.stepIndex} ambient />
    </div>
  );
}
