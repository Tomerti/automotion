import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import { fixture } from '../../core/testing/fixtures';
import { Diagram } from './Diagram';

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
});
