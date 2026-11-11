import { describe, expect, it } from 'vitest';
import { canMinimize } from '../../core/minimize';
import type { Automaton } from '../../core/model';
import { canConvert } from '../../core/subset';
import { fixture } from '../../core/testing/fixtures';
import { MAX_PARTS, RETIRE_AFTER, pickHint } from './hints';
import type { Hint, Learned } from './hints';

const parity = fixture({
  kind: 'DFA',
  alphabet: 'a',
  states: ['q0', 'q1'],
  start: 'q0',
  accepting: ['q1'],
  edges: [
    ['q0', 'a', 'q1'],
    ['q1', 'a', 'q0'],
  ],
});
const nfa = fixture({
  kind: 'NFA',
  alphabet: 'a',
  states: ['q0', 'q1'],
  start: 'q0',
  accepting: ['q1'],
  edges: [
    ['q0', 'a', 'q0'],
    ['q0', 'a', 'q1'],
  ],
});

function pick(a: Automaton, selected = 0, learned: Learned = {}): Hint | null {
  return pickHint({
    automaton: a,
    selected,
    learned,
    convertReason: canConvert(a),
    minimizeReason: canMinimize(a),
  });
}

const learns = (h: Hint | null): string[] => h?.parts.map((p) => p.learn) ?? [];

describe('pickHint', () => {
  it('says nothing for an empty automaton (the canvas has its own hint)', () => {
    expect(pick(fixture({ kind: 'DFA', alphabet: '', states: [] }))).toBeNull();
  });

  it('teaches Shift + drag while there are states but no transitions', () => {
    const h = pick(fixture({ kind: 'DFA', alphabet: '', states: ['q0', 'q1'] }));
    expect(h?.id).toBe('connect');
    expect(learns(h)).toEqual(['transition']);
  });

  it('asks for a start state, then an accepting state, once there are transitions', () => {
    const noStart = { ...parity, starts: [] };
    expect(pick(noStart)?.id).toBe('set-start');
    const noAccepting = { ...parity, accepting: [] };
    expect(pick(noAccepting)?.id).toBe('set-accepting');
  });

  it('suggests Convert to DFA for a valid NFA and Minimize for a valid DFA', () => {
    const c = pick(nfa);
    expect(c?.id).toBe('convert');
    expect(c?.parts[0]).toMatchObject({ kind: 'action', label: 'Convert to DFA', run: 'convert' });
    const m = pick(parity);
    expect(m?.id).toBe('minimize');
    expect(m?.parts[0]).toMatchObject({ kind: 'action', label: 'Minimize', run: 'minimize' });
  });

  it('suggests no walkthrough the automaton cannot take', () => {
    // An NFA with an error (no start) asks for the start instead; a one-state DFA isn't worth minimizing.
    const lone = fixture({
      kind: 'DFA',
      alphabet: 'a',
      states: ['q0'],
      start: 'q0',
      accepting: ['q0'],
      edges: [['q0', 'a', 'q0']],
    });
    expect(pick(lone)).toBeNull();
  });

  it('shows what a selected state can do, at most MAX_PARTS at a time', () => {
    const h = pick(parity, 1);
    expect(h?.id).toBe('one-selected');
    expect(learns(h)).toEqual(['start', 'accept', 'multi']);
    expect(h?.parts.length).toBeLessThanOrEqual(MAX_PARTS);
    // The × retires the whole situation, the parts not shown yet included.
    expect(h?.teaches).toEqual(['start', 'accept', 'multi', 'copy', 'menu']);
  });

  it('drops learned parts and brings in the next ones', () => {
    const h = pick(parity, 1, { start: RETIRE_AFTER, accept: RETIRE_AFTER });
    expect(learns(h)).toEqual(['multi', 'copy', 'menu']);
    expect(learns(pick(parity, 1, { start: RETIRE_AFTER - 1 }))[0]).toBe('start');
  });

  it('leaves out Ctrl + click with a single state (nothing else to select)', () => {
    const one = fixture({ kind: 'DFA', alphabet: '', states: ['q0'] });
    expect(learns(pick(one, 1, { start: 3, accept: 3 }))).toEqual(['copy', 'menu']);
  });

  it('shows what a multi-selection can do', () => {
    const h = pick(parity, 2);
    expect(h?.id).toBe('many-selected');
    expect(learns(h)).toEqual(['group', 'copy', 'delete']);
  });

  it('goes quiet once everything has been learned', () => {
    const all: Learned = {
      start: 3,
      accept: 3,
      multi: 3,
      copy: 3,
      menu: 3,
      group: 3,
      delete: 3,
      transition: 3,
      convert: 3,
      minimize: 3,
    };
    expect(pick(parity, 0, all)).toBeNull();
    expect(pick(parity, 1, all)).toBeNull();
    expect(pick(parity, 2, all)).toBeNull();
    expect(pick(nfa, 0, all)).toBeNull();
  });
});
