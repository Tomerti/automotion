/** The welcome demo's automaton, words and pace (pure; `WelcomeDemo` plays them). */
import type { Automaton } from '../../core/model';
import { runWord } from '../../core/run';
import type { RunTrace } from '../../core/trace';
import { stepIntervalMs } from '../player/playback';

/** The NFA for "ends in 01": its tokens split on every 0 and die off, so there is always motion. */
export const DEMO_NFA: Automaton = {
  id: 'welcome-demo',
  name: 'Ends in 01',
  kind: 'NFA',
  alphabet: ['0', '1'],
  states: [
    { id: 'q_0', label: 'q_0', x: 0, y: 0 },
    { id: 'q_1', label: 'q_1', x: 150, y: 0 },
    { id: 'q_2', label: 'q_2', x: 300, y: 0 },
  ],
  starts: ['q_0'],
  accepting: ['q_2'],
  transitions: [
    { id: 'q_0->q_0', from: 'q_0', to: 'q_0', symbols: ['0', '1'] },
    { id: 'q_0->q_1', from: 'q_0', to: 'q_1', symbols: ['0'] },
    { id: 'q_1->q_2', from: 'q_1', to: 'q_2', symbols: ['1'] },
  ],
};

/** Time each step is shown for: the player's pace at 1×. */
export const STEP_MS = stepIntervalMs(1);
/** Time the verdict is held before the next word. */
export const VERDICT_HOLD_MS = 1800;

/** A word of 4 to 7 random bits; half of them end in 01, so about half are accepted. */
export function demoWord(random: () => number = Math.random): string {
  const length = 4 + Math.floor(random() * 4);
  const bits = Array.from({ length }, () => (random() < 0.5 ? '0' : '1')).join('');
  return random() < 0.5 ? `${bits.slice(0, -2)}01` : bits;
}

/** A run of a new word, not the same as `previous` (gives up after a few tries). */
export function nextDemoRun(random: () => number, previous?: string): RunTrace {
  let word = demoWord(random);
  for (let i = 0; i < 5 && word === previous; i++) word = demoWord(random);
  return runWord(DEMO_NFA, word);
}
