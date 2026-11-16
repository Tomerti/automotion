import { describe, expect, it } from 'vitest';
import { minimize } from '../../../core/minimize';
import { subsetConstruction } from '../../../core/subset';
import type { Automaton } from '../../../core/model';
import type { MinimizeTrace } from '../../../core/trace';
import { advance, countedSteps, lessonSteps, pacingStep } from '../engine';
import type { TutorialContext } from '../engine';
import { CONTAINS_01 } from './convert';
import { MINIMIZE_LESSON } from './minimize';

const L = MINIMIZE_LESSON;
const steps = lessonSteps(L);
const start = L.start as Automaton;
const trace = minimize(start);
const firstSplit = trace.steps.findIndex((s) => s.phase === 'split');
const last = trace.steps.length - 1;

function ctx(t: MinimizeTrace | null, stepIndex = 0, more: Partial<TutorialContext> = {}) {
  return {
    automaton: start,
    isActive: true,
    trace: t,
    stepIndex,
    selected: [],
    owned: [start.id],
    actions: new Set(),
    ...more,
  } satisfies TutorialContext;
}

const SAVED = { owned: [start.id, 'saved-min'] };
const idea = new Set(['minimize/idea']);

/** Structure by labels, since the subset construction's ids are fresh on every call. */
function byLabels(a: Automaton) {
  const label = (id: string) => a.states.find((s) => s.id === id)!.label;
  return {
    states: a.states.map((s) => s.label),
    starts: a.starts.map(label),
    accepting: a.accepting.map(label),
    edges: a.transitions.map((t) => [label(t.from), label(t.to), ...t.symbols].join(' ')),
  };
}

