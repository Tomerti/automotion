import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import { fixture } from '../../core/testing/fixtures';
import { Diagram } from './Diagram';
import { selfLoopGeometry } from './geometry';

const vp = { x: 0, y: 0, zoom: 1 };
const abDfa = fixture({
  kind: 'DFA',
  alphabet: 'ab',
  states: ['q0', 'q1'],
  start: 'q0',
  accepting: ['q1'],
  edges: [
    ['q0', 'a', 'q1'],
    ['q1', 'b', 'q0'],
    ['q1', 'ab', 'q1'],
  ],
});

afterEach(cleanup);

describe('Diagram', () => {
  it('keeps the start state self-loop off the start arrow', () => {
    const a = fixture({
      kind: 'DFA',
      alphabet: 'ab',
      states: ['q0', 'q1'],
      start: 'q0',
      edges: [
        ['q0', 'a', 'q0'],
        ['q0', 'b', 'q1'],
      ],
    });
    render(<Diagram automaton={a} viewport={vp} />);
    const d = screen.getByTestId('edge-q0-q0').querySelector('.av-edge-path')?.getAttribute('d');
    expect(d).toBe(selfLoopGeometry({ x: 0, y: 0 }, -Math.PI / 2).d);
  });

  it('shrinks long state labels to fit the circle', () => {
    const a = fixture({ kind: 'DFA', alphabet: 'a', states: ['{q0,q1,q2}', 'q1'] });
    render(<Diagram automaton={a} viewport={vp} />);
    const size = (id: string) =>
      parseFloat(
        (screen.getByTestId(id).querySelector('.av-state-label') as SVGTextElement).style.fontSize,
      );
    expect(size('state-{q0,q1,q2}')).toBeLessThan(15);
    expect(size('state-q1')).toBe(15);
  });

  it('sets subscripts as smaller, lowered tspans and raises the text after them back', () => {
    const a = fixture({ kind: 'DFA', alphabet: 'a', states: ['q_{12}x', 'p'] });
    render(<Diagram automaton={a} viewport={vp} />);
    // The test id keeps the raw label; the text reads as displayed.
    const label = screen.getByTestId('state-q_{12}x').querySelector('.av-state-label');
    expect(label).toHaveTextContent('q12x');
    const spans = Array.from(label?.querySelectorAll('tspan') ?? []);
    expect(spans.map((t) => t.textContent)).toEqual(['q', '12', 'x']);
    const [plain, sub, after] = spans;
    expect(plain).not.toHaveAttribute('dy');
    expect(sub).toHaveClass('av-state-label-sub');
    expect(sub).toHaveAttribute('font-size', '0.7em');
    const shift = Number(sub?.getAttribute('dy'));
    expect(shift).toBeGreaterThan(0);
    expect(Number(after?.getAttribute('dy'))).toBe(-shift);
    expect(after).not.toHaveAttribute('font-size');
    const plainLabel = screen.getByTestId('state-p').querySelector('.av-state-label');
    expect(plainLabel?.querySelectorAll('tspan')).toHaveLength(1);
  });

  it('hides the drawn label of the state or edge being edited in place', () => {
    render(<Diagram automaton={abDfa} viewport={vp} highlight={{ editing: 'q0->q1' }} />);
    expect(screen.getByTestId('edge-q0-q1')).toHaveAttribute('data-editing', 'true');
    expect(screen.getByTestId('edge-q1-q0')).not.toHaveAttribute('data-editing');
    expect(screen.getByTestId('state-q0')).not.toHaveAttribute('data-editing');
  });

  it('draws states, accepting rings, start arrow and edge labels', () => {
    render(<Diagram automaton={abDfa} viewport={vp} />);
    expect(screen.getByTestId('diagram')).toBeInTheDocument();
    expect(screen.getByTestId('state-q1')).toHaveAttribute('data-accepting', 'true');
    expect(screen.getByTestId('state-q0')).toHaveAttribute('data-accepting', 'false');
    expect(screen.getByTestId('state-q0')).toHaveAttribute('data-start', 'true');
    expect(screen.getByTestId('state-q0')).toHaveAttribute('data-state-id', 'q0');
    expect(screen.getByTestId('start-arrow')).toBeInTheDocument();
    expect(within(screen.getByTestId('edge-q1-q1')).getByTestId('edge-label')).toHaveTextContent(
      'a,b',
    );
    expect(screen.getByTestId('edge-q1-q1')).toHaveAttribute('data-transition-id', 'q1->q1');
  });

  it('applies the viewport as a group transform', () => {
    const { container } = render(
      <Diagram automaton={abDfa} viewport={{ x: 10, y: 20, zoom: 2 }} />,
    );
    expect(container.querySelector('g[transform="translate(10 20) scale(2)"]')).not.toBeNull();
  });

  it('shows epsilon as ε', () => {
    const nfa = fixture({
      kind: 'NFA',
      alphabet: 'a',
      states: ['p', 'r'],
      start: 'p',
      edges: [['p', 'a,ε', 'r']],
    });
    render(<Diagram automaton={nfa} viewport={vp} />);
    expect(within(screen.getByTestId('edge-p-r')).getByTestId('edge-label')).toHaveTextContent(
      'a,ε',
    );
  });

  it('marks active states and taken edges', () => {
    render(
      <Diagram automaton={abDfa} viewport={vp} highlight={{ active: ['q1'], taken: ['q0->q1'] }} />,
    );
    expect(screen.getByTestId('state-q1')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('state-q0')).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('edge-q0-q1')).toHaveAttribute('data-taken', 'true');
    expect(screen.getByTestId('edge-q1-q0')).toHaveAttribute('data-taken', 'false');
  });

  it('marks selected and error states and edges', () => {
    render(
      <Diagram
        automaton={abDfa}
        viewport={vp}
        highlight={{
          selectedStates: ['q0'],
          errorStates: ['q1'],
          selectedTransitions: ['q0->q1'],
          errorTransitions: ['q1->q0'],
        }}
      />,
    );
    expect(screen.getByTestId('state-q0')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('state-q1')).toHaveAttribute('data-error', 'true');
    expect(screen.getByTestId('edge-q0-q1')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('edge-q1-q0')).toHaveAttribute('data-error', 'true');
  });

  it('rings the states the issues popover points at, in the issue color', () => {
    render(
      <Diagram automaton={abDfa} viewport={vp} highlight={{ issueMarks: { q1: 'warning' } }} />,
    );
    const q1 = screen.getByTestId('state-q1');
    expect(q1).toHaveAttribute('data-issue', 'warning');
    expect(q1.querySelector('.av-state-issue')).not.toBeNull();
    const q0 = screen.getByTestId('state-q0');
    expect(q0).not.toHaveAttribute('data-issue');
    expect(q0.querySelector('.av-state-issue')).toBeNull();
  });

  it('hides states and edges outside visibleStates/visibleTransitions', () => {
    render(<Diagram automaton={abDfa} viewport={vp} highlight={{ visibleStates: ['q0'] }} />);
    expect(screen.getByTestId('state-q0')).toBeInTheDocument();
    expect(screen.queryByTestId('state-q1')).toBeNull();
    expect(screen.queryByTestId('edge-q0-q1')).toBeNull();
    expect(screen.queryByTestId('edge-q1-q1')).toBeNull();
    expect(screen.getByTestId('start-arrow')).toBeInTheDocument();
  });

  it('hides the start arrow when the start state is hidden', () => {
    render(<Diagram automaton={abDfa} viewport={vp} highlight={{ visibleStates: ['q1'] }} />);
    expect(screen.queryByTestId('start-arrow')).toBeNull();
  });

  it('hides edges outside visibleTransitions', () => {
    render(
      <Diagram automaton={abDfa} viewport={vp} highlight={{ visibleTransitions: ['q0->q1'] }} />,
    );
    expect(screen.getByTestId('edge-q0-q1')).toBeInTheDocument();
    expect(screen.queryByTestId('edge-q1-q0')).toBeNull();
  });

  it('applies tints and faded flags', () => {
    render(
      <Diagram automaton={abDfa} viewport={vp} highlight={{ tints: { q1: 2 }, faded: ['q0'] }} />,
    );
    expect(screen.getByTestId('state-q1')).toHaveAttribute('data-tint', '2');
    expect(screen.getByTestId('state-q0')).not.toHaveAttribute('data-tint');
    expect(screen.getByTestId('state-q0')).toHaveAttribute('data-faded', 'true');
    expect(screen.getByTestId('state-q1')).toHaveAttribute('data-faded', 'false');
  });

  it('embeds its stylesheet in the svg', () => {
    const { container } = render(<Diagram automaton={abDfa} viewport={vp} />);
    expect(container.querySelector('svg style')).not.toBeNull();
  });

  it('renders overlay children and forwards the svg ref', () => {
    let ref: SVGSVGElement | null = null;
    render(
      <Diagram
        automaton={abDfa}
        viewport={vp}
        svgRef={(el) => {
          ref = el;
        }}
      >
        <circle data-testid="overlay" r="1" />
      </Diagram>,
    );
    expect(screen.getByTestId('overlay')).toBeInTheDocument();
    expect(ref).toBe(screen.getByTestId('diagram'));
  });

  it('draws its text at its exact position, not hinted to whole pixels', () => {
    // With GPU raster, Chrome hinted a label's baseline to one pixel row on some repaints and the
    // next row on others: the q of every state hopped 1 px on each run step. jsdom can't render,
    // and Playwright's bundled headless Chromium doesn't hint that way, so this pins the rule.
    render(<Diagram automaton={abDfa} viewport={vp} />);
    const css = screen.getByTestId('diagram').querySelector('style')?.textContent ?? '';
    expect(css).toMatch(/\.av-diagram \{[^}]*text-rendering: geometricPrecision;/);
  });
});

describe('Diagram start arrows', () => {
  it('draws one start arrow per start state', () => {
    const n = fixture({ kind: 'NFA', alphabet: 'a', states: ['q0', 'q1'], starts: ['q0', 'q1'] });
    render(<Diagram automaton={n} viewport={vp} />);
    expect(
      screen.getAllByTestId('start-arrow').map((a) => a.getAttribute('data-state-id')),
    ).toEqual(['q0', 'q1']);
  });

  it('skips a start id with no state (Review Focus 5)', () => {
    const n = fixture({ kind: 'NFA', alphabet: 'a', states: ['q0'], starts: ['ghost'] });
    render(<Diagram automaton={n} viewport={vp} />);
    expect(screen.queryByTestId('start-arrow')).toBeNull();
    expect(screen.getByTestId('state-q0')).toHaveAttribute('data-start', 'false');
  });
});
