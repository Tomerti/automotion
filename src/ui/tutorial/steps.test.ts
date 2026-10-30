import { describe, expect, it } from 'vitest';
import type { Automaton } from '../../core/model';
import { runWord } from '../../core/run';
import { fixture } from '../../core/testing/fixtures';
import type { FixtureSpec } from '../../core/testing/fixtures';
import type { AnyTrace } from '../../core/trace';
import { advance, COUNTED_STEPS, roles, runSucceeded, STEPS } from './steps';
import type { StepId, TutorialContext } from './steps';

const tut = (spec: Partial<FixtureSpec>): Automaton =>
  fixture({ kind: 'DFA', alphabet: '01', states: [], name: 'tut', ...spec });

/** The finished part 1: an even number of 0s. */
const evenZeros = (): Automaton =>
  tut({
    states: ['q_0', 'q_1'],
    start: 'q_0',
    accepting: ['q_0'],
    edges: [
      ['q_0', '0', 'q_1'],
      ['q_1', '0', 'q_0'],
      ['q_0', '1', 'q_0'],
      ['q_1', '1', 'q_1'],
    ],
  });

/** The finished part 2: every word. */
const everything = (): Automaton =>
  tut({ states: ['q_0'], start: 'q_0', accepting: ['q_0'], edges: [['q_0', '0,1', 'q_0']] });

/** `a` with q_0 renamed `any`, as the rename step asks. */
const named = (a: Automaton): Automaton => ({
  ...a,
  states: a.states.map((s) => (s.id === 'q_0' ? { ...s, label: 'any' } : s)),
});

function ctx(
  automaton: Automaton | undefined,
  more: Partial<TutorialContext> = {},
): TutorialContext {
  return { automaton, isActive: true, trace: null, stepIndex: 0, selected: [], ...more };
}

/** A run of `word` on `a`, shown at its verdict (or at `at`). */
function ran(a: Automaton, word: string, at?: number): Partial<TutorialContext> {
  const trace: AnyTrace = runWord(a, word);
  return { trace, stepIndex: at ?? trace.steps.length - 1 };
}

const idx = (id: StepId): number => STEPS.findIndex((s) => s.id === id);
const step = (id: StepId) => STEPS[idx(id)]!;
const none: ReadonlySet<StepId> = new Set();
const hintText = (id: StepId, c: TutorialContext): string | undefined => {
  const h = step(id).hint(c);
  return h?.kind === 'text' ? h.text : undefined;
};

describe('the step table', () => {
  it('has twelve counted steps and a closing card, in the spec order', () => {
    expect(STEPS.map((s) => s.id)).toEqual([
      'add-q0',
      'start',
      'accepting',
      'add-q1',
      'q0-q1',
      'q1-q0',
      'loops',
      'run-1010',
      'run-10',
      'delete-q1',
      'loop-01',
      'rename-q0',
      'run-10-again',
      'done',
    ]);
    expect(COUNTED_STEPS).toBe(13);
    expect(STEPS.map((s) => s.part)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3]);
  });
});

describe('roles', () => {
  it('q0 is the start state even when it is not the first state', () => {
    const r = roles(tut({ states: ['a', 'b'], start: 'b' }));
    expect(r.q0?.id).toBe('b');
    expect(r.q1?.id).toBe('a');
  });

  it('without a start state, q0 is the first state', () => {
    expect(roles(tut({ states: ['a', 'b'] })).q0?.id).toBe('a');
  });

  it('renaming a state changes nothing', () => {
    const a = evenZeros();
    const renamed = { ...a, states: a.states.map((s) => ({ ...s, label: 'x' + s.label })) };
    expect(roles(renamed).q0?.id).toBe('q_0');
    expect(step('loops').done(ctx(renamed))).toBe(true);
  });
});

