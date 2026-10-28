import { describe, expect, it } from 'vitest';
import { chooseSplitLayout } from './splitLayout';

const chain = (n: number, dir: 'x' | 'y') =>
  Array.from({ length: n }, (_, i) => (dir === 'x' ? { x: 100 * i, y: 0 } : { x: 0, y: 100 * i }));

const wideShort = { width: 1200, height: 400 };

describe('chooseSplitLayout', () => {
  it('stacks two wide horizontal chains in a wide, short container', () => {
    expect(chooseSplitLayout(chain(6, 'x'), chain(6, 'x'), wideShort)).toBe('column');
  });

  it('puts two tall vertical chains side by side', () => {
    expect(chooseSplitLayout(chain(6, 'y'), chain(6, 'y'), wideShort)).toBe('row');
  });

  it('judges by the smaller of the two pane zooms', () => {
    // A tall NFA and a wide DFA: stacking would crush the NFA, so stay side by side.
    expect(chooseSplitLayout(chain(6, 'y'), chain(6, 'x'), wideShort)).toBe('row');
  });

  it('keeps the side-by-side default on a tie', () => {
    expect(chooseSplitLayout([{ x: 0, y: 0 }], [{ x: 0, y: 0 }], wideShort)).toBe('row');
  });
});
