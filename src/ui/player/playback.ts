import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/** Time one step is shown for at 1× while playing. */
export const BASE_STEP_MS = 800;
/** Share of a step's time that its token animation takes; the token then rests. */
export const MOVE_SHARE = 0.75;

export const SPEEDS = [
  { value: 0.5, label: '0.5×' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
] as const;

interface PlaybackState {
  speed: number;
}

/**
 * The open player's speed, mirrored here by `TracePlayer` so the trace views can scale their
 * animations with it. A new trace remounts the player, which starts again at 1×.
 */
export const playbackStore = createStore<PlaybackState>()(() => ({ speed: 1 }));

export const usePlaybackSpeed = (): number => useStore(playbackStore, (s) => s.speed);

export function setPlaybackSpeed(speed: number): void {
  playbackStore.setState({ speed });
}

export const stepIntervalMs = (speed: number): number => BASE_STEP_MS / speed;
export const moveDurationMs = (speed: number): number => (BASE_STEP_MS * MOVE_SHARE) / speed;

/** True when the user asked the system for less motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