describe('done', () => {
  it('follows the structural steps of part 1', () => {
    expect(step('add-q0').done(ctx(tut({})))).toBe(false);
    expect(step('add-q0').done(ctx(tut({ states: ['q_0'] })))).toBe(true);
    expect(step('start').done(ctx(tut({ states: ['q_0'] })))).toBe(false);
    expect(step('start').done(ctx(tut({ states: ['q_0'], start: 'q_0' })))).toBe(true);
    expect(step('accepting').done(ctx(tut({ states: ['q_0'], start: 'q_0' })))).toBe(false);
    expect(
      step('accepting').done(ctx(tut({ states: ['q_0'], start: 'q_0', accepting: ['q_0'] }))),
    ).toBe(true);
    expect(step('add-q1').done(ctx(tut({ states: ['q_0', 'q_1'] })))).toBe(true);
  });

  it('compares edge symbols as exact sets', () => {
    const two = (edges: FixtureSpec['edges']): TutorialContext =>
      ctx(tut({ states: ['q_0', 'q_1'], start: 'q_0', edges }));
    expect(step('q0-q1').done(two([['q_0', '0', 'q_1']]))).toBe(true);
    expect(step('q0-q1').done(two([['q_0', '0,1', 'q_1']]))).toBe(false);
    expect(step('q1-q0').done(two([['q_1', '0', 'q_0']]))).toBe(true);
    expect(step('loops').done(two([['q_0', '1', 'q_0']]))).toBe(false);
    expect(step('loops').done(ctx(evenZeros()))).toBe(true);
  });

  it('follows the structural steps of part 2', () => {
    expect(step('delete-q1').done(ctx(evenZeros()))).toBe(false);
    const one = tut({
      states: ['q_0'],
      start: 'q_0',
      accepting: ['q_0'],
      edges: [['q_0', '1', 'q_0']],
    });
    expect(step('delete-q1').done(ctx(one))).toBe(true);
    expect(step('loop-01').done(ctx(one))).toBe(false);
    expect(step('loop-01').done(ctx(everything()))).toBe(true);
    expect(step('rename-q0').done(ctx(everything()))).toBe(false);
    expect(step('rename-q0').done(ctx(named(everything())))).toBe(true);
  });

  it('takes any name of the user’s own for the rename, but not another q-number', () => {
    const label = (l: string): TutorialContext =>
      ctx({ ...everything(), states: everything().states.map((s) => ({ ...s, label: l })) });
    expect(step('rename-q0').done(label('all'))).toBe(true);
    expect(step('rename-q0').done(label('q_{12}'))).toBe(false);
    expect(step('rename-q0').done(label('q3'))).toBe(false);
  });

  it('the closing card is never done', () => {
    expect(step('done').done(ctx(everything()))).toBe(false);
  });
});

describe('runSucceeded', () => {
  const a = evenZeros();

  it('at the verdict of the right word, with the right result', () => {
    expect(runSucceeded(step('run-1010'), ctx(a, ran(a, '1010')))).toBe(true);
    expect(runSucceeded(step('run-10'), ctx(a, ran(a, '10')))).toBe(true);
  });

  it('not before the verdict', () => {
    expect(runSucceeded(step('run-1010'), ctx(a, ran(a, '1010', 0)))).toBe(false);
  });

  it('not for another word, nor on another automaton', () => {
    expect(runSucceeded(step('run-1010'), ctx(a, ran(a, '11')))).toBe(false);
    const other = { ...a, id: 'other' };
    expect(runSucceeded(step('run-1010'), ctx(a, ran(other, '1010')))).toBe(false);
  });

  it('not with the wrong verdict', () => {
    const b = everything();
    expect(runSucceeded(step('run-10'), ctx(b, ran(b, '10')))).toBe(false);
    expect(runSucceeded(step('run-10-again'), ctx(b, ran(b, '10')))).toBe(true);
  });
});

