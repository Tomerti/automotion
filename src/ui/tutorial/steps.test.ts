import { describe, expect, it } from 'vitest';
import { minimize } from '../../core/minimize';
import type { Automaton } from '../../core/model';
import { runWord } from '../../core/run';
import { subsetConstruction } from '../../core/subset';
import { fixture } from '../../core/testing/fixtures';
import type { FixtureSpec } from '../../core/testing/fixtures';
import type { AnyTrace } from '../../core/trace';
import {
  advance,
  COUNTED_STEPS,
  isPart3Trace,
  PART3_NFA,
  PART_DONE,
  PART_GOALS,
  PART_TITLES,
  roles,
  runSucceeded,
  STEPS,
} from './steps';
import type { StepId, TutorialContext } from './steps';

const tut = (spec: Partial<FixtureSpec>): Automaton =>
  fixture({ kind: 'DFA', alphabet: '01', states: [], name: 'tut', ...spec });

/** The finished part 1: an even number of 0s, its states named as the steps ask. */
const evenZeros = (): Automaton =>
  tut({
    states: ['even', 'odd'],
    start: 'even',
    accepting: ['even'],
    edges: [
      ['even', '0', 'odd'],
      ['odd', '0', 'even'],
      ['even', '1', 'even'],
      ['odd', '1', 'odd'],
    ],
  });

/** The finished part 2: every word. */
const everything = (): Automaton =>
  tut({ states: ['q_0'], start: 'q_0', accepting: ['q_0'], edges: [['q_0', '0,1', 'q_0']] });

function ctx(
  automaton: Automaton | undefined,
  more: Partial<TutorialContext> = {},
): TutorialContext {
  return {
    automaton,
    isActive: true,
    trace: null,
    stepIndex: 0,
    selected: [],
    derivedId: null,
    derivedActive: false,
    ...more,
  };
}

/** A run of `word` on `a`, shown at its verdict (or at `at`). */
function ran(a: Automaton, word: string, at?: number): Partial<TutorialContext> {
  const trace: AnyTrace = runWord(a, word);
  return { trace, stepIndex: at ?? trace.steps.length - 1 };
}

/** Part 3's tutorial automaton: the "contains 01" NFA, under the tutorial's id. */
const nfa = (): Automaton => ({ ...PART3_NFA, id: 'tut', name: 'tut' });
const converted = subsetConstruction(nfa());
/** The DFA Save and minimize saves, and its minimization. */
const derived = converted.result;
const minimized = minimize(derived);

/** `trace` open at its last step (or at `at`). */
function showing(trace: AnyTrace, at?: number): Partial<TutorialContext> {
  return { trace, stepIndex: at ?? trace.steps.length - 1 };
}

/** The saved DFA is the one open (not the tutorial automaton). */
const onDerived = (more: Partial<TutorialContext> = {}): TutorialContext =>
  ctx(nfa(), { isActive: false, derivedId: derived.id, derivedActive: true, ...more });

const idx = (id: StepId): number => STEPS.findIndex((s) => s.id === id);
const step = (id: StepId) => STEPS[idx(id)]!;
const none: ReadonlySet<StepId> = new Set();
const hintText = (id: StepId, c: TutorialContext): string | undefined => {
  const h = step(id).hint(c);
  return h?.kind === 'text' ? h.text : undefined;
};

describe('the step table', () => {
  it('has nineteen counted steps and a closing card, in the spec order', () => {
    expect(STEPS.map((s) => s.id)).toEqual([
      'add-q0',
      'name-q0',
      'start',
      'accepting',
      'add-q1',
      'q0-q1',
      'q1-q0',
      'loop-q0',
      'loop-q1',
      'run-1010',
      'run-10',
      'delete-q1',
      'loop-01',
      'rename-q0',
      'run-10-again',
      'convert',
      'convert-end',
      'save-minimize',
      'minimize-end',
      'done',
    ]);
    expect(COUNTED_STEPS).toBe(19);
    expect(STEPS.map((s) => s.part)).toEqual([
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4,
    ]);
    expect(PART_TITLES[3]).toBe('Convert and minimize');
    expect(PART_DONE[2]).toBe('Your DFA accepts every word.');
  });

  it('keeps every instruction short, with a few words of why at most', () => {
    for (const a of [evenZeros(), nfa()]) {
      for (const s of STEPS) {
        expect(s.instruction(ctx(a)).length, s.id).toBeLessThanOrEqual(100);
        expect(s.why(ctx(a))?.length ?? 0, s.id).toBeLessThanOrEqual(70);
      }
    }
  });
});

