import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { LabelText } from '../LabelText';
import { setPlaybackSpeed, SPEEDS, stepIntervalMs } from './playback';
import './player.css';

export interface TracePlayerProps {
  stepCount: number;
  index: number;
  onIndex: (i: number) => void;
  explanation: string;
  onClose: () => void;
  extraActions?: ReactNode;
  /** Start playing as soon as the player opens (a run or a conversion plays right away). */
  autoPlay?: boolean;
  /**
   * A step where playback pauses on its way to the end (a lesson's teaching moment): Play from
   * there goes on. Stepping and jumps ignore it.
   */
  stopAt?: number | null;
}

const isTypingTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);

/** Targets whose native Space handling (activation, editing) must not become a global toggle. */
const isActivatable = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.isContentEditable);

/** 16×16 stroke icons for the transport buttons. */
const ICONS = {
  first: 'M4 3.5v9 M12.5 3.5 6.5 8l6 4.5Z',
  previous: 'M11 3.5 4.5 8l6.5 4.5Z',
  next: 'M5 3.5 11.5 8 5 12.5Z',
  last: 'M12 3.5v9 M3.5 3.5 9.5 8l-6 4.5Z',
  play: 'M5 3 13 8 5 13Z',
  pause: 'M5 3.5v9 M11 3.5v9',
  close: 'M4 4l8 8 M12 4l-8 8',
} as const;

function Icon({ name }: { name: keyof typeof ICONS }): React.JSX.Element {
  return (
    <svg className="av-player-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function IconButton(props: {
  label: string;
  icon: keyof typeof ICONS;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  shortcut?: string;
}): React.JSX.Element {
  const { label, icon, onClick, disabled, className, shortcut } = props;
  return (
    <button
      type="button"
      className={`av-player-btn${className ? ` ${className}` : ''}`}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} />
    </button>
  );
}

/** The floating step player shared by every trace kind. */
export function TracePlayer(props: TracePlayerProps): React.JSX.Element {
  const {
    stepCount,
    index,
    onIndex,
    explanation,
    onClose,
    extraActions,
    autoPlay = false,
    stopAt = null,
  } = props;
  const [playing, setPlaying] = useState(autoPlay && stepCount > 1);
  // Local, so a new trace (which remounts the player) starts at 1×; mirrored for the views.
  const [speed, setSpeed] = useState(1);
  const last = stepCount - 1;

  useEffect(() => setPlaybackSpeed(speed), [speed]);

  // Latest values for the interval and key handlers, which must not re-subscribe on every step.
  const latest = useRef({ index, last, onIndex, onClose, playing, stopAt });
  useEffect(() => {
    latest.current = { index, last, onIndex, onClose, playing, stopAt };
  });

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      // Held before stepping: reaching `stopAt` may move a lesson on to a step without one
      // before the next render, and playback must still pause here.
      const cur = latest.current;
      const next = Math.min(cur.index + 1, cur.last);
      cur.onIndex(next);
      if (next >= cur.last || next === cur.stopAt) setPlaying(false);
    }, stepIntervalMs(speed));
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

  /** Jumps (anything but a single step forward) stop playback. */
  const jump = (i: number): void => {
    setPlaying(false);
    latest.current.onIndex(i);
  };

  // Opened from a button (Convert to DFA, Minimize): the focus stays on it, so Space would press
  // it again instead of playing, and → would show its keyboard focus ring. Take the focus off it;
  // a text field (the word box) keeps it.
  const playerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && isActivatable(focused)) {
      if (!playerRef.current?.contains(focused)) focused.blur();
    }
  }, []);

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
    <div
      ref={playerRef}
      className="av-player"
      data-testid="trace-player"
      role="group"
      aria-label="Step player"
    >
      <p className="av-player-explanation" aria-live="polite">
        <LabelText text={explanation} />
      </p>
      <div className="av-player-bar">
        <div className="av-player-transport">
          <IconButton label="First" icon="first" onClick={() => jump(0)} disabled={index <= 0} />
          <IconButton
            label="Previous"
            icon="previous"
            shortcut="←"
            onClick={() => jump(index - 1)}
            disabled={index <= 0}
          />
          <IconButton
            label={playing ? 'Pause' : 'Play'}
            icon={playing ? 'pause' : 'play'}
            shortcut="Space"
            className="av-player-play"
            onClick={togglePlay}
          />
          <IconButton
            label="Next"
            icon="next"
            shortcut="→"
            onClick={() => onIndex(index + 1)}
            disabled={index >= last}
          />
          <IconButton
            label="Last"
            icon="last"
            onClick={() => jump(last)}
            disabled={index >= last}
          />
        </div>
        <input
          className="av-player-scrubber"
          type="range"
          aria-label="Step"
          min={0}
          max={last}
          value={index}
          style={{ '--av-progress': last > 0 ? index / last : 1 } as React.CSSProperties}
          onChange={(e) => jump(Number(e.target.value))}
        />
        <span className="av-player-counter" data-testid="step-counter">
          {`Step ${index + 1} / ${stepCount}`}
        </span>
        <select
          className="av-player-speed"
          aria-label="Speed"
          title="Speed"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          {SPEEDS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {extraActions && <div className="av-player-extra">{extraActions}</div>}
        <IconButton
          label="Close"
          icon="close"
          shortcut="Esc"
          className="av-player-close"
          onClick={onClose}
        />
      </div>
    </div>
  );
}
