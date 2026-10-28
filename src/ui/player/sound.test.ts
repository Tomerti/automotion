import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A fake Web Audio context that records every oscillator and its frequency changes. */
class FakeContext {
  static oscillators: { set: number[]; ramp: number[] }[] = [];
  state = 'running';
  currentTime = 0;
  destination = {};
  resume = vi.fn();
  createOscillator() {
    const osc = { set: [] as number[], ramp: [] as number[] };
    FakeContext.oscillators.push(osc);
    return {
      type: 'sine',
      frequency: {
        setValueAtTime: (v: number) => osc.set.push(v),
        exponentialRampToValueAtTime: (v: number) => osc.ramp.push(v),
      },
      connect: (n: unknown) => n,
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: (n: unknown) => n,
    };
  }
}

beforeEach(() => {
  FakeContext.oscillators = [];
  vi.resetModules();
  vi.stubGlobal('AudioContext', FakeContext);
});
afterEach(() => vi.unstubAllGlobals());

describe('run sounds', () => {
  it('a rejected word is one falling note, not two separate ones', async () => {
    const { playVerdictSound } = await import('./sound');
    playVerdictSound(false);
    expect(FakeContext.oscillators).toHaveLength(1);
    const [note] = FakeContext.oscillators;
    // It glides down from where it starts.
    expect(note?.ramp[0]).toBeLessThan(note?.set[0] ?? 0);
  });

  it('an accepted word is a quick three-note arpeggio, the Run chime two notes', async () => {
    const { playRunSound, playVerdictSound } = await import('./sound');
    playVerdictSound(true);
    expect(FakeContext.oscillators).toHaveLength(3);
    playRunSound();
    expect(FakeContext.oscillators).toHaveLength(5);
  });
});
