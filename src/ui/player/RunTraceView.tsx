import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { State, StateId } from '../../core/model';
import type { RunStep, RunTrace } from '../../core/trace';
import { Diagram } from '../canvas/Diagram';
import { STATE_RADIUS } from '../canvas/geometry';
import { LabelText } from '../LabelText';
import { moveDurationMs, prefersReducedMotion, usePlaybackSpeed } from './playback';
import { playRunSound, playVerdictSound } from './sound';
import {
  cellState,
  readHead,
  restingStates,
  stepMotion,
  verdictReason,
  type StepMotion,
} from './runView';
import { useFittedViewport } from './useFittedViewport';

export interface RunTraceViewProps {
  trace: RunTrace;
  stepIndex: number;
  /**
   * A run played on its own as decoration (the welcome's demo): silent, at 1× whatever the
   * player's speed, and without the verdict banner (the tokens' tint shows the verdict).
   */
  ambient?: boolean;
}

/** The step being animated, and which of its waves is moving. */
interface Animation {
  stepIndex: number;
  wave: number;
  done: boolean;
}

/** Token motion needs real SVG geometry and frames; jsdom has neither, so it jumps. */
function canAnimate(): boolean {
  return (
    typeof requestAnimationFrame === 'function' &&
    typeof SVGGeometryElement !== 'undefined' &&
    typeof SVGGeometryElement.prototype.getTotalLength === 'function' &&
    !prefersReducedMotion()
  );
}

const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** The rendered path of transition `id` in `svg`, so tokens follow custom bends and loops. */
function edgePath(svg: SVGSVGElement | null | undefined, id: string): SVGGeometryElement | null {
  if (!svg) return null;
  for (const g of svg.querySelectorAll('[data-transition-id]')) {
    if (g.getAttribute('data-transition-id') !== id) continue;
    const path = g.querySelector('.av-edge-path');
    return path instanceof SVGGeometryElement ? path : null;
  }
  return null;
}

function TapeView({ trace, step }: { trace: RunTrace; step: RunStep }): React.JSX.Element {
  const chars = [...trace.word];
  const head = readHead(step, chars.length);
  const scroller = useRef<HTMLDivElement>(null);

  const headCell = head?.cell ?? -1;

  // Keep the read head in view on long words (centring its cell once it would leave the view).
  useEffect(() => {
    const box = scroller.current;
    const cell = box?.querySelectorAll('.av-word-char')[headCell];
    if (!box || !cell) return;
    const b = box.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    if (c.left < b.left || c.right > b.right) {
      box.scrollLeft += c.left - b.left - b.width / 2 + c.width / 2;
    }
  }, [headCell]);

  return (
    <div className="av-tape" ref={scroller}>
      <div className="av-word" role="group" aria-label="Input tape">
        {chars.length === 0 ? (
          <span className="av-word-empty" title="The empty word">
            ε
          </span>
        ) : (
          chars.map((ch, i) => (
            <span
              key={i}
              className="av-word-char"
              data-testid="word-char"
              data-state={cellState(step, i)}
              data-stuck={
                step.phase === 'stuck' && cellState(step, i) === 'current' ? 'true' : undefined
              }
            >
              {ch}
            </span>
          ))
        )}
        {head && (
          <span
            className="av-tape-head"
            data-testid="read-head"
            data-waiting={head.waiting ? 'true' : undefined}
            aria-hidden="true"
            style={{ '--av-head': head.cell } as React.CSSProperties}
          />
        )}
      </div>
    </div>
  );
}

function DeadMark({ state, fading }: { state: State; fading: boolean }): React.JSX.Element {
  const off = STATE_RADIUS * 0.72;
  return (
    <g
      className="av-run-dead"
      data-testid="dead-branch"
      data-state-id={state.id}
      data-fading={fading ? 'true' : undefined}
      transform={`translate(${state.x + off} ${state.y - off})`}
    >
      {/* Its own group, so the fade's CSS transform doesn't replace the placement. */}
      <g className="av-run-dead-mark">
        <circle r={8.5} />
        <path d="M -3.4 -3.4 L 3.4 3.4 M 3.4 -3.4 L -3.4 3.4" />
      </g>
    </g>
  );
}

