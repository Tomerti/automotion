import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canEliminate, eliminate, GNFA_ACCEPT, GNFA_START, MAX_REGEX_LENGTH } from './eliminate';
import { emptyAutomaton } from './model';
import { parseRegex } from './regex';
import { EMPTY } from './regexSimplify';
import { arbNfa } from './testing/arbitraries';
import { fixture } from './testing/fixtures';
import { accepts, regexToJs, wordsUpTo } from './testing/language';
import { traceSourceId } from './trace';

const endsInOne = fixture({
  kind: 'DFA',
  alphabet: '01',
  states: ['q0', 'q1'],
  start: 'q0',
  accepting: ['q1'],
  edges: [
    ['q0', '0', 'q0'],
    ['q0', '1', 'q1'],
    ['q1', '1', 'q1'],
    ['q1', '0', 'q0'],
  ],
});

/** Minimal complete DFA for a*b*: the dead state D is reached by `a` after a `b`. */
const aStarBStar = fixture({
  kind: 'DFA',
  alphabet: 'ab',
  states: ['A', 'B', 'D'],
  start: 'A',
  accepting: ['A', 'B'],
  edges: [
    ['A', 'a', 'A'],
    ['A', 'b', 'B'],
    ['B', 'b', 'B'],
    ['B', 'a', 'D'],
    ['D', 'a,b', 'D'],
  ],
});

/** `hub` has three arrows in and three out; the others have fewer. */
const hubbed = fixture({
  kind: 'NFA',
  alphabet: 'ab',
  states: ['a1', 'a2', 'hub', 'b1', 'b2'],
  start: 'a1',
  accepting: ['b2'],
  edges: [
    ['a1', 'a', 'a2'],
    ['a1', 'a', 'hub'],
    ['a2', 'a', 'hub'],
    ['hub', 'a', 'a1'],
    ['hub', 'b', 'b1'],
    ['hub', 'b', 'b2'],
    ['b1', 'a', 'b2'],
    ['b2', 'b', 'b1'],
  ],
});

describe('canEliminate', () => {
  it('refuses with reasons', () => {
    const noStart = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0'] });
    const withSymbol = fixture({
      kind: 'DFA',
      alphabet: '(',
      states: ['q0'],
      start: 'q0',
      edges: [['q0', '(', 'q0']],
    });
    const incompleteDfa = fixture({
      kind: 'DFA',
      alphabet: 'ab',
      states: ['q0', 'q1'],
      start: 'q0',
      edges: [['q0', 'a', 'q1']],
    });
    expect(canEliminate(emptyAutomaton('x', 'DFA'))).toBe('Nothing to convert: add a state first');
    expect(canEliminate(noStart)).toBe('Set a start state first');
    expect(canEliminate(withSymbol)).toBe("To regex can't write the symbol '(': rename it");
    expect(canEliminate(incompleteDfa)).toBeNull();
  });

  it('lets ε through', () => {
    const a = fixture({
      kind: 'NFA',
      alphabet: 'a',
      states: ['q0'],
      start: 'q0',
      edges: [['q0', 'ε', 'q0']],
    });
    expect(canEliminate(a)).toBeNull();
  });

  it('eliminate throws the reason when refused', () => {
    expect(() => eliminate(emptyAutomaton('x', 'DFA'))).toThrow(
      'Nothing to convert: add a state first',
    );
  });
});

