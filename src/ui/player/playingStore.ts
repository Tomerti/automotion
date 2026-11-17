import { create } from 'zustand';

interface PlayingState {
  playing: boolean;
}

/**
 * Whether the open player is playing, mirrored here by `TracePlayer` (`onPlayingChange`, wired in
 * `App`) so a trace view can tell: To regex takes a click on a state as a pick only while paused.
 */
export const usePlaying = create<PlayingState>()(() => ({ playing: false }));

export function setPlaying(playing: boolean): void {
  usePlaying.setState({ playing });
}
