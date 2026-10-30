import { cleanup, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from '../../core/testing/fixtures';
import { Diagram } from './Diagram';
import { diagramToSvgString } from './exportDiagram';

const abDfa = fixture({
  kind: 'DFA',
  alphabet: 'ab',
  states: ['q0', 'q1'],
  start: 'q0',
  accepting: ['q1'],
  edges: [
    ['q0', 'a', 'q1'],
    ['q1', 'b', 'q0'],
  ],
});

function renderSvg(): SVGSVGElement {
  const { getByTestId } = render(
    createElement(Diagram, {
      automaton: abDfa,
      viewport: { x: 50, y: 70, zoom: 2 },
      highlight: {
        selectedStates: ['q0'],
        selectedTransitions: ['q0->q1'],
        editing: 'q1',
      },
      children: [
        createElement('line', { key: 'band', 'data-testid': 'rubber-band' }),
        createElement('line', { key: 'guide', 'data-testid': 'snap-guide' }),
      ],
    }),
  );
  return getByTestId('diagram') as unknown as SVGSVGElement;
}

afterEach(cleanup);

describe('diagramToSvgString', () => {
  it('is standalone with a fitted viewBox', () => {
    const text = diagramToSvgString(renderSvg(), abDfa);
    expect(text).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(text).toMatch(/viewBox="-?\d/);
    expect(text).toContain('<style');
  });

  it('computes the viewBox from state positions plus padding', () => {
    const xs = abDfa.states.map((s) => s.x);
    const ys = abDfa.states.map((s) => s.y);
    const r = 24 + 28 + 32;
    const x = Math.min(...xs) - r;
    const y = Math.min(...ys) - r;
    const w = Math.max(...xs) + r - x;
    const h = Math.max(...ys) + r - y;
    const text = diagramToSvgString(renderSvg(), abDfa);
    expect(text).toContain(`viewBox="${x} ${y} ${w} ${h}"`);
    expect(text).toContain(`width="${w}"`);
    expect(text).toContain(`height="${h}"`);
  });

  it('resets the viewport transform', () => {
    const text = diagramToSvgString(renderSvg(), abDfa);
    expect(text).not.toContain('scale(2)');
    expect(text).toContain('translate(0 0) scale(1)');
  });

  it('resolves custom properties to fallbacks or computed values', () => {
    document.documentElement.style.setProperty('--av-state-stroke', '#abcdef');
    const text = diagramToSvgString(renderSvg(), abDfa);
    document.documentElement.style.removeProperty('--av-state-stroke');
    expect(text).not.toContain('var(--');
    expect(text).toContain('#abcdef');
    // A fallback of a variable nothing sets here (the first block tint).
    expect(text).toContain('#c9dbff');
  });

  it('drops interaction-only elements and selection highlights', () => {
    const text = diagramToSvgString(renderSvg(), abDfa);
    expect(text).not.toContain('rubber-band"');
    expect(text).not.toContain('snap-guide"');
    expect(text).not.toMatch(/<g [^>]*data-editing=/);
    expect(text).not.toContain('class="av-state-hit"');
    expect(text).not.toContain('class="av-edge-hit"');
    // The stylesheet legitimately mentions the selector; no element may carry it.
    expect(text).not.toMatch(/<g [^>]*data-selected="true"/);
    expect(text).toContain('data-selected="false"');
  });

  it('keeps subscript tspans in state labels', () => {
    const a = fixture({ kind: 'DFA', alphabet: 'a', states: ['q_1'] });
    const { getByTestId } = render(
      createElement(Diagram, { automaton: a, viewport: { x: 0, y: 0, zoom: 1 } }),
    );
    const text = diagramToSvgString(getByTestId('diagram') as unknown as SVGSVGElement, a);
    expect(text).toMatch(/<tspan[^>]*>q<\/tspan><tspan[^>]*font-size="0.7em"[^>]*>1<\/tspan>/);
  });

  it('does not modify the live svg', () => {
    const svg = renderSvg();
    diagramToSvgString(svg, abDfa);
    expect(svg.querySelector('g')?.getAttribute('transform')).toBe('translate(50 70) scale(2)');
    expect(svg.querySelector('.av-state-hit')).not.toBeNull();
  });
});
