import { useMemo, useRef } from 'react';
import type { Automaton } from '../../core/model';
import type { EliminateTrace } from '../../core/trace';
import { pickEliminate } from '../../store/traceActions';
import { Diagram } from '../canvas/Diagram';
import { DRAG_THRESHOLD } from '../canvas/viewport';
import { CopyIcon } from '../shell/icons';
import { toast } from '../shell/toastStore';
import { FitButton } from './FitButton';
import { usePlaying } from './playingStore';
import { useFittedViewport } from './useFittedViewport';

/** Arrow labels longer than this many characters (code points) are drawn cut short. */
const MAX_LABEL_CHARS = 40;

/** `text`, or its first 39 characters and `…` when it is longer than 40. */
// Kept beside the view that draws the cut labels; only fast refresh of this file is affected.
// eslint-disable-next-line react-refresh/only-export-components
export function shortLabel(text: string): string {
  const chars = Array.from(text);
  return chars.length > MAX_LABEL_CHARS ? `${chars.slice(0, MAX_LABEL_CHARS - 1).join('')}…` : text;
}

/** The GNFA as drawn: long labels cut short, their full text kept for the tooltips. */
function displayed(a: Automaton): { automaton: Automaton; titles: Record<string, string> } {
  const titles: Record<string, string> = {};
  const transitions = a.transitions.map((t) => {
    const symbols = t.symbols.map(shortLabel);
    if (symbols.every((s, i) => s === t.symbols[i])) return t;
    titles[t.id] = t.symbols.join(',');
    return { ...t, symbols };
  });
  return { automaton: { ...a, transitions }, titles };
}

function copyRegex(regex: string): void {
  if (typeof navigator.clipboard?.writeText !== 'function') {
    toast('Could not copy the regex', 'error');
    return;
  }
  navigator.clipboard.writeText(regex).then(
    () => toast('Regex copied'),
    () => toast('Could not copy the regex', 'error'),
  );
}

export interface EliminateTraceViewProps {
  trace: EliminateTrace;
  stepIndex: number;
}

/**
 * The To regex walkthrough: the GNFA at each step, with the state being removed and its arrows
 * (or the arrows that changed) highlighted. While paused before the end, clicking a state makes
 * it the next one removed. The done step shows the regex under the diagram, with Copy.
 */
export function EliminateTraceView({
  trace,
  stepIndex,
}: EliminateTraceViewProps): React.JSX.Element {
  const step = trace.steps[stepIndex];
  // Fitted to the first step, which has every state: the view doesn't jump as states go.
  const { ref, viewport, moved, fit, onPointerDown } = useFittedViewport(
    trace.steps[0]?.automaton.states ?? [],
  );
  const shown = useMemo(() => (step ? displayed(step.automaton) : null), [step]);
  const playing = usePlaying((s) => s.playing);
  const down = useRef<{ x: number; y: number } | null>(null);

  if (!step || !shown) return <div className="av-trace-view" />;

  const picking = !playing && step.phase !== 'done' && stepIndex < trace.steps.length - 1;

  const onClick = (e: React.MouseEvent): void => {
    const start = down.current;
    down.current = null;
    // A drag pans the view: only a click that stayed put picks.
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) >= DRAG_THRESHOLD) return;
    if (usePlaying.getState().playing) return;
    const target = e.target instanceof Element ? e.target.closest('.av-state') : null;
    const id = target?.getAttribute('data-state-id');
    if (id) pickEliminate(id, (m) => toast(m, 'error'));
  };

  return (
    <div className="av-trace-view" data-testid="eliminate-view">
      <div
        className="av-trace-diagram"
        data-interactive="true"
        data-picking={picking}
        ref={ref}
        onPointerDown={(e) => {
          down.current = { x: e.clientX, y: e.clientY };
          onPointerDown(e);
        }}
        onClick={onClick}
      >
        <Diagram
          automaton={shown.automaton}
          viewport={viewport}
          highlight={{
            active: step.focus.states,
            taken: step.phase === 'remove' ? step.changed : step.focus.transitions,
            edgeTitles: shown.titles,
          }}
        />
        {moved && <FitButton onClick={fit} />}
      </div>
      {step.phase === 'done' && (
        <div className="av-regex-result-panel">
          <div className="av-regex-result" data-testid="regex-result">
            {trace.regex}
          </div>
          <button type="button" data-testid="regex-copy" onClick={() => copyRegex(trace.regex)}>
            <CopyIcon />
            Copy
          </button>
        </div>
      )}
    </div>
  );
}
