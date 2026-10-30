import { act, cleanup, render, screen } from '@testing-library/react';
import fc from 'fast-check';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { canRun, runWord } from '../../core/run';
import { playRunSound, playVerdictSound } from '../player/sound';
import { DEMO_NFA, demoWord, STEP_MS, VERDICT_HOLD_MS } from './demoRun';
import { WelcomeDemo } from './WelcomeDemo';

vi.mock('../player/sound', () => ({ playRunSound: vi.fn(), playVerdictSound: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** A `random` that cycles through `values`. */
const cycling = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] as number;
};

it('words have 4 to 7 symbols over {0, 1} and run on the demo NFA', () => {
  fc.assert(
    fc.property(
      fc.array(fc.double({ min: 0, max: 0.999, noNaN: true }), { minLength: 1 }),
      (rs) => {
        const w = demoWord(cycling(rs));
        expect(w).toMatch(/^[01]{4,7}$/);
        expect(canRun(DEMO_NFA, w)).toBeNull();
      },
    ),
  );
});

it('about half of the words are accepted', () => {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const words = Array.from({ length: 400 }, () => demoWord(random));
  const accepted = words.filter((w) => runWord(DEMO_NFA, w).accepted).length;
  expect(accepted).toBeGreaterThan(140);
  expect(accepted).toBeLessThan(260);
});

it('is decorative: hidden from assistive tech, with no controls', () => {
  render(<WelcomeDemo />);
  const demo = screen.getByTestId('welcome-demo');
  expect(demo).toHaveAttribute('aria-hidden', 'true');
  expect(demo.querySelector('button, input, [tabindex]')).toBeNull();
});

it('steps through a run, holds the verdict, then runs another word, silently, forever', () => {
  render(<WelcomeDemo random={cycling([0.1, 0.9, 0.3, 0.6, 0.2, 0.8, 0.45])} />);
  const demo = screen.getByTestId('welcome-demo');
  const first = demo.getAttribute('data-word') ?? '';
  expect(demo).toHaveAttribute('data-step', '0');
  expect(screen.getAllByTestId('word-char')).toHaveLength(first.length);

  // Start, one read per symbol, then the verdict.
  for (let i = 1; i <= first.length + 1; i++) {
    act(() => vi.advanceTimersByTime(STEP_MS));
    expect(demo).toHaveAttribute('data-step', String(i));
    expect(demo).toHaveAttribute('data-word', first);
  }
  act(() => vi.advanceTimersByTime(VERDICT_HOLD_MS - 1));
  expect(demo).toHaveAttribute('data-word', first);
  act(() => vi.advanceTimersByTime(1));
  expect(demo).toHaveAttribute('data-step', '0');
  expect(demo.getAttribute('data-word')).not.toBe(first);

  act(() => vi.advanceTimersByTime(20 * (8 * STEP_MS + VERDICT_HOLD_MS)));
  expect(playRunSound).not.toHaveBeenCalled();
  expect(playVerdictSound).not.toHaveBeenCalled();
});

it('stops when it unmounts', () => {
  const { unmount } = render(<WelcomeDemo />);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
