import { describe, expect, it } from 'vitest';
import { runWord } from '../../../core/run';
import { advance, countedSteps, lessonSteps } from '../engine';
import type { LessonAction, TutorialContext } from '../engine';
import { SHARE_LESSON } from './share';

const L = SHARE_LESSON;
const start = L.start!;
const steps = lessonSteps(L);

const ctx = (...actions: LessonAction[]): TutorialContext => ({
  automaton: start,
  isActive: true,
  trace: null,
  stepIndex: 0,
  selected: [],
  owned: [start.id],
  actions: new Set(actions),
});

/** The step on the card once the link was shared. */
const linked = () => advance(L, 0, new Set(), ctx('share-link'));

describe('the Share and export lesson', () => {
  it('opens on the even-zeros DFA, with no examples', () => {
    expect(start.name).toBe('Even zeros');
    expect(start.kind).toBe('DFA');
    expect(L.parts[0]!.goal.examples).toEqual([]);
    expect(runWord(start, '1010').accepted).toBe(true);
    expect(runWord(start, '10').accepted).toBe(false);
  });

  it('stays within six counted steps', () => {
    expect(countedSteps(L)).toBeLessThanOrEqual(6);
  });

  it('walks from the link, to the image, to the LaTeX and the closing card', () => {
    expect(advance(L, 0, new Set(), ctx()).current).toBe(0);
    const a = linked();
    expect(a.current).toBe(1);
    const b = advance(L, a.progress, a.latched, ctx('share-link', 'copy-image'));
    expect(b.current).toBe(2);
    const c = advance(L, b.progress, b.latched, ctx('share-link', 'copy-image', 'copy-latex'));
    expect(c.current).toBe(3);
    expect(steps[c.current]!.id).toBe('done');
  });

  it.each(['copy-image', 'export-png', 'export-svg'] as const)(
    '%s completes the image step',
    (a) => {
      const l = linked();
      expect(advance(L, l.progress, l.latched, ctx('share-link', a)).current).toBe(2);
    },
  );

  it('takes Copy LaTeX for the LaTeX step, and asks for that one only', () => {
    const l = linked();
    const b = advance(L, l.progress, l.latched, ctx('share-link', 'copy-image'));
    const latex = ctx('share-link', 'copy-image', 'copy-latex');
    expect(advance(L, b.progress, b.latched, latex).current).toBe(3);
    const exported = ctx('share-link', 'copy-image', 'export-latex');
    expect(advance(L, b.progress, b.latched, exported).current).toBe(2);
    expect(steps[2]!.instruction(ctx())).toBe(
      'Open Share, copy or export again and choose Copy LaTeX.',
    );
  });

  it('frames the menu only on the first step', () => {
    expect(steps[0]!.target(ctx())).toBe('button[aria-label="Share, copy or export"]');
    expect(steps[1]!.target(ctx())).toBeNull();
    expect(steps[2]!.target(ctx())).toBeNull();
  });

  it('says what the copied picture is for once it is copied', () => {
    expect(steps[2]!.explain(ctx('share-link', 'copy-image'))).toBe(
      'Copied: paste it into notes, slides or a chat and you get a picture of the automaton.',
    );
  });

  it('does not take the image for the link', () => {
    expect(advance(L, 0, new Set(), ctx('copy-image')).current).toBe(0);
  });

  it('asks to clear the selection first on the image step, since Ctrl+C would copy the states', () => {
    const picked: TutorialContext = { ...ctx('share-link'), selected: ['even'] };
    expect(steps[1]!.hint(picked)).toEqual({
      kind: 'first',
      text: 'First, click the empty canvas to clear the selection.',
    });
    expect(steps[1]!.hint(ctx('share-link'))).toBeNull();
  });
});
