import { describe, expect, it } from 'vitest';
import { fixture } from '../core/testing/fixtures';
import type { Automaton } from '../core/model';
import { decodeShare, encodeShare, readShareHash, sameAutomaton, shareUrl } from './shareLink';

async function deflate(text: string): Promise<string> {
  const stream = new Response(text).body!.pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function wrap(a: unknown): string {
  return JSON.stringify({ format: 'automotion', version: 2, automata: [a] });
}

describe('share link', () => {
  it('round-trips a DFA', async () => {
    const a = fixture({
      kind: 'DFA',
      alphabet: 'ab',
      states: ['q0', 'q1'],
      start: 'q0',
      accepting: ['q1'],
      edges: [
        ['q0', 'a', 'q1'],
        ['q0', 'b', 'q0'],
        ['q1', 'a,b', 'q0'],
      ],
    });
    const r = await decodeShare(await encodeShare(a), new Set());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.automata).toHaveLength(1);
    expect(sameAutomaton(r.automata[0]!, a)).toBe(true);
  });

  it('round-trips an NFA with ε, several starts, bends, loop angles, label sides and subscripts', async () => {
    const a = fixture({
      kind: 'NFA',
      alphabet: 'ab',
      states: ['q_0', 'q_1', 'q_{12}', 'ünï'],
      starts: ['q_0', 'q_1'],
      accepting: ['ünï'],
      edges: [
        ['q_0', 'a,ε', 'q_1'],
        ['q_1', 'b', 'q_{12}'],
        ['q_{12}', 'a', 'q_{12}'],
        ['q_{12}', 'b', 'ünï'],
      ],
    });
    a.transitions[0]!.bend = 30;
    a.transitions[0]!.labelSide = 'right';
    a.transitions[2]!.loopAngle = 1.2;
    a.states[0]!.startAngle = 0.5;
    const r = await decodeShare(await encodeShare(a), new Set());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(sameAutomaton(r.automata[0]!, a)).toBe(true);
    expect(r.automata[0]!.transitions[0]!.bend).toBe(30);
  });

  it('round-trips a 64-state automaton', async () => {
    const names = Array.from({ length: 64 }, (_, i) => `s${i}`);
    const a = fixture({
      kind: 'DFA',
      alphabet: 'a',
      states: names,
      start: 's0',
      accepting: ['s63'],
      edges: names.map((n, i): [string, string, string] => [n, 'a', names[(i + 1) % 64]!]),
    });
    const payload = await encodeShare(a);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    const r = await decodeShare(payload, new Set());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(sameAutomaton(r.automata[0]!, a)).toBe(true);
  });

  it('drops the id and rounds positions', async () => {
    const a: Automaton = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0'], start: 'q0' });
    a.states[0]!.x = 10.6;
    const r = await decodeShare(await encodeShare(a), new Set([a.id]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.automata[0]!.states[0]!.x).toBe(11);
    expect(r.automata[0]!.id).not.toBe(a.id);
  });

  it('rejects corrupt payloads', async () => {
    const good = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0'], start: 'q0' });
    const rest: Partial<Automaton> = { ...good };
    delete rest.id;
    const dangling = {
      ...rest,
      transitions: [{ id: 't', from: 'q0', to: 'nope', symbols: ['a'] }],
    };
    for (const p of [
      '!!!',
      'aGVsbG8',
      await deflate('not json'),
      await deflate('{"format":"other"}'),
      await deflate(wrap(dangling)),
    ]) {
      const r = await decodeShare(p, new Set());
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).not.toBe('');
    }
  });

  it('reads the hash', () => {
    expect(readShareHash('#a=abc')).toBe('abc');
    expect(readShareHash('#a=')).toBeNull();
    expect(readShareHash('#b=abc')).toBeNull();
    expect(readShareHash('')).toBeNull();
  });

  it('builds the url', async () => {
    const a = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0'], start: 'q0' });
    expect(await shareUrl(a, 'https://x.test/p/')).toMatch(
      /^https:\/\/x\.test\/p\/#a=[A-Za-z0-9_-]+$/,
    );
  });

  it('sameAutomaton ignores ids only', () => {
    const a = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0'], start: 'q0' });
    expect(sameAutomaton(a, { ...a, id: 'other' })).toBe(true);
    expect(sameAutomaton(a, { ...a, states: [{ ...a.states[0]!, label: 'z' }] })).toBe(false);
  });
});
