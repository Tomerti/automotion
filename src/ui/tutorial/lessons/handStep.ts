import type { RunTrace } from '../../../core/trace';
import { ownsTrace } from '../engine';
import type { TutorialContext } from '../engine';

/** Helpers for lessons that step one run by hand, pausing playback at each moment. */

/** The open run is an owned run of `word`. */
export function runOf(ctx: TutorialContext, word: string): RunTrace | null {
  const t = ctx.trace;
  return t?.kind === 'run' && t.word === word && ownsTrace(ctx) ? t : null;
}

/**
 * The playback pause and the way back for a card that explains the moment at index `moment` of the
 * open run of `word`. Playback stops at the moment while the run is before it, and one step on
 * (the next card's moment) once it has got there; the lesson's last card (`final`) has no next
 * moment, so the run's end stops it. Elsewhere, and for any other run, it doesn't pause.
 */
export function atMoment(
  word: string,
  moment: number,
  final = false,
): {
  pauseAt(ctx: TutorialContext): number | null;
  first(ctx: TutorialContext): string | null;
} {
  return {
    pauseAt(ctx) {
      if (!runOf(ctx, word)) return null;
      if (ctx.stepIndex < moment) return moment;
      return final ? null : moment + 1;
    },
    first(ctx) {
      if (!runOf(ctx, word)) return `First, run \`${word}\` again.`;
      return ctx.stepIndex < moment ? 'First, press [→] to get back to this point.' : null;
    },
  };
}

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
