import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './player.css';

export interface TracePlayerProps {
  stepCount: number;
  index: number;
  onIndex: (i: number) => void;
  explanation: string;
  onClose: () => void;
  extraActions?: ReactNode;
}

const BASE_INTERVAL_MS = 800;
const SPEEDS = [
  { value: 0.5, label: '0.5×' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
];

const isTypingTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);

/** Targets whose native Space handling (activation, editing) must not become a global toggle. */
const isActivatable = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.isContentEditable);

export function TracePlayer(props: TracePlayerProps): React.JSX.Element {
  const { stepCount, index, onIndex, explanation, onClose, extraActions } = props;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const last = stepCount - 1;

  // Latest values for the interval and key handlers, which must not re-subscribe on every step.
  const latest = useRef({ index, last, onIndex, onClose, playing });
  useEffect(() => {
    latest.current = { index, last, onIndex, onClose, playing };
  });

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const cur = latest.current;
      const next = Math.min(cur.index + 1, cur.last);
      cur.onIndex(next);
      if (next >= cur.last) setPlaying(false);
    }, BASE_INTERVAL_MS / speed);
    return () => clearInterval(id);
  }, [playing, speed]);

  const togglePlay = (): void => {
    const cur = latest.current;
    if (cur.playing) {
      setPlaying(false);
      return;
    }
    if (cur.index >= cur.last) cur.onIndex(0);
    setPlaying(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isTypingTarget(e.target)) return;
      const cur = latest.current;
      if (e.key === 'ArrowRight') cur.onIndex(cur.index + 1);
      else if (e.key === 'ArrowLeft') cur.onIndex(cur.index - 1);
      else if (e.key === 'Escape') cur.onClose();
      else if (e.key === ' ' && !isActivatable(e.target)) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="av-player" data-testid="trace-player">
      <div className="av-player-controls">
        <button type="button" onClick={() => onIndex(index - 1)} disabled={index <= 0}>
          Previous
        </button>
        <button type="button" className="av-play" onClick={togglePlay}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={() => onIndex(index + 1)} disabled={index >= last}>
          Next
        </button>
        <input
          type="range"
          aria-label="Step"
          min={0}
          max={last}
          value={index}
          onChange={(e) => onIndex(Number(e.target.value))}
        />
        <span data-testid="step-counter">{`Step ${index + 1} / ${stepCount}`}</span>
        <select aria-label="Speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          {SPEEDS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {extraActions}
        <button type="button" className="av-player-close" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="av-player-explanation" aria-live="polite">
        {explanation}
      </p>
    </div>
  );
}
