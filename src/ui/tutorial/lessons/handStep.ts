import type { RunTrace } from '../../../core/trace';
import { ownsTrace } from '../engine';
import type { TutorialContext } from '../engine';

/** Helpers for lessons that step one run by hand, pausing playback at each moment. */

/** The open run is an owned run of `word`. */
export function runOf(ctx: TutorialContext, word: string): RunTrace | null {
  const t = ctx.trace;
  return t?.kind === 'run' && t.word === word && ownsTrace(ctx) ? t : null;
}

/** Where playback pauses next: the card explains the moment one index on. */
export const pauseAfter =
  (word: string, next: number) =>
  (ctx: TutorialContext): number | null =>
    runOf(ctx, word) ? next : null;

/**
 * Before a paused step: run `word` again if it isn't open, or step back to the moment the card
 * explains (index `moment`) if the run is before it.
 */
export const getBack =
  (word: string, moment: number) =>
  (ctx: TutorialContext): string | null => {
    if (!runOf(ctx, word)) return `First, run \`${word}\` again.`;
    return ctx.stepIndex < moment ? 'First, press [→] to get back to this point.' : null;
  };

/** The run of `word` is open and has reached `index`. */
export const reached = (word: string, index: number) => (ctx: TutorialContext) =>
  runOf(ctx, word) !== null && ctx.stepIndex >= index;

/**
 * The hint of a latch step that asks for a run of `word`: says which other word is open.
 * (A latch step doesn't get the engine's wrong-word hint, so the wording is repeated here.)
 */
export const otherWordHint =
  (word: string) =>
  (ctx: TutorialContext): string | null => {
    const t = ctx.trace;
    if (t?.kind !== 'run' || t.word === word || !ownsTrace(ctx)) return null;
    return `That was \`${t.word === '' ? 'ε' : t.word}\`. Press [Esc] and run \`${word}\`.`;
  };
