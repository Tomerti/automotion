import { beforeAll, describe, expect, it } from 'vitest';
import type { Automaton, LabelSide, StateId, Transition } from '../../../core/model';
import { START_ANGLE, STATE_RADIUS, labelSideOf } from '../../../core/geometry';
import { runWord } from '../../../core/run';
import { layoutAutomaton } from '../../../layout/layout';
import { advance, lessonSteps } from '../engine';
import type { LessonAction, Progress, TutorialContext } from '../engine';
import { ARRANGE_LESSON } from './arrange';

const L = ARRANGE_LESSON;
const start = L.start!;
const steps = lessonSteps(L);
const THREE: StateId[] = ['q_1', 'q_2', 'q_3'];

let tidied: Automaton;
beforeAll(async () => {
  tidied = await layoutAutomaton(start);
});

const ctx = (over: Partial<TutorialContext>): TutorialContext => ({
  automaton: start,
  isActive: true,
  trace: null,
  stepIndex: 0,
  selected: [],
  owned: [start.id],
  actions: new Set<LessonAction>(),
  ...over,
});

const at = (a: Automaton, id: StateId) => a.states.find((s) => s.id === id)!;

const moved = (a: Automaton, ids: StateId[], dx: number, dy: number): Automaton => ({
  ...a,
  states: a.states.map((s) => (ids.includes(s.id) ? { ...s, x: s.x + dx, y: s.y + dy } : s)),
});
const withTransition = (
  a: Automaton,
  from: StateId,
  to: StateId,
  patch: Partial<Transition>,
): Automaton => ({
  ...a,
  transitions: a.transitions.map((t) => (t.from === from && t.to === to ? { ...t, ...patch } : t)),
});
const withState = (
  a: Automaton,
  id: StateId,
  patch: { x?: number; y?: number; startAngle?: number },
): Automaton => ({
  ...a,
  states: a.states.map((s) => (s.id === id ? { ...s, ...patch } : s)),
});

/** The context right after Tidy, with `over` on top. */
const tidyCtx = (over: Partial<TutorialContext> = {}): TutorialContext =>
  ctx({ automaton: tidied, tidied, actions: new Set<LessonAction>(['tidy']), ...over });

const OTHER_SIDE: LabelSide = labelSideOf(40, undefined) === 'left' ? 'right' : 'left';

/** Every part-3 change made on top of the three moved together. */
const stage = (n: 1 | 2 | 3): Automaton => {
  let a = moved(tidied, THREE, 0, -80);
  if (n >= 1) a = withTransition(a, 'q_4', 'q_0', { bend: 40 });
  if (n >= 2) a = withTransition(a, 'q_4', 'q_0', { labelSide: OTHER_SIDE });
  if (n >= 3) a = withState(a, 'q_0', { startAngle: Math.PI / 2 });
  return a;
};

