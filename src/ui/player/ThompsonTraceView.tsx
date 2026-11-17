import { useMemo } from 'react';
import { STATE_RADIUS } from '../../core/geometry';
import type { Automaton } from '../../core/model';
import type { ThompsonStep, ThompsonTrace } from '../../core/trace';
import { Diagram } from '../canvas/Diagram';
import { FitButton } from './FitButton';
import { useFittedViewport } from './useFittedViewport';

const FRAME_PADDING = 12;

export interface ThompsonTraceViewProps {
  trace: ThompsonTrace;
  stepIndex: number;
}

type Tone = 'plain' | 'built' | 'current';

/** The regex cut into runs of equal tone: the step's own span, spans built earlier, the rest. */
function regexSegments(regex: string, step: ThompsonStep): { text: string; tone: Tone }[] {
  const tones: Tone[] = Array.from({ length: regex.length }, () => 'plain');
  for (const s of step.builtSpans) tones.fill('built', s.start, s.end);
  if (step.span) tones.fill('current', step.span.start, step.span.end);
  const out: { text: string; tone: Tone }[] = [];
  for (let i = 0; i < regex.length; i++) {
    const tone = tones[i] ?? 'plain';
    const last = out[out.length - 1];
    if (last && last.tone === tone) last.text += regex[i];
    else out.push({ text: regex[i] ?? '', tone });
  }
  return out;
}

export function ThompsonTraceView({ trace, stepIndex }: ThompsonTraceViewProps): React.JSX.Element {
  const step = trace.steps[stepIndex];
  const { ref, viewport, moved, fit, onPointerDown } = useFittedViewport(trace.result.states);
  const segments = useMemo(
    () => (step ? regexSegments(trace.regex, step) : []),
    [trace.regex, step],
  );

  // One start and one accepting state per step: those of the piece being built.
  const shown: Automaton = {
    ...trace.result,
    starts: step?.pieceStart ? [step.pieceStart] : [],
    accepting: step?.pieceAccept ? [step.pieceAccept] : [],
  };

  const pieceStates = step?.phase === 'build' ? step.pieceStates : [];
  const piece = trace.result.states.filter((s) => pieceStates.includes(s.id));
  let frame: { x: number; y: number; width: number; height: number } | null = null;
  if (piece.length > 0) {
    const pad = (STATE_RADIUS + FRAME_PADDING) * viewport.zoom;
    const xs = piece.map((s) => s.x * viewport.zoom + viewport.x);
    const ys = piece.map((s) => s.y * viewport.zoom + viewport.y);
    frame = {
      x: Math.min(...xs) - pad,
      y: Math.min(...ys) - pad,
      width: Math.max(...xs) - Math.min(...xs) + 2 * pad,
      height: Math.max(...ys) - Math.min(...ys) + 2 * pad,
    };
  }

  return (
    <div className="av-trace-view" data-testid="thompson-view">
      <p className="av-regex-strip" data-testid="regex-strip">
        {segments.map((seg, i) =>
          seg.tone === 'current' ? (
            <mark key={i} data-testid="regex-current">
              {seg.text}
            </mark>
          ) : (
            <span key={i} className={seg.tone === 'built' ? 'av-regex-built' : undefined}>
              {seg.text}
            </span>
          ),
        )}
      </p>
      <div
        className="av-trace-diagram"
        data-interactive="true"
        ref={ref}
        onPointerDown={onPointerDown}
      >
        <Diagram
          automaton={shown}
          viewport={viewport}
          highlight={{
            visibleStates: step?.revealedStates ?? [],
            visibleTransitions: step?.revealedTransitions ?? [],
            active: step?.newStates,
            taken: step?.newTransitions,
          }}
        />
        {frame && (
          // Over the diagram, not in it: the frame is never part of an export.
          <svg className="av-piece-frame-layer" aria-hidden="true">
            <rect
              data-testid="piece-frame"
              x={frame.x}
              y={frame.y}
              width={frame.width}
              height={frame.height}
              rx={16}
            />
          </svg>
        )}
        {moved && <FitButton onClick={fit} />}
      </div>
    </div>
  );
}
