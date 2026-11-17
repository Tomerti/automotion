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
const THREE: StateId[] = ['q_0', 'q_2', 'q_3'];

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
const stage = (n: 1 | 2 | 3 | 4): Automaton => {
  let a = moved(tidied, THREE, 0, -80);
  a = withState(a, 'q_1', { y: at(a, 'q_4').y });
  if (n >= 2) a = withTransition(a, 'q_3', 'q_2', { bend: 40 });
  if (n >= 3) a = withTransition(a, 'q_3', 'q_2', { labelSide: OTHER_SIDE });
  if (n >= 4) a = withState(a, 'q_0', { startAngle: Math.PI / 2 });
  return a;
};

describe('the Arrange lesson', () => {
  it('opens on Divisible by 5', () => {
    expect(start.name).toBe('Divisible by 5');
    expect(start.kind).toBe('DFA');
    expect(runWord(start, '101').accepted).toBe(true);
    expect(runWord(start, '1010').accepted).toBe(true);
    expect(runWord(start, '110').accepted).toBe(false);
    expect(runWord(start, '111').accepted).toBe(false);
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
    for (const a of [start, tidied]) {
      expect(at(a, 'q_1').x).not.toBe(at(a, 'q_4').x);
      expect(at(a, 'q_1').y).not.toBe(at(a, 'q_4').y);
    }
    const [p, q] = [at(tidied, 'q_0'), at(tidied, 'q_2')];
    const box = {
      x0: Math.min(p.x, q.x) - STATE_RADIUS,
      x1: Math.max(p.x, q.x) + STATE_RADIUS,
      y0: Math.min(p.y, q.y) - STATE_RADIUS,
      y1: Math.max(p.y, q.y) + STATE_RADIUS,
    };
    for (const s of tidied.states) {
      if (s.id === 'q_0' || s.id === 'q_2') continue;
      const inside =
        s.x >= box.x0 - STATE_RADIUS &&
        s.x <= box.x1 + STATE_RADIUS &&
        s.y >= box.y0 - STATE_RADIUS &&
        s.y <= box.y1 + STATE_RADIUS;
      expect(inside, s.id).toBe(false);
    }
    const q3 = at(tidied, 'q_3');
    expect(q3.x >= box.x0 && q3.x <= box.x1 && q3.y >= box.y0 && q3.y <= box.y1).toBe(false);
    const t = tidied.transitions.find((x) => x.from === 'q_3' && x.to === 'q_2');
    expect(t?.symbols).toEqual(['1']);
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
      tidyCtx({ selected: ['q_0', 'q_2'] }),
      tidyCtx({ selected: THREE }),
      tidyCtx({ automaton: three, selected: THREE }),
      tidyCtx({ automaton: stage(1) }),
      tidyCtx({ automaton: stage(2) }),
      tidyCtx({ automaton: stage(3) }),
      tidyCtx({ automaton: stage(4) }),
      tidyCtx({ automaton: stage(4), selected: all }),
    ].map((c) => {
      p = advance(L, p.progress, p.latched, c);
      return p.current;
    });
    expect(currents).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(steps[9]!.id).toBe('done');
  });

  it('needs all three moved by the same offset at step 4', () => {
    const c = tidyCtx({ automaton: moved(tidied, ['q_0'], 0, -80) });
    expect(advance(L, 3, new Set(['arrange/box', 'arrange/add']), c).current).toBe(3);
  });

  it('asks to reselect the three when they are not all selected', () => {
    expect(steps[3]!.hint(tidyCtx({ selected: ['q_0'] }))).toEqual({
      kind: 'first',
      text: 'First, select «q_0», «q_2» and «q_3» again.',
    });
    expect(steps[3]!.hint(tidyCtx({ selected: THREE }))).toBeNull();
  });

  it('does not take a bend that flips the automatic side for moving the symbols', () => {
    const a = withTransition(stage(2), 'q_3', 'q_2', { bend: -40 });
    expect(advance(L, 6, new Set(), tidyCtx({ automaton: a })).current).toBe(6);
  });

  it('does not take turning the start arrow back to where it was', () => {
    const a = withState(stage(3), 'q_0', { startAngle: START_ANGLE });
    expect(advance(L, 7, new Set(), tidyCtx({ automaton: a })).current).toBe(7);
  });

  it('sends part 3 back to its first undone step when Tidy is pressed again', () => {
    const p = advance(L, 8, new Set(['arrange/all']), tidyCtx({ automaton: tidied }));
    expect(p.current).toBe(4);
  });

  it('completes no part-3 step when undo goes past Tidy', () => {
    for (const progress of [4, 5, 6, 7]) {
      const p = advance(L, progress, new Set(), tidyCtx({ automaton: start }));
      expect(p.progress).toBe(progress);
      expect(p.current).toBe(4);
    }
  });

  it('fails the bend, label and start checks on the messy drawing', () => {
    const snapped = withState(start, 'q_1', { y: at(start, 'q_4').y });
    const c = tidyCtx({ automaton: snapped });
    // Snap holds, so each fall-back lands on the bend step; label and start are checked directly.
    for (const progress of [5, 6, 7]) {
      expect(advance(L, progress, new Set(), c).current).toBe(5);
    }
    expect(steps[4]!.done(c)).toBe(true);
    for (const i of [5, 6, 7]) expect(steps[i]!.done(c), steps[i]!.id).toBe(false);
  });
});