/** Overlay inside the diagram's world: resting tokens, moving tokens and dead-branch marks. */
function RunOverlay(props: {
  trace: RunTrace;
  step: RunStep;
  /** States the tokens sit on right now. */
  lit: StateId[];
  motion: StepMotion | null;
  animation: Animation | null;
  onWave: (wave: number) => void;
  onDone: () => void;
  durationMs: number;
}): React.JSX.Element {
  const { trace, step, lit, motion, animation, onWave, onDone, durationMs } = props;
  const root = useRef<SVGGElement>(null);
  const tokens = useRef(new Map<number, SVGGElement>());
  const moving = animation !== null && !animation.done && motion !== null;
  const runningStep = moving ? animation.stepIndex : null;

  // Drive the tokens frame by frame; positioned before the first paint, so nothing flashes.
  useLayoutEffect(() => {
    if (runningStep === null || motion === null) return;
    const svg = root.current?.ownerSVGElement;
    const paths = motion.moves.map((m) => edgePath(svg, m.transitionId));
    const lengths = paths.map((p) => {
      try {
        return p ? p.getTotalLength() : 0;
      } catch {
        return 0;
      }
    });
    const slot = durationMs / motion.waves;
    const start = performance.now();
    let wave = 0;
    let frame = 0;
    const draw = (now: number): void => {
      const elapsed = now - start;
      if (elapsed >= durationMs) {
        onDone();
        return;
      }
      const w = Math.min(motion.waves - 1, Math.floor(elapsed / slot));
      if (w !== wave) {
        wave = w;
        onWave(w);
      }
      motion.moves.forEach((m, i) => {
        const el = tokens.current.get(i);
        const path = paths[i];
        if (!el) return;
        const t = (elapsed - m.wave * slot) / slot;
        if (!path || t < 0 || t > 1) {
          el.style.opacity = '0';
          return;
        }
        const p = path.getPointAtLength((lengths[i] ?? 0) * easeInOut(t));
        el.setAttribute('transform', `translate(${p.x} ${p.y})`);
        el.style.opacity = '1';
      });
      frame = requestAnimationFrame(draw);
    };
    draw(start);
    return () => cancelAnimationFrame(frame);
    // The callbacks change identity every render; the animation restarts only for a new step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningStep, motion, durationMs]);

  const byId = new Map(trace.source.states.map((s) => [s.id, s]));
  // The verdict (stuck or final) tints the tokens: green on accepting states, red on rejection.
  const verdict = step.verdict;
  const dead = moving ? motion.dead : step.phase === 'stuck' ? step.before : [];
  // Once tokens land, the halos they bring in grow in; states lit all along stay still.
  const stayed = animation?.done && motion ? new Set(motion.litBefore[motion.waves - 1]) : null;

  return (
    <g
      className="av-run-overlay"
      ref={root}
      style={{ '--av-move-ms': `${durationMs}ms` } as React.CSSProperties}
    >
      {lit.map((id) => {
        const s = byId.get(id);
        if (!s) return null;
        const accepting = trace.source.accepting.includes(id);
        const tone =
          verdict === 'accept' ? (accepting ? 'accept' : undefined) : verdict && 'reject';
        return (
          <circle
            key={id}
            className="av-run-halo"
            data-testid="run-token"
            data-state-id={id}
            data-tone={tone}
            data-arrived={stayed && !stayed.has(id) ? 'true' : undefined}
            cx={s.x}
            cy={s.y}
            r={STATE_RADIUS + 4}
          />
        );
      })}
      {dead.map((id) => {
        const s = byId.get(id);
        return s ? <DeadMark key={id} state={s} fading={moving} /> : null;
      })}
      {moving &&
        motion.moves.map((m, i) => (
          <g
            key={`${animation.stepIndex}-${i}`}
            className="av-run-token"
            data-testid="moving-token"
            data-transition-id={m.transitionId}
            style={{ opacity: 0 }}
            ref={(el) => {
              if (el) tokens.current.set(i, el);
              else tokens.current.delete(i);
            }}
          >
            <circle className="av-run-token-glow" r={10} />
            <circle className="av-run-token-core" r={6} />
          </g>
        ))}
    </g>
  );
}

function VerdictBanner({ trace }: { trace: RunTrace }): React.JSX.Element {
  // Once per mount and trace: StrictMode runs a mount effect twice in development (keeping refs),
  // which played the cue twice. A replay remounts the banner, so it still plays again.
  const played = useRef<RunTrace | null>(null);
  useEffect(() => {
    if (played.current === trace) return;
    played.current = trace;
    playVerdictSound(trace.accepted);
  }, [trace]);
  return (
    <div
      className="av-verdict"
      data-testid="verdict"
      data-accepted={trace.accepted ? 'true' : 'false'}
      role="status"
    >
      <svg className="av-verdict-mark" viewBox="0 0 24 24" aria-hidden="true">
        <path d={trace.accepted ? 'M5 12.5l4.5 4.5L19 7.5' : 'M6.5 6.5l11 11M17.5 6.5l-11 11'} />
      </svg>
      <span className="av-verdict-text">
        <strong className="av-verdict-title">{trace.accepted ? 'Accepted' : 'Rejected'}</strong>
        <LabelText className="av-verdict-reason" text={verdictReason(trace)} />
      </span>
    </div>
  );
}

export function RunTraceView({
  trace,
  stepIndex,
  ambient = false,
}: RunTraceViewProps): React.JSX.Element {
  const step = trace.steps[stepIndex];
  const { ref, viewport } = useFittedViewport(trace.source.states);
  const playerSpeed = usePlaybackSpeed();
  const speed = ambient ? 1 : playerSpeed;
  const motion = useMemo(
    () => (step ? stepMotion(trace.source, step) : null),
    [trace.source, step],
  );

  // A single step forward animates; anything else (back, scrub, jump, a new trace) just jumps.
  const [seen, setSeen] = useState({ trace, stepIndex });
  const [animation, setAnimation] = useState<Animation | null>(null);
  if (seen.trace !== trace || seen.stepIndex !== stepIndex) {
    const forward = seen.trace === trace && stepIndex === seen.stepIndex + 1;
    setSeen({ trace, stepIndex });
    setAnimation(
      forward && motion !== null && canAnimate() ? { stepIndex, wave: 0, done: false } : null,
    );
  }

  // Back at the first step (a replay, First, the scrubber) the Run chime plays again, as the
  // verdict does at the last; the Run button plays it when the run opens.
  const shown = useRef({ trace, stepIndex });
  useEffect(() => {
    const prev = shown.current;
    shown.current = { trace, stepIndex };
    if (ambient) return;
    if (stepIndex === 0 && prev.trace === trace && prev.stepIndex !== 0) playRunSound();
  }, [trace, stepIndex, ambient]);

  if (!step) return <div className="av-trace-view" />;

  const moving = animation !== null && !animation.done && motion !== null;
  const lit = moving ? (motion.litBefore[animation.wave] ?? []) : restingStates(step);
  const isLast = stepIndex === trace.steps.length - 1;

  return (
    <div className="av-trace-view av-run-view" data-moving={moving ? 'true' : undefined}>
      <TapeView trace={trace} step={step} />
      <div className="av-trace-diagram" ref={ref}>
        <Diagram
          automaton={trace.source}
          viewport={viewport}
          highlight={{ active: lit, taken: step.taken }}
        >
          <RunOverlay
            trace={trace}
            step={step}
            lit={lit}
            motion={motion}
            animation={animation}
            durationMs={moveDurationMs(speed)}
            onWave={(wave) =>
              setAnimation((a) => (a && a.stepIndex === stepIndex ? { ...a, wave } : a))
            }
            onDone={() =>
              setAnimation((a) => (a && a.stepIndex === stepIndex ? { ...a, done: true } : a))
            }
          />
        </Diagram>
        {isLast && !ambient && <VerdictBanner trace={trace} />}
      </div>
    </div>
  );
}
