import { describe, expect, it } from 'vitest';
import { minimize } from '../../../core/minimize';
import { runWord } from '../../../core/run';
import { subsetConstruction } from '../../../core/subset';
import type { Automaton } from '../../../core/model';
import type { MinimizeTrace } from '../../../core/trace';
import { advance, countedSteps, lessonSteps } from '../engine';
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

  it('holds its goal examples on both pictures', () => {
    const goal = L.parts[0]!.goal;
    for (const e of goal.examples) {
      expect(runWord(goal.automaton, e.word).accepted, e.word).toBe(e.accepted);
      expect(runWord(goal.after!.automaton, e.word).accepted, e.word).toBe(e.accepted);
    }
    expect(goal.after!.automaton.states).toHaveLength(3);
  });

  it('stays within six counted steps', () => {
    expect(countedSteps(L)).toBeLessThanOrEqual(6);
  });

  it('splits {q_0} from {q_0,q_1} on a 1, as the why line says', () => {
    const split = trace.steps[firstSplit]!.split!;
    const label = (id: string) => start.states.find((s) => s.id === id)!.label;
    expect([label(split.witness.p), label(split.witness.q)].sort()).toEqual(['{q_0,q_1}', '{q_0}']);
    expect(split.witness.symbol).toBe('1');
  });

  it('walks from Minimize, to a split, to the end, to saving', () => {
    expect(advance(L, 0, new Set(), ctx(null)).current).toBe(0);
    const opened = advance(L, 0, new Set(), ctx(trace, 0));
    expect(opened.current).toBe(1);
    const early = advance(L, opened.progress, opened.latched, ctx(trace, firstSplit - 1));
    expect(early.current).toBe(1);
    const split = advance(L, opened.progress, opened.latched, ctx(trace, firstSplit));
    expect(split.current).toBe(2);
    const end = advance(L, split.progress, split.latched, ctx(trace, last));
    expect(end.current).toBe(3);
    const saved = advance(L, end.progress, end.latched, ctx(null, 0, SAVED));
    expect(steps[saved.current]!.id).toBe('done');
  });

  it('asks to press Minimize again once the walkthrough is closed, without losing steps', () => {
    const opened = advance(L, 0, new Set(), ctx(trace, 0));
    const split = advance(L, opened.progress, opened.latched, ctx(trace, firstSplit));
    expect(split.current).toBe(2);
    const closed = advance(L, split.progress, split.latched, ctx(null));
    expect(closed.current).toBe(2);
    for (const id of ['minimize/open', 'minimize/split']) {
      expect(closed.latched.has(id), id).toBe(true);
    }
    const again = { kind: 'first', text: 'First, press Minimize again.' };
    for (const i of [1, 2, 3]) expect(steps[i]!.hint(ctx(null))).toEqual(again);
    expect(steps[2]!.hint(ctx(trace, 0))).toBeNull();
  });

  it('stops asking for Minimize on the save step once a DFA is saved', () => {
    expect(steps[3]!.hint(ctx(null, 0, SAVED))).toBeNull();
    expect(steps[3]!.hint(ctx(null))).not.toBeNull();
  });

  it('ignores a walkthrough of an automaton it does not own', () => {
    const other = minimize({ ...start, id: 'someone-else' });
    expect(advance(L, 0, new Set(), ctx(other, 0)).current).toBe(0);
  });

  it('points at the Minimize button, the explanation, then the dock', () => {
    expect(steps[0]!.target(ctx(null))).toBe('button[aria-label="Minimize"]');
    expect(steps[1]!.target(ctx(null))).toBe('.av-player-explanation');
    expect(steps[2]!.target(ctx(null))).toBe('[data-testid="dock"]');
  });
});