describe('the goals', () => {
  it('picture what each part builds, with the names the steps ask for', () => {
    const one = PART_GOALS[1].automaton;
    expect(one.states.map((s) => s.label)).toEqual(['even', 'odd']);
    expect(step('loop-q1').done(ctx(one))).toBe(true);
    expect(advance(0, none, ctx(one)).current).toBe(idx('run-1010'));
    const two = PART_GOALS[2].automaton;
    expect(two.states.map((s) => s.label)).toEqual(['any']);
    expect(step('loop-01').done(ctx(two))).toBe(true);
    expect(step('rename-q0').done(ctx(two))).toBe(true);
    const three = PART_GOALS[3].automaton;
    // Part 3's NFA, drawn closer together so it reads at the picture's size.
    const { states, ...rest } = PART3_NFA;
    expect(three).toMatchObject(rest);
    expect(three.kind).toBe('NFA');
    expect(three.states.map((s) => s.label)).toEqual(['q_0', 'q_1', 'q_2']);
    const xs = three.states.map((s) => s.x);
    expect(xs[2]! - xs[0]!).toBeLessThan(states[2]!.x - states[0]!.x);
  });

  it('give example words that the goal really accepts or rejects', () => {
    for (const part of [1, 2, 3] as const) {
      const goal = PART_GOALS[part];
      for (const e of goal.examples) {
        expect(runWord(goal.automaton, e.word).accepted, `${part}: ${e.word}`).toBe(e.accepted);
      }
    }
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
    expect(roles(renamed).q0?.id).toBe('even');
    expect(step('loop-q1').done(ctx(renamed))).toBe(true);
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
    // The second state counts once it has a name.
    expect(step('add-q1').done(ctx(tut({ states: ['q_0', 'q_1'] })))).toBe(false);
    expect(step('add-q1').done(ctx(tut({ states: ['q_0', 'odd'] })))).toBe(true);
  });

  it('takes only the name the step asks for, capitals and spaces aside', () => {
    expect(step('name-q0').done(ctx(tut({ states: ['q_0'] })))).toBe(false);
    expect(step('name-q0').done(ctx(tut({ states: ['q_3'] })))).toBe(false);
    expect(step('name-q0').done(ctx(tut({ states: ['even'] })))).toBe(true);
    expect(step('name-q0').done(ctx(tut({ states: ['Even '] })))).toBe(true);
    expect(step('name-q0').done(ctx(tut({ states: ['evem'] })))).toBe(false);
    expect(step('name-q0').done(ctx(tut({ states: ['zero'] })))).toBe(false);
    expect(step('add-q1').done(ctx(tut({ states: ['even', 'q_0'], start: 'even' })))).toBe(false);
    expect(step('add-q1').done(ctx(tut({ states: ['even', 'odd'], start: 'even' })))).toBe(true);
    expect(step('add-q1').done(ctx(tut({ states: ['even', 'od'], start: 'even' })))).toBe(false);
  });

  it('flags a wrong name, but not a state still to be renamed', () => {
    expect(step('name-q0').hint(ctx(tut({ states: ['q_0'] })))).toBeNull();
    expect(hintText('name-q0', ctx(tut({ states: ['evem'] })))).toBe(
      '«evem» should be named `even`: double-click it to fix the name.',
    );
    expect(step('add-q1').hint(ctx(tut({ states: ['even', 'q_1'], start: 'even' })))).toBeNull();
    expect(hintText('add-q1', ctx(tut({ states: ['even', 'od'], start: 'even' })))).toBe(
      '«od» should be named `odd`: double-click it to fix the name.',
    );
  });

  it('goes back to the name step when a name is changed to a wrong one later', () => {
    const a = evenZeros();
    const typo = {
      ...a,
      states: a.states.map((s) => (s.id === 'even' ? { ...s, label: 'evem' } : s)),
    };
    expect(advance(idx('run-1010'), none, ctx(typo)).current).toBe(idx('name-q0'));
  });

  it('names the start state even when the second state came first', () => {
    const a = tut({ states: ['q_1', 'q_0'], start: 'q_0' });
    expect(step('name-q0').target(ctx(a))).toContain('data-state-id="q_0"');
    expect(step('add-q1').target(ctx(a))).toContain('data-state-id="q_1"');
  });

  it('compares edge symbols as exact sets', () => {
    const two = (edges: FixtureSpec['edges']): TutorialContext =>
      ctx(tut({ states: ['q_0', 'q_1'], start: 'q_0', edges }));
    expect(step('q0-q1').done(two([['q_0', '0', 'q_1']]))).toBe(true);
    expect(step('q0-q1').done(two([['q_0', '0,1', 'q_1']]))).toBe(false);
    expect(step('q1-q0').done(two([['q_1', '0', 'q_0']]))).toBe(true);
    expect(step('loop-q0').done(two([['q_0', '1', 'q_0']]))).toBe(true);
    expect(step('loop-q1').done(two([['q_0', '1', 'q_0']]))).toBe(false);
    expect(step('loop-q1').done(two([['q_1', '1', 'q_1']]))).toBe(true);
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
  });

  it('takes only `any` for the last rename, and flags another name', () => {
    const label = (l: string): TutorialContext =>
      ctx({ ...everything(), states: everything().states.map((s) => ({ ...s, label: l })) });
    expect(step('rename-q0').done(label('any'))).toBe(true);
    expect(step('rename-q0').done(label('Any'))).toBe(true);
    expect(step('rename-q0').done(label('all'))).toBe(false);
    expect(hintText('rename-q0', label('all'))).toBe(
      '«all» should be named `any`: double-click it to fix the name.',
    );
    expect(step('rename-q0').done(label('q_0'))).toBe(false);
    // Still part 1's name: not renamed yet, so no hint either.
    expect(step('rename-q0').done(label('even'))).toBe(false);
    expect(step('rename-q0').hint(label(' Even'))).toBeNull();
  });

  it('says what S and A do, one key per step', () => {
    const one = ctx(tut({ states: ['even'] }));
    expect(step('start').instruction(one)).toBe(
      'Click «even», then press [S] to make it the start state.',
    );
    expect(step('start').why(one)).toContain('arrow');
    expect(step('accepting').instruction(one)).toBe('Press [A] to make «even» accepting.');
    expect(step('accepting').why(one)).toContain('double ring');
  });

  it('asks to rename, not to type a name', () => {
    const a = evenZeros();
    expect(step('name-q0').instruction(ctx(tut({ states: ['q_0'] })))).toBe(
      'Double-click «q_0» and rename it `even`.',
    );
    expect(step('add-q1').instruction(ctx(a))).toBe('Add a second state and rename it `odd`.');
    expect(step('rename-q0').instruction(ctx(a))).toBe('Double-click «even» and rename it `any`.');
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

  it('stops at naming a state that still has its q-number', () => {
    const a = evenZeros();
    const unnamed = { ...a, states: a.states.map((s, i) => ({ ...s, label: `q_${i}` })) };
    expect(advance(0, none, ctx(unnamed)).current).toBe(idx('name-q0'));
  });

  it('falls back to a step that came undone, keeping the furthest point', () => {
    const a = { ...evenZeros(), starts: [] };
    const p = advance(idx('loop-q1'), none, ctx(a));
    expect(p.current).toBe(idx('start'));
    expect(p.progress).toBe(idx('loop-q1'));
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

  it('moves on to part 3 after the last run of part 2', () => {
    const b = { ...everything(), states: [{ ...everything().states[0]!, label: 'any' }] };
    const p = advance(idx('run-10-again'), none, ctx(b, ran(b, '10')));
    expect(p.current).toBe(idx('convert'));
    expect(p.progress).toBe(idx('convert'));
    expect(advance(p.progress, p.latched, ctx(nfa())).current).toBe(idx('convert'));
  });

  it('reaches the closing card after the minimization and stays there', () => {
    const latched: ReadonlySet<StepId> = new Set(['convert', 'convert-end', 'save-minimize']);
    const p = advance(idx('minimize-end'), latched, onDerived(showing(minimized)));
    expect(p).toMatchObject({ progress: idx('done'), current: idx('done') });
    expect(advance(p.progress, p.latched, ctx(nfa())).current).toBe(idx('done'));
  });

  it('never moves on while the tutorial automaton is not the active one', () => {
    const p = advance(0, none, ctx(evenZeros(), { isActive: false }));
    expect(p).toMatchObject({ progress: 0, current: 0 });
  });

  it('keeps the step it fell back to while another automaton is open', () => {
    const a = { ...evenZeros(), starts: [] };
    const p = advance(idx('loop-q1'), none, ctx(a, { isActive: false }), idx('start'));
    expect(p).toMatchObject({ progress: idx('loop-q1'), current: idx('start') });
  });
});

describe('hints', () => {
  it('says which automaton is open when it is not the tutorial one', () => {
    expect(step('loop-q1').hint(ctx(evenZeros(), { isActive: false }))).toEqual({
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
      text: 'First, click «q_0» to select it.',
    });
    expect(step('accepting').hint(ctx(a, { selected: ['q_0'] }))).toBeNull();
  });

  it('points out an extra state in part 1', () => {
    expect(hintText('q0-q1', ctx(tut({ states: ['q_0', 'q_1', 'q_2'], start: 'q_0' })))).toContain(
      'Delete the extra state «q_2»',
    );
  });

  it('points out an accepting q1', () => {
    const a = tut({ states: ['q_0', 'q_1'], start: 'q_0', accepting: ['q_0', 'q_1'] });
    expect(hintText('q0-q1', ctx(a))).toBe(
      'Only «q_0» should be accepting: click «q_1» and press [A].',
    );
  });

  it('points out that it became an NFA', () => {
    const a = { ...evenZeros(), kind: 'NFA' as const };
    expect(hintText('run-1010', ctx(a))).toContain('switch back to DFA');
  });

  it('points out wrong symbols on the edge being drawn', () => {
    const a = tut({ states: ['q_0', 'q_1'], start: 'q_0', edges: [['q_0', '0,1', 'q_1']] });
    expect(hintText('q0-q1', ctx(a))).toBe('«q_0» → «q_1» should read only `0`.');
  });

  it('points out wrong symbols on an arrow of a later step', () => {
    const a = tut({ states: ['q_0', 'q_1'], start: 'q_0', edges: [['q_1', '0', 'q_1']] });
    expect(hintText('q0-q1', ctx(a))).toBe('«q_1»’s loop should read only `1`.');
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
    expect(hintText('loop-01', ctx(b))).toBe('«q_0»’s loop should read only `0` and `1`.');
  });

  it('offers undo when every state is gone in part 2', () => {
    expect(hintText('delete-q1', ctx(tut({})))).toBe(
      'Press [Ctrl] + [Z] to bring the start state back.',
    );
  });

  it('names the state to delete instead when the start state was deleted', () => {
    const a = tut({ states: ['x_1'], edges: [['x_1', '1', 'x_1']] });
    expect(hintText('delete-q1', ctx(a))).toBe(
      'That was the start state: press [Ctrl] + [Z] to undo, then delete «x_1».',
    );
  });

  it('has no hint on a step going to plan', () => {
    expect(step('q0-q1').hint(ctx(tut({ states: ['q_0', 'q_1'], start: 'q_0' })))).toBeNull();
  });
});

describe('instructions and targets', () => {
  it('use the current labels', () => {
    const a = tut({ states: ['q_0', 'q_1'], start: 'q_0' });
    expect(step('q0-q1').instruction(ctx(a))).toContain('«q_0»');
    expect(step('q0-q1').instruction(ctx(a))).toContain('«q_1»');
    expect(step('loop-q0').instruction(ctx(evenZeros()))).toContain('«even»');
  });

  it('name every key to press, the symbol to type included', () => {
    const a = tut({ states: ['q_0', 'q_1'], start: 'q_0' });
    expect(step('q0-q1').instruction(ctx(a))).toContain(
      'Hold [Shift] and drag from «q_0» to «q_1», then type [0] and press [Enter]',
    );
    expect(step('run-10').instruction(ctx(a))).toContain('Press [Esc]');
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

  it('each loop step points at its own state', () => {
    const a = tut({ states: ['q_0', 'q_1'], start: 'q_0' });
    expect(step('loop-q0').target(ctx(a))).toBe(
      '[data-testid="canvas"] [data-state-id="q_0"] .av-state-body',
    );
    expect(step('loop-q1').target(ctx(a))).toBe(
      '[data-testid="canvas"] [data-state-id="q_1"] .av-state-body',
    );
  });
});

describe('part 3: convert and minimize', () => {
  const any = (): Automaton => ({
    ...everything(),
    states: [{ ...everything().states[0]!, label: 'any' }],
  });

  it('part 3 starts after part 2 with a hand-over', () => {
    const b = any();
    const c = ctx(b, ran(b, '10'));
    const p = advance(idx('run-10-again'), new Set<StepId>(['run-10-again']), c);
    expect(p.current).toBe(idx('convert'));
    expect(step('convert').hint(c)).toEqual({ kind: 'part-done', part: 2 });
  });

  it('convert latches when the tutorial’s conversion opens', () => {
    const p = advance(idx('convert'), none, ctx(nfa(), showing(converted, 0)));
    expect(p.latched.has('convert')).toBe(true);
    expect(p.current).toBe(idx('convert-end'));
    // Closing the walkthrough early keeps the conversion done: the card stays on "to the end".
    expect(advance(p.progress, p.latched, ctx(nfa())).current).toBe(idx('convert-end'));
  });

  it('convert-end latches at the last step', () => {
    const p = advance(idx('convert'), none, ctx(nfa(), showing(converted)));
    expect(p.latched.has('convert-end')).toBe(true);
    expect(p.current).toBe(idx('save-minimize'));
  });

  it('does not latch on a conversion of another automaton', () => {
    const other = subsetConstruction({ ...PART3_NFA, id: 'other' });
    expect(advance(idx('convert'), none, ctx(nfa(), showing(other, 0))).latched.size).toBe(0);
  });

  it('save-minimize latches on the minimization of the saved DFA', () => {
    const latched: ReadonlySet<StepId> = new Set(['convert', 'convert-end']);
    const p = advance(idx('save-minimize'), latched, onDerived(showing(minimized, 0)));
    expect(p.latched.has('save-minimize')).toBe(true);
    expect(p.current).toBe(idx('minimize-end'));
    const q = advance(p.progress, p.latched, onDerived(showing(minimized)));
    expect(q.current).toBe(idx('done'));
    expect(STEPS[q.current]!.part).toBe(4);
  });

  it('save-minimize does not latch on the minimization of another DFA', () => {
    const latched: ReadonlySet<StepId> = new Set(['convert', 'convert-end']);
    const other = minimize({ ...derived, id: 'other' });
    const p = advance(idx('save-minimize'), latched, onDerived(showing(other, 0)));
    expect(p.latched.has('save-minimize')).toBe(false);
  });

  it('part 3 never says elsewhere while its walkthrough is open', () => {
    const c = onDerived(showing(minimized, 0));
    expect(isPart3Trace(c)).toBe(true);
    expect(step('minimize-end').hint(c)).not.toEqual({ kind: 'elsewhere' });
    const latched: ReadonlySet<StepId> = new Set(['convert', 'convert-end', 'save-minimize']);
    expect(advance(idx('minimize-end'), latched, onDerived(showing(minimized))).current).toBe(
      idx('done'),
    );
    // Some other automaton open, no walkthrough: elsewhere.
    expect(step('minimize-end').hint(ctx(nfa(), { isActive: false }))).toEqual({
      kind: 'elsewhere',
    });
  });

  it('a walkthrough on screen is part 3’s only when it is of the tutorial’s automata', () => {
    expect(isPart3Trace(ctx(nfa(), showing(converted)))).toBe(true);
    expect(isPart3Trace(ctx(nfa(), showing(minimized)))).toBe(false);
    expect(isPart3Trace(ctx(nfa()))).toBe(false);
    expect(isPart3Trace(ctx(evenZeros(), ran(evenZeros(), '10')))).toBe(false);
  });

  it('asks to convert again when the walkthrough is closed early', () => {
    expect(step('convert-end').hint(ctx(nfa()))).toEqual({
      kind: 'first',
      text: 'First, press Convert to DFA again.',
    });
    expect(step('convert-end').hint(ctx(nfa(), showing(converted, 0)))).toBeNull();
    expect(step('minimize-end').hint(onDerived())).toEqual({
      kind: 'first',
      text: 'First, press Minimize again.',
    });
    expect(step('minimize-end').hint(onDerived(showing(minimized, 0)))).toBeNull();
  });

  it('asks for the conversion again before Save and minimize, and for the saved DFA', () => {
    expect(step('save-minimize').hint(ctx(nfa()))).toEqual({
      kind: 'first',
      text: 'First, press Convert to DFA again.',
    });
    expect(step('save-minimize').hint(ctx(nfa(), showing(converted)))).toBeNull();
    // Back on the NFA, which can't be minimized.
    expect(step('minimize-end').hint(ctx(nfa(), { derivedId: derived.id }))).toEqual({
      kind: 'first',
      text: 'First, open the DFA you saved and press Minimize.',
    });
  });

  it('asks for Minimize on the saved DFA when its minimization is closed before it opened', () => {
    expect(step('save-minimize').hint(onDerived())).toEqual({
      kind: 'first',
      text: 'First, press Minimize.',
    });
    expect(step('save-minimize').hint(onDerived(showing(minimized, 0)))).toBeNull();
  });

  it('only sends back to the saved DFA once there is one', () => {
    expect(step('minimize-end').hint(ctx(nfa()))).toBeNull();
  });

  it('a walkthrough of another automaton is elsewhere and moves nothing', () => {
    const other = subsetConstruction({ ...PART3_NFA, id: 'other' });
    const c = ctx(nfa(), { isActive: false, ...showing(other, 0) });
    expect(step('convert').hint(c)).toEqual({ kind: 'elsewhere' });
    expect(advance(idx('convert'), none, c)).toMatchObject({
      progress: idx('convert'),
      current: idx('convert'),
    });
    const latched: ReadonlySet<StepId> = new Set(['convert', 'convert-end']);
    const otherMin = minimize({ ...derived, id: 'other' });
    const d = ctx(nfa(), { isActive: false, derivedId: derived.id, ...showing(otherMin, 0) });
    expect(step('save-minimize').hint(d)).toEqual({ kind: 'elsewhere' });
    expect(advance(idx('save-minimize'), latched, d)).toMatchObject({
      progress: idx('save-minimize'),
      current: idx('save-minimize'),
      latched,
    });
  });

  it('keeps the closing card on the saved DFA', () => {
    expect(step('done').hint(onDerived())).toBeNull();
  });

  it('asks for the NFA back when part 2’s DFA is there instead (an undo)', () => {
    expect(step('convert').hint(ctx(any()))).toEqual({
      kind: 'first',
      text: 'First, press [Ctrl] + [Y] to bring the NFA back.',
    });
    // Not at the hand-over, while part 2's last run is still open.
    expect(step('convert').hint(ctx(any(), ran(any(), '10')))).toEqual({
      kind: 'part-done',
      part: 2,
    });
  });

  it('never asks to switch back to DFA, nor to press Esc first', () => {
    expect(step('convert').hint(ctx(nfa()))).toBeNull();
    expect(step('convert').hint(ctx(nfa(), ran(nfa(), '01')))).toBeNull();
  });

  it('points at Convert to DFA, the player and Save and minimize', () => {
    const c = ctx(nfa());
    expect(step('convert').target(c)).toBe('button[aria-label="Convert to DFA"]');
    expect(step('convert-end').target(c)).toBe('[data-testid="dock"]');
    expect(step('save-minimize').target(c)).toBe('[data-testid="save-and-minimize"]');
    expect(step('minimize-end').target(c)).toBe('[data-testid="dock"]');
  });

  it('the NFA’s subset DFA has 4 states and minimizes to 3', () => {
    const dfa = subsetConstruction(PART3_NFA).result;
    expect(dfa.states).toHaveLength(4);
    expect(minimize(dfa).result.states).toHaveLength(3);
  });
});