describe('advance', () => {
  it('stays on the first step of an empty automaton', () => {
    expect(advance(0, none, ctx(tut({})))).toMatchObject({ progress: 0, current: 0 });
  });

  it('moves through every step already done at once, up to the first run', () => {
    const p = advance(0, none, ctx(evenZeros()));
    expect(p.progress).toBe(idx('run-1010'));
    expect(p.current).toBe(idx('run-1010'));
  });

  it('falls back to a step that came undone, keeping the furthest point', () => {
    const a = { ...evenZeros(), starts: [] };
    const p = advance(idx('loops'), none, ctx(a));
    expect(p.current).toBe(idx('start'));
    expect(p.progress).toBe(idx('loops'));
  });

  it('latches a run once its verdict shows, and moves on', () => {
    const a = evenZeros();
    const p = advance(idx('run-1010'), none, ctx(a, ran(a, '1010')));
    expect(p.latched.has('run-1010')).toBe(true);
    expect(p.current).toBe(idx('run-10'));
    // Closing the trace keeps it done.
    expect(advance(p.progress, p.latched, ctx(a)).current).toBe(idx('run-10'));
  });

  it('does not latch a run before its verdict or on another automaton', () => {
    const a = evenZeros();
    expect(advance(idx('run-1010'), none, ctx(a, ran(a, '1010', 0))).latched.size).toBe(0);
    const other = { ...a, id: 'other' };
    expect(advance(idx('run-1010'), none, ctx(a, ran(other, '1010'))).latched.size).toBe(0);
  });

  it('a run does not count while the automaton it needs came undone', () => {
    const broken = { ...evenZeros(), accepting: [] };
    const p = advance(idx('run-1010'), none, ctx(broken, ran(broken, '1010')));
    expect(p.current).toBe(idx('accepting'));
    expect(p.latched.size).toBe(0);
  });

  it('part 2 never falls back into part 1', () => {
    const latched: ReadonlySet<StepId> = new Set(['run-1010', 'run-10']);
    expect(advance(idx('delete-q1'), latched, ctx(evenZeros())).current).toBe(idx('delete-q1'));
    expect(advance(idx('delete-q1'), latched, ctx(tut({}))).current).toBe(idx('delete-q1'));
  });

  it('reaches the closing card after the last run and stays there', () => {
    const b = named(everything());
    const p = advance(idx('run-10-again'), none, ctx(b, ran(b, '10')));
    expect(p.current).toBe(idx('done'));
    expect(p.progress).toBe(idx('done'));
    expect(advance(p.progress, p.latched, ctx(b)).current).toBe(idx('done'));
  });

  it('never moves on while the tutorial automaton is not the active one', () => {
    const p = advance(0, none, ctx(evenZeros(), { isActive: false }));
    expect(p).toMatchObject({ progress: 0, current: 0 });
  });

  it('keeps the step it fell back to while another automaton is open', () => {
    const a = { ...evenZeros(), starts: [] };
    const p = advance(idx('loops'), none, ctx(a, { isActive: false }), idx('start'));
    expect(p).toMatchObject({ progress: idx('loops'), current: idx('start') });
  });
});

