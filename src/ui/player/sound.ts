/**
 * Short synthesized cues for runs (no audio files). Every call is a silent no-op where Web Audio
 * is missing (jsdom, old browsers) or the browser refuses to start it.
 */

type Note = { freq: number; at: number; length: number };

let context: AudioContext | null = null;
/** Audio time the last queued cue ends, so a verdict right after Run waits for the chime. */
let busyUntil = 0;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null;
  try {
    context ??= new window.AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

function play(notes: Note[], type: OscillatorType, volume: number): void {
  const ctx = audio();
  if (!ctx) return;
  const start = Math.max(ctx.currentTime + 0.01, busyUntil);
  for (const n of notes) {
    const t = start + n.at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(n.freq, t);
    // Quick attack and an exponential tail: a soft pluck instead of a click.
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + n.length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + n.length + 0.02);
  }
  busyUntil = start + Math.max(...notes.map((n) => n.at + n.length * 0.6));
}

/** Rising two-note chime when a run starts. */
export function playRunSound(): void {
  play(
    [
      { freq: 659.25, at: 0, length: 0.16 },
      { freq: 987.77, at: 0.08, length: 0.24 },
    ],
    'triangle',
    0.14,
  );
}

/** A bright major arpeggio for an accepted word, a low falling pair for a rejected one. */
export function playVerdictSound(accepted: boolean): void {
  if (accepted) {
    play(
      [
        { freq: 523.25, at: 0, length: 0.18 },
        { freq: 659.25, at: 0.07, length: 0.18 },
        { freq: 783.99, at: 0.14, length: 0.32 },
      ],
      'triangle',
      0.13,
    );
  } else {
    play(
      [
        { freq: 311.13, at: 0, length: 0.18 },
        { freq: 233.08, at: 0.11, length: 0.34 },
      ],
      'sine',
      0.18,
    );
  }
}