describe('eliminate steps', () => {
  it('step shape: gnfa, then pick + remove per state, then done', () => {
    const t = eliminate(endsInOne);
    expect(t.steps.map((s) => s.phase)).toEqual([
      'gnfa',
      'pick',
      'remove',
      'pick',
      'remove',
      'done',
    ]);
    expect(
      t.steps[0]?.automaton.transitions.find((x) => x.from === 'q0' && x.to === 'q0')?.symbols,
    ).toEqual(['0']);
    expect(traceSourceId(t)).toBe(endsInOne.id);
    expect(t.steps.at(-1)?.regex).toBe(t.regex);
    // Pinned for readability: the automatic order and the simplifier keep it this short.
    expect(t.regex).toBe('0*1(1|00*1)*');
    expect(t.steps.at(-1)?.automaton.states.map((s) => s.id)).toEqual([GNFA_START, GNFA_ACCEPT]);
    expect(t.steps.at(-1)?.removed).toEqual(t.order);
    expect(t.steps[1]?.explanation).toMatch(/Click another state to remove it first instead\.$/);
    expect(t.steps[3]?.explanation).not.toMatch(/Click another state/);
  });

  it('gnfa: s into every start, every accepting into f, arrows joined with |', () => {
    const a = fixture({
      kind: 'NFA',
      alphabet: '01',
      states: ['q0', 'q1'],
      starts: ['q0', 'q1'],
      accepting: ['q1'],
      edges: [['q0', '0,1', 'q1']],
    });
    const g = eliminate(a).steps[0]!.automaton;
    const label = (from: string, to: string) =>
      g.transitions.find((t) => t.from === from && t.to === to)?.symbols;
    expect(label(GNFA_START, 'q0')).toEqual(['ε']);
    expect(label(GNFA_START, 'q1')).toEqual(['ε']);
    expect(label('q1', GNFA_ACCEPT)).toEqual(['ε']);
    expect(label('q0', 'q1')).toEqual(['0|1']);
    expect(g.transitions).toHaveLength(4);
    expect(g.starts).toEqual([GNFA_START]);
    expect(g.accepting).toEqual([GNFA_ACCEPT]);
    const s = g.states.find((x) => x.id === GNFA_START)!;
    const f = g.states.find((x) => x.id === GNFA_ACCEPT)!;
    for (const q of a.states) {
      const orig = g.states.find((x) => x.id === q.id)!;
      expect(orig).toMatchObject({ x: q.x, y: q.y });
      expect(s.x).toBeLessThan(q.x);
      expect(f.x).toBeGreaterThan(q.x);
    }
    expect(s.y).toBe(0);
    expect(f.y).toBe(0);
  });

  it("s and f labels don't clash", () => {
    const a = fixture({
      kind: 'DFA',
      alphabet: 'a',
      states: ['s', 'f', "s'"],
      start: 's',
      accepting: ['f'],
      edges: [['s', 'a', 'f']],
    });
    const g = eliminate(a).steps[0]!.automaton;
    const labelOf = (id: string) => g.states.find((x) => x.id === id)!.label;
    expect(labelOf(GNFA_START)).toBe("s''");
    expect(labelOf(GNFA_ACCEPT)).toBe("f'");
    const labels = g.states.map((x) => x.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('positions f at the mean height of all states when nothing accepts', () => {
    const a = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0', 'q1'], start: 'q0' });
    a.states[0]!.y = 10;
    a.states[1]!.y = 30;
    const g = eliminate(a).steps[0]!.automaton;
    expect(g.states.find((x) => x.id === GNFA_ACCEPT)!.y).toBe(20);
  });

  it('automatic order: fewest new arrows first', () => {
    const t = eliminate(hubbed);
    expect(t.order.indexOf('hub')).toBeGreaterThan(t.order.indexOf('a2'));
    expect(t.order.indexOf('hub')).toBeGreaterThan(t.order.indexOf('b1'));
  });

  it('order prefix keeps earlier steps and is respected', () => {
    const auto = eliminate(hubbed);
    const forced = eliminate(hubbed, [auto.order[0]!, auto.order[2]!]);
    expect(forced.order.slice(0, 2)).toEqual([auto.order[0], auto.order[2]]);
    expect(forced.order).toHaveLength(hubbed.states.length);
    expect(new Set(forced.order).size).toBe(hubbed.states.length);
    expect(forced.steps.slice(0, 3)).toEqual(auto.steps.slice(0, 3));
    expect(forced.steps.length).toBe(auto.steps.length);
  });

  it("keeps the student's bends on arrows the automaton had, none on new ones", () => {
    // p → q → r, plus p → r: removing q rewrites p → r (an old pair) and makes no new pair;
    // s → p and r → f are new.
    const a = fixture({
      kind: 'NFA',
      alphabet: 'abc',
      states: ['p', 'q', 'r'],
      start: 'p',
      accepting: ['r'],
      edges: [
        ['p', 'a', 'q'],
        ['q', 'b', 'r'],
        ['p', 'c', 'r'],
        ['q', 'a', 'q'],
      ],
    });
    const shaped = {
      ...a,
      transitions: a.transitions.map((t) =>
        t.id === 'p->r'
          ? { ...t, bend: 40, labelSide: 'right' as const }
          : t.id === 'q->q'
            ? { ...t, loopAngle: 1 }
            : t.id === 'p->q'
              ? { ...t, bend: -15 }
              : t,
      ),
    };
    const t = eliminate(shaped, ['q']);
    const arrow = (step: number, id: string) =>
      t.steps[step]?.automaton.transitions.find((x) => x.id === id);
    expect(arrow(0, 'p->r')).toMatchObject({ bend: 40, labelSide: 'right' });
    expect(arrow(0, 'p->q')).toMatchObject({ bend: -15 });
    expect(arrow(0, 'q->q')).toMatchObject({ loopAngle: 1 });
    for (const id of [`${GNFA_START}->p`, `r->${GNFA_ACCEPT}`]) {
      expect(Object.keys(arrow(0, id)!)).toEqual(['id', 'from', 'to', 'symbols']);
    }
    // After q goes, p → r has a new label but is still the student's arrow.
    expect(arrow(2, 'p->r')).toMatchObject({ symbols: ['c|aa*b'], bend: 40, labelSide: 'right' });

    // Steps before a diverging pick stay deep-equal with bends carried.
    const auto = eliminate(shaped);
    const other = auto.order[0] === 'p' ? 'q' : 'p';
    expect(eliminate(shaped, [other]).steps.slice(0, 1)).toEqual(auto.steps.slice(0, 1));
  });

  it('ignores unknown, duplicate and GNFA ids in the prefix', () => {
    const t = eliminate(endsInOne, ['nope', GNFA_START, 'q1', 'q1', GNFA_ACCEPT]);
    expect(t.order).toEqual(['q1', 'q0']);
  });

  it('remove marks the new arrows and shows formulas, capped at three', () => {
    const t = eliminate(hubbed, ['hub']);
    const remove = t.steps[2]!;
    expect(remove.phase).toBe('remove');
    expect(remove.removed).toEqual(['hub']);
    expect(remove.changed?.length).toBeGreaterThan(3);
    expect(remove.explanation).toMatch(/and \d+ more/);
    expect(remove.explanation.length).toBeLessThan(300);
    expect(remove.automaton.states.some((s) => s.id === 'hub')).toBe(false);
    expect(remove.focus.transitions).toEqual(remove.changed);
    const pick = t.steps[1]!;
    expect(pick.removing).toBe('hub');
    expect(pick.removed).toEqual([]);
  });

  it('no accepting state gives ∅; the empty word only gives ε', () => {
    const noAccepting = fixture({
      kind: 'DFA',
      alphabet: 'a',
      states: ['q0'],
      start: 'q0',
      edges: [['q0', 'a', 'q0']],
    });
    const onlyStartAccepting = fixture({
      kind: 'DFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      start: 'q0',
      accepting: ['q0'],
      edges: [['q0', 'a', 'q1']],
    });
    const none = eliminate(noAccepting);
    expect(none.regex).toBe('∅');
    expect(none.steps.at(-1)?.explanation).toMatch(/∅/);
    expect(eliminate(onlyStartAccepting).regex).toBe('ε');
  });
});

function shuffled(ids: string[], picks: Iterator<number>): string[] {
  const rest = [...ids];
  const out: string[] = [];
  while (rest.length > 0) {
    const n = picks.next().value as number;
    out.push(...rest.splice(n % rest.length, 1));
  }
  return out;
}

it('a*b* comes back as a*b*', () => {
  expect(eliminate(aStarBStar).regex).toBe('a*b*');
});

describe('eliminate language', () => {
  it("the regex has the automaton's language, in any order", () => {
    fc.assert(
      fc.property(
        arbNfa({ maxStates: 5, epsilon: true }),
        fc.infiniteStream(fc.nat()),
        (a, picks) => {
          for (const order of [
            undefined,
            shuffled(
              a.states.map((s) => s.id),
              picks,
            ),
          ]) {
            const r = eliminate(a, order).regex;
            const parsed = parseRegex(r);
            expect(parsed.ok).toBe(true);
            const js = regexToJs(parsed.ok ? parsed.regex : EMPTY);
            for (const w of wordsUpTo(['a', 'b'], 6)) expect(js.test(w)).toBe(accepts(a, w));
          }
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe('eliminate size limit', () => {
  it('stops past 2000 characters', () => {
    const ids = Array.from({ length: 9 }, (_, i) => `q${i}`);
    const edges: [string, string, string][] = [];
    ids.forEach((from, i) => {
      edges.push([from, 'a', ids[(i + 1) % 9]!]);
      edges.push([from, 'b', ids[(i * 2 + 1) % 9]!]);
      edges.push([from, 'c', ids[(i * 4 + 3) % 9]!]);
    });
    const dense = fixture({
      kind: 'DFA',
      alphabet: 'abc',
      states: ids,
      start: 'q0',
      accepting: ['q8'],
      edges,
    });
    expect(MAX_REGEX_LENGTH).toBe(2000);
    expect(() => eliminate(dense)).toThrow(
      'The regex grows past 2000 characters: try a smaller automaton',
    );
  });
});