describe('the Minimize a DFA lesson', () => {
  it('opens on the DFA the subset construction builds from Contains 01', () => {
    expect(start.kind).toBe('DFA');
    expect(byLabels(start)).toEqual(byLabels(subsetConstruction(CONTAINS_01).result));
  });

  it('minimizes with one split, to three states', () => {
    expect(trace.alreadyMinimal).toBe(false);
    expect(trace.steps.filter((s) => s.phase === 'split')).toHaveLength(1);
    expect(trace.result.states).toHaveLength(3);
  });

  it('has a goal with no examples and no picture, and five counted steps', () => {
    const goal = L.parts[0]!.goal;
    expect(goal.text).toBe('Make this DFA as small as possible');
    expect(goal.examples).toEqual([]);
    expect(goal.automaton).toBeUndefined();
    expect(steps.map((s) => s.id)).toEqual([
      'minimize/idea',
      'minimize/open',
      'minimize/groups',
      'minimize/split',
      'minimize/save',
      'done',
    ]);
    expect(countedSteps(L)).toBe(5);
    expect(steps.some((s) => s.why(ctx(null)) !== null)).toBe(false);
  });

  it('splits {q_0} from {q_0,q_1} on a 1, as the explanation says', () => {
    expect(firstSplit).toBe(1);
    expect(last).toBe(2);
    const split = trace.steps[firstSplit]!.split!;
    const label = (id: string) => start.states.find((s) => s.id === id)!.label;
    expect([label(split.witness.p), label(split.witness.q)].sort()).toEqual(['{q_0,q_1}', '{q_0}']);
    expect(split.witness.symbol).toBe('1');
    expect(trace.steps[0]!.phase).toBe('partition');
    expect(trace.steps[0]!.blocks.map((b) => b.length)).toEqual([2, 2]);
  });

  it('opens with the idea step, which only Next moves past', () => {
    expect(steps[0]!.idea).toBe(true);
    expect(steps[0]!.instruction(ctx(null))).toBe(
      'Two states are the same if no word can tell them apart: from both, every word is accepted or rejected alike. Minimizing merges such states.',
    );
    expect(advance(L, 0, new Set(), ctx(trace, 0)).current).toBe(0);
    expect(advance(L, 0, idea, ctx(null)).current).toBe(1);
  });

  it('walks from the idea, to Minimize, to the split, to the end, to saving', () => {
    const first = advance(L, 0, idea, ctx(null));
    expect(first.current).toBe(1);
    const opened = advance(L, first.progress, first.latched, ctx(trace, 0));
    expect(opened.current).toBe(2);
    const split = advance(L, opened.progress, opened.latched, ctx(trace, firstSplit));
    expect(split.current).toBe(3);
    const end = advance(L, split.progress, split.latched, ctx(trace, last));
    expect(end.current).toBe(4);
    const saved = advance(L, end.progress, end.latched, ctx(null, 0, SAVED));
    expect(steps[saved.current]!.id).toBe('done');
  });

  it('lands on the groups step when the walkthrough was opened during the idea step', () => {
    const at0 = { progress: 0, current: 0, latched: new Set<string>() };
    expect(pacingStep(L, at0, ctx(trace, 0))!.id).toBe('minimize/groups');
    expect(advance(L, 0, idea, ctx(trace, 0), 0).current).toBe(2);
    expect(steps[2]!.id).toBe('minimize/groups');
  });

  it('follows the walkthrough back with ←', () => {
    const upToSave = new Set(steps.slice(0, 4).map((s) => s.id));
    expect(steps[advance(L, 4, upToSave, ctx(trace, last), 4).current]!.id).toBe('minimize/save');
    expect(steps[advance(L, 4, upToSave, ctx(trace, firstSplit), 4).current]!.id).toBe(
      'minimize/split',
    );
    expect(steps[advance(L, 4, upToSave, ctx(trace, 0), 4).current]!.id).toBe('minimize/groups');
    expect(advance(L, 4, upToSave, ctx(null), 4).current).toBe(4);
  });

  it('asks to press Minimize again once the walkthrough is closed, without losing steps', () => {
    const p = advance(L, 0, idea, ctx(trace, 0));
    const split = advance(L, p.progress, p.latched, ctx(trace, firstSplit));
    expect(split.current).toBe(3);
    const closed = advance(L, split.progress, split.latched, ctx(null));
    expect(closed.current).toBe(3);
    for (const id of ['minimize/open', 'minimize/groups']) {
      expect(closed.latched.has(id), id).toBe(true);
    }
    const again = { kind: 'first', text: 'First, press Minimize again.' };
    for (const i of [2, 3, 4]) expect(steps[i]!.hint(ctx(null))).toEqual(again);
    expect(steps[3]!.hint(ctx(trace, 0))).toBeNull();
  });

  it('stops asking for Minimize on the save step once a DFA is saved', () => {
    expect(steps[4]!.hint(ctx(null, 0, SAVED))).toBeNull();
    expect(steps[4]!.hint(ctx(null))).not.toBeNull();
  });

  it('pauses playback where the block splits', () => {
    expect(steps[2]!.pauseAt!(ctx(trace, 0))).toBe(firstSplit);
    expect(steps[2]!.pauseAt!(ctx(null))).toBeNull();
    // The split card stops at the split while it is ahead, then runs to the end.
    expect(steps[3]!.pauseAt!(ctx(trace, 0))).toBe(firstSplit);
    expect(steps[3]!.pauseAt!(ctx(trace, firstSplit))).toBeNull();
    expect(steps[3]!.pauseAt!(ctx(null))).toBeNull();
    for (const i of [0, 1, 4]) expect(steps[i]!.pauseAt, String(i)).toBeUndefined();
  });

  it('explains each moment, with the instruction a plain press', () => {
    expect(steps[1]!.instruction(ctx(null))).toBe('Press Minimize at the top.');
    // Each moment is one step from the last: stepped by hand, like the NFA lessons.
    expect(steps[2]!.instruction(ctx(null))).toBe('Press [→] to see which group splits.');
    expect(steps[2]!.explain(ctx(null))).toBe(
      'It starts with two groups, accepting and not: the empty word already tells those apart.',
    );
    expect(steps[3]!.instruction(ctx(null))).toBe('Press [→] to see what merges.');
    expect(steps[3]!.explain(ctx(null))).toBe(
      'On `1`, «{q_0}» stays out of accepting but «{q_0,q_1}» gets in, so they split.',
    );
    expect(steps[4]!.instruction(ctx(null))).toBe(
      'Press Save as new automaton to keep the smaller DFA.',
    );
    expect(steps[4]!.explain(ctx(null))).toBe(
      'No symbol tells «{q_0,q_2}» and «{q_0,q_1,q_2}» apart, so they merge.',
    );
  });

  it('ignores a walkthrough of an automaton it does not own', () => {
    const other = minimize({ ...start, id: 'someone-else' });
    expect(advance(L, 0, idea, ctx(other, 0)).current).toBe(1);
  });

  it('points at the Minimize button, nothing while playing, then the save button', () => {
    expect(steps[0]!.target(ctx(null))).toBeNull();
    expect(steps[1]!.target(ctx(null))).toBe('button[aria-label="Minimize"]');
    for (const i of [2, 3]) expect(steps[i]!.target(ctx(null))).toBeNull();
    expect(steps[4]!.target(ctx(null))).toBe('[data-testid="save-trace-result"]');
  });

  it('asks to step to the end on the save step while the reopened walkthrough is short of it', () => {
    const text = 'First, press [→] until the last step.';
    expect(steps[4]!.hint(ctx(trace, 0))).toEqual({ kind: 'first', text });
    expect(steps[4]!.hint(ctx(trace, last))).toBeNull();
    expect(steps[4]!.hint(ctx(trace, 0, SAVED))).toBeNull();
  });
});