describe('hints', () => {
  it('says which automaton is open when it is not the tutorial one', () => {
    expect(step('loops').hint(ctx(evenZeros(), { isActive: false }))).toEqual({
      kind: 'elsewhere',
    });
  });

  it('asks to leave a run before editing, as a next step rather than a mistake', () => {
    const a = evenZeros();
    expect(step('q0-q1').hint(ctx(a, ran(a, '10')))).toEqual({
      kind: 'first',
      text: 'First, press [Esc] to get back to editing.',
    });
    expect(step('delete-q1').hint(ctx(a, ran(a, '1010')))).toMatchObject({ kind: 'first' });
  });

  it('keeps part 1 on show while the run that ended it is open', () => {
    const a = evenZeros();
    expect(step('delete-q1').hint(ctx(a, ran(a, '10')))).toEqual({ kind: 'part-done', part: 1 });
  });

  it('asks to select q0 again before pressing A once the selection is gone', () => {
    const a = tut({ states: ['q_0'], start: 'q_0' });
    expect(step('accepting').hint(ctx(a))).toEqual({
      kind: 'first',
      text: 'First, click q_0 to select it.',
    });
    expect(step('accepting').hint(ctx(a, { selected: ['q_0'] }))).toBeNull();
  });

  it('points out an extra state in part 1', () => {
    expect(hintText('q0-q1', ctx(tut({ states: ['q_0', 'q_1', 'q_2'], start: 'q_0' })))).toContain(
      'Delete the extra state q_2',
    );
  });

  it('points out an accepting q1', () => {
    const a = tut({ states: ['q_0', 'q_1'], start: 'q_0', accepting: ['q_0', 'q_1'] });
    expect(hintText('q0-q1', ctx(a))).toBe(
      'Only q_0 should be accepting: click q_1 and press [A].',
    );
  });

  it('points out that it became an NFA', () => {
    const a = { ...evenZeros(), kind: 'NFA' as const };
    expect(hintText('run-1010', ctx(a))).toContain('switch back to DFA');
  });

  it('points out wrong symbols on the edge being drawn', () => {
    const a = tut({ states: ['q_0', 'q_1'], start: 'q_0', edges: [['q_0', '0,1', 'q_1']] });
    expect(hintText('q0-q1', ctx(a))).toBe('q_0 → q_1 should read only `0`.');
  });

  it('points out wrong symbols on an arrow of a later step', () => {
    const a = tut({ states: ['q_0', 'q_1'], start: 'q_0', edges: [['q_1', '0', 'q_1']] });
    expect(hintText('q0-q1', ctx(a))).toBe('q_1 → q_1 should read only `1`.');
  });

  it('points out a run of another word', () => {
    const a = evenZeros();
    expect(hintText('run-1010', ctx(a, ran(a, '11')))).toBe(
      'That was `11`. Press [Esc] and run `1010`.',
    );
  });

  it('says nothing about the previous step’s run still on screen', () => {
    const a = evenZeros();
    expect(step('run-10').hint(ctx(a, ran(a, '1010')))).toBeNull();
  });

  it('a loop still reading only 1 is not a mistake when it should read 0 and 1', () => {
    const a = tut({
      states: ['q_0'],
      start: 'q_0',
      accepting: ['q_0'],
      edges: [['q_0', '1', 'q_0']],
    });
    expect(step('loop-01').hint(ctx(a))).toBeNull();
    const b = tut({
      states: ['q_0'],
      start: 'q_0',
      accepting: ['q_0'],
      edges: [['q_0', '1,a', 'q_0']],
    });
    expect(hintText('loop-01', ctx(b))).toBe('q_0’s loop should read only `0` and `1`.');
  });

  it('offers undo when every state is gone in part 2', () => {
    expect(hintText('delete-q1', ctx(tut({})))).toBe(
      'Press [Ctrl] + [Z] to bring the start state back.',
    );
  });

  it('names the state to delete instead when the start state was deleted', () => {
    const a = tut({ states: ['x_1'], edges: [['x_1', '1', 'x_1']] });
    expect(hintText('delete-q1', ctx(a))).toBe(
      'That was the start state: press [Ctrl] + [Z] to undo, then delete x_1.',
    );
  });

  it('has no hint on a step going to plan', () => {
    expect(step('q0-q1').hint(ctx(tut({ states: ['q_0', 'q_1'], start: 'q_0' })))).toBeNull();
  });
});

describe('instructions and targets', () => {
  it('use the current labels', () => {
    const a = tut({ states: ['q_0', 'q_1'], start: 'q_0' });
    expect(step('q0-q1').instruction(ctx(a))).toContain('q_0');
    expect(step('q0-q1').instruction(ctx(a))).toContain('q_1');
  });

  it('name every key to press, the symbol to type included', () => {
    const a = tut({ states: ['q_0', 'q_1'], start: 'q_0' });
    expect(step('q0-q1').instruction(ctx(a))).toContain(
      'hold [Shift] and drag from q_0 to q_1, then type [0] and press [Enter]',
    );
    expect(step('run-10').instruction(ctx(a))).toContain('press [Esc]');
  });

  it('point at the state, the loop label or the word box', () => {
    const a = tut({ states: ['q_0'], accepting: [] });
    expect(step('start').target(ctx(a))).toBe(
      '[data-testid="canvas"] [data-state-id="q_0"] .av-state-body',
    );
    const b = tut({
      states: ['q_0'],
      start: 'q_0',
      accepting: ['q_0'],
      edges: [['q_0', '1', 'q_0']],
    });
    expect(step('loop-01').target(ctx(b))).toBe(
      '[data-transition-id="q_0->q_0"] [data-testid="edge-label"]',
    );
    expect(step('run-1010').target(ctx(evenZeros()))).toBe('form:has(input[aria-label="Word"])');
    expect(step('add-q0').target(ctx(tut({})))).toBeNull();
  });

  it('the loops step points at the state still missing its loop', () => {
    const a = tut({ states: ['q_0', 'q_1'], start: 'q_0', edges: [['q_0', '1', 'q_0']] });
    expect(step('loops').target(ctx(a))).toBe(
      '[data-testid="canvas"] [data-state-id="q_1"] .av-state-body',
    );
  });
});