describe('the Arrange lesson', () => {
  it('opens on Number of 0s mod 5 = 0', () => {
    expect(start.name).toBe('Number of 0s mod 5 = 0');
    expect(start.kind).toBe('DFA');
    for (const w of ['', '00000', '1010101010', '111']) {
      expect(runWord(start, w).accepted, w).toBe(true);
    }
    for (const w of ['0', '0000']) expect(runWord(start, w).accepted, w).toBe(false);
  });

  it('is messy by positions only', () => {
    expect(start.states.some((s) => s.startAngle !== undefined)).toBe(false);
    for (const t of start.transitions) {
      expect(t.bend).toBeUndefined();
      expect(t.loopAngle).toBeUndefined();
      expect(t.labelSide).toBeUndefined();
    }
  });

  it('Tidy leaves every step something to do', () => {
    const [p, q] = [at(tidied, 'q_1'), at(tidied, 'q_2')];
    const box = {
      x0: Math.min(p.x, q.x) - STATE_RADIUS,
      x1: Math.max(p.x, q.x) + STATE_RADIUS,
      y0: Math.min(p.y, q.y) - STATE_RADIUS,
      y1: Math.max(p.y, q.y) + STATE_RADIUS,
    };
    for (const s of tidied.states) {
      if (s.id === 'q_1' || s.id === 'q_2') continue;
      const near =
        s.x >= box.x0 - STATE_RADIUS &&
        s.x <= box.x1 + STATE_RADIUS &&
        s.y >= box.y0 - STATE_RADIUS &&
        s.y <= box.y1 + STATE_RADIUS;
      expect(near, s.id).toBe(false);
    }
    const q3 = at(tidied, 'q_3');
    expect(q3.x >= box.x0 && q3.x <= box.x1 && q3.y >= box.y0 && q3.y <= box.y1).toBe(false);
    const t = tidied.transitions.find((x) => x.from === 'q_4' && x.to === 'q_0');
    expect(t?.symbols).toEqual(['0']);
    expect(t?.bend).toBeUndefined();
    expect(t?.labelSide).toBeUndefined();
    expect(at(tidied, 'q_0').startAngle).toBeUndefined();
  });

  it('counts nothing before Tidy', () => {
    expect(advance(L, 0, new Set(), ctx({ selected: THREE })).current).toBe(0);
  });

  it('walks every step to the closing card', () => {
    const three = moved(tidied, THREE, 0, -80);
    const all = tidied.states.map((s) => s.id);
    let p: Progress = { progress: 0, current: 0, latched: new Set() };
    const currents = [
      tidyCtx(),
      tidyCtx({ selected: ['q_1', 'q_2'] }),
      tidyCtx({ selected: THREE }),
      tidyCtx({ automaton: three, selected: THREE }),
      tidyCtx({ automaton: stage(1) }),
      tidyCtx({ automaton: stage(2) }),
      tidyCtx({ automaton: stage(3) }),
      tidyCtx({ automaton: stage(3), selected: all }),
    ].map((c) => {
      p = advance(L, p.progress, p.latched, c);
      return p.current;
    });
    expect(currents).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(steps[8]!.id).toBe('done');
  });

  it('needs all three moved by the same offset at step 4', () => {
    const c = tidyCtx({ automaton: moved(tidied, ['q_1'], 0, -80) });
    expect(advance(L, 3, new Set(['arrange/box', 'arrange/add']), c).current).toBe(3);
  });

  it('asks to reselect the three when they are not all selected', () => {
    expect(steps[3]!.hint(tidyCtx({ selected: ['q_1'] }))).toEqual({
      kind: 'first',
      text: 'First, select «q_1», «q_2» and «q_3» again.',
    });
    expect(steps[3]!.hint(tidyCtx({ selected: THREE }))).toBeNull();
  });

  it('says to press Tidy when one of the three moved on its own', () => {
    const apart = moved(moved(tidied, ['q_2'], 30, 0), THREE, 0, -80);
    const c = tidyCtx({ automaton: apart, selected: THREE });
    expect(advance(L, 3, new Set(['arrange/box', 'arrange/add']), c).current).toBe(3);
    expect(steps[3]!.hint(c)).toEqual({
      kind: 'first',
      text: 'First, press Tidy: one of them moved on its own.',
    });
    const again = tidyCtx({ automaton: moved(tidied, THREE, 0, -80), selected: THREE });
    expect(advance(L, 3, new Set(['arrange/box', 'arrange/add']), again).current).toBeGreaterThan(
      3,
    );
  });

  it('does not take a bend that flips the automatic side for moving the symbols', () => {
    const a = withTransition(stage(1), 'q_4', 'q_0', { bend: -40 });
    expect(advance(L, 5, new Set(), tidyCtx({ automaton: a })).current).toBe(5);
  });

  it('does not take turning the start arrow back to where it was', () => {
    const a = withState(stage(2), 'q_0', { startAngle: START_ANGLE });
    expect(advance(L, 6, new Set(), tidyCtx({ automaton: a })).current).toBe(6);
  });

  it('keeps the fine-tuning done when Tidy is pressed again', () => {
    const done = new Set(['arrange/bend', 'arrange/label', 'arrange/start']);
    expect(advance(L, 7, done, tidyCtx({ automaton: tidied })).current).toBe(7);
  });

  it('counts the start arrow turned and dragged back to where it was', () => {
    let p = advance(L, 6, new Set(), tidyCtx({ automaton: stage(3) }));
    expect(p.current).toBe(7);
    const back = withState(stage(3), 'q_0', { startAngle: START_ANGLE });
    p = advance(L, p.progress, p.latched, tidyCtx({ automaton: back }));
    expect(p.current).toBe(7);
  });

  it('counts the arrow bent and dragged back to straight', () => {
    const moved3 = moved(tidied, THREE, 0, -80);
    let p = advance(L, 4, new Set(), tidyCtx({ automaton: stage(1) }));
    expect(p.current).toBe(5);
    p = advance(L, p.progress, p.latched, tidyCtx({ automaton: moved3 }));
    expect(p.current).toBe(5);
  });

  it('completes no part-3 step when undo goes past Tidy', () => {
    for (const progress of [4, 5, 6]) {
      const p = advance(L, progress, new Set(), tidyCtx({ automaton: start }));
      expect(p.progress).toBe(progress);
      expect(p.current).toBe(4);
    }
  });

  it('fails the bend, label and start checks on the messy drawing', () => {
    const c = tidyCtx({ automaton: start });
    for (const i of [4, 5, 6]) expect(steps[i]!.latch?.(c), steps[i]!.id).toBe(false);
  });
});
