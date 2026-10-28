import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runWord } from '../../core/run';
import { fixture } from '../../core/testing/fixtures';
import type { RunTrace } from '../../core/trace';
import { RunTraceView } from './RunTraceView';
import { playRunSound } from './sound';

vi.mock('./sound', () => ({ playRunSound: vi.fn(), playVerdictSound: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.mocked(playRunSound).mockClear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const parity = fixture({
  kind: 'DFA',
  alphabet: 'ab',
  states: ['q_0', 'q_1'],
  start: 'q_0',
  accepting: ['q_1'],
  edges: [
    ['q_0', 'a', 'q_1'],
    ['q_1', 'a', 'q_0'],
    ['q_0', 'b', 'q_0'],
  ],
});

const endsInA = fixture({
  kind: 'NFA',
  alphabet: 'ab',
  states: ['q0', 'q1'],
  start: 'q0',
  accepting: ['q1'],
  edges: [
    ['q0', 'a,b', 'q0'],
    ['q0', 'a', 'q1'],
  ],
});

const cells = (): (string | null)[] =>
  screen.getAllByTestId('word-char').map((c) => c.getAttribute('data-state'));
const tokensOn = (): (string | null)[] =>
  screen.queryAllByTestId('run-token').map((t) => t.getAttribute('data-state-id'));
const activeStates = (): (string | null)[] =>
  [...document.querySelectorAll('[data-active="true"]')].map((s) =>
    s.getAttribute('data-state-id'),
  );

function show(trace: RunTrace, stepIndex: number): ReturnType<typeof render> {
  return render(<RunTraceView trace={trace} stepIndex={stepIndex} />);
}
const lastIndex = (t: RunTrace): number => t.steps.length - 1;

describe('RunTraceView tape', () => {
  it('shows one cell per symbol with consumed/current/pending states and a read head', () => {
    const trace = runWord(parity, 'baa');
    const { rerender } = show(trace, 0);
    expect(cells()).toEqual(['pending', 'pending', 'pending']);
    expect(screen.getByTestId('read-head')).toHaveAttribute('data-waiting', 'true');
    rerender(<RunTraceView trace={trace} stepIndex={2} />);
    expect(cells()).toEqual(['consumed', 'current', 'pending']);
    expect(screen.getByTestId('read-head')).not.toHaveAttribute('data-waiting');
    expect(screen.getByTestId('read-head').style.getPropertyValue('--av-head')).toBe('1');
    rerender(<RunTraceView trace={trace} stepIndex={lastIndex(trace)} />);
    expect(cells()).toEqual(['consumed', 'consumed', 'consumed']);
    expect(screen.queryByTestId('read-head')).toBeNull();
  });

  it('shows ε for the empty word', () => {
    show(runWord(parity, ''), 0);
    expect(screen.queryAllByTestId('word-char')).toHaveLength(0);
    expect(screen.getByText('ε')).toBeInTheDocument();
  });

  it('a stuck step marks the unreadable cell', () => {
    const trace = runWord(parity, 'ab');
    show(trace, lastIndex(trace));
    const [, b] = screen.getAllByTestId('word-char');
    expect(b).toHaveAttribute('data-state', 'current');
    expect(b).toHaveAttribute('data-stuck', 'true');
  });
});

describe('RunTraceView tokens', () => {
  it('tokens rest on the active states and taken edges are marked', () => {
    const trace = runWord(endsInA, 'a');
    show(trace, 1);
    expect(tokensOn()).toEqual(['q0', 'q1']);
    expect(activeStates()).toEqual(['q0', 'q1']);
    const taken = [...document.querySelectorAll('[data-taken="true"]')].map((e) =>
      e.getAttribute('data-transition-id'),
    );
    expect(taken.sort()).toEqual(['q0->q0', 'q0->q1']);
    expect(screen.queryAllByTestId('moving-token')).toHaveLength(0);
  });

  it('a stuck step keeps a ✕ on the states the run died in', () => {
    const trace = runWord(parity, 'ab');
    show(trace, lastIndex(trace));
    const dead = screen.getAllByTestId('dead-branch');
    expect(dead.map((d) => d.getAttribute('data-state-id'))).toEqual(['q_1']);
    expect(dead[0]).not.toHaveAttribute('data-fading');
    expect(screen.getByTestId('run-token')).toHaveAttribute('data-tone', 'reject');
  });

  it('without real SVG geometry (jsdom) a step forward jumps straight to rest', () => {
    const trace = runWord(endsInA, 'ab');
    const { rerender } = show(trace, 1);
    rerender(<RunTraceView trace={trace} stepIndex={2} />);
    expect(screen.queryAllByTestId('moving-token')).toHaveLength(0);
    expect(tokensOn()).toEqual(['q0']);
    expect(screen.queryAllByTestId('dead-branch')).toHaveLength(0);
  });

  describe('with motion available', () => {
    const enableMotion = (): void => {
      vi.useFakeTimers({
        toFake: [
          'setTimeout',
          'clearTimeout',
          'requestAnimationFrame',
          'cancelAnimationFrame',
          'performance',
        ],
      });
      vi.stubGlobal(
        'SVGGeometryElement',
        class {
          getTotalLength(): number {
            return 0;
          }
        },
      );
    };

    it('a read step forward moves one token per taken edge, fades dead branches, then rests', () => {
      enableMotion();
      const trace = runWord(endsInA, 'ab');
      const { rerender } = show(trace, 1);
      expect(tokensOn()).toEqual(['q0', 'q1']);
      rerender(<RunTraceView trace={trace} stepIndex={2} />);
      // Moving: the tokens left their states, q1 has no 'b' move and dies.
      const moving = screen.getAllByTestId('moving-token');
      expect(moving.map((t) => t.getAttribute('data-transition-id'))).toEqual(['q0->q0']);
      expect(tokensOn()).toEqual([]);
      expect(activeStates()).toEqual([]);
      const dead = screen.getAllByTestId('dead-branch');
      expect(dead.map((d) => d.getAttribute('data-state-id'))).toEqual(['q1']);
      expect(dead[0]).toHaveAttribute('data-fading', 'true');
      // After 75% of the 800 ms step the token lands.
      act(() => void vi.advanceTimersByTime(650));
      expect(screen.queryAllByTestId('moving-token')).toHaveLength(0);
      expect(screen.queryAllByTestId('dead-branch')).toHaveLength(0);
      expect(tokensOn()).toEqual(['q0']);
      expect(activeStates()).toEqual(['q0']);
    });

    it('stepping back or jumping does not animate', () => {
      enableMotion();
      const trace = runWord(endsInA, 'ab');
      const { rerender } = show(trace, 2);
      rerender(<RunTraceView trace={trace} stepIndex={1} />);
      expect(screen.queryAllByTestId('moving-token')).toHaveLength(0);
      expect(tokensOn()).toEqual(['q0', 'q1']);
      rerender(<RunTraceView trace={trace} stepIndex={0} />);
      rerender(<RunTraceView trace={trace} stepIndex={2} />);
      expect(screen.queryAllByTestId('moving-token')).toHaveLength(0);
    });

    it('prefers-reduced-motion disables the animation', () => {
      enableMotion();
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
      const trace = runWord(endsInA, 'ab');
      const { rerender } = show(trace, 1);
      rerender(<RunTraceView trace={trace} stepIndex={2} />);
      expect(screen.queryAllByTestId('moving-token')).toHaveLength(0);
      expect(tokensOn()).toEqual(['q0']);
    });
  });
});

describe('RunTraceView verdict', () => {
  const verdictOf = (trace: RunTrace): HTMLElement => {
    show(trace, lastIndex(trace));
    return screen.getByTestId('verdict');
  };

  it('only appears on the last step', () => {
    const trace = runWord(parity, 'a');
    show(trace, 1);
    expect(screen.queryByTestId('verdict')).toBeNull();
  });

  it('DFA accept: green banner naming the accepting state, with its subscript', () => {
    const v = verdictOf(runWord(parity, 'a'));
    expect(v).toHaveAttribute('data-accepted', 'true');
    expect(v).toHaveTextContent('Accepted');
    expect(v).toHaveTextContent('Ended in accepting state q1');
    expect(v.querySelector('sub')).toHaveTextContent('1');
    expect(screen.getByTestId('run-token')).toHaveAttribute('data-tone', 'accept');
  });

  it('DFA reject: the final state is not accepting', () => {
    const v = verdictOf(runWord(parity, 'aa'));
    expect(v).toHaveAttribute('data-accepted', 'false');
    expect(v).toHaveTextContent('Rejected');
    expect(v).toHaveTextContent('Ended in q0, which is not accepting');
  });

  it('stuck: names the missing transition', () => {
    const v = verdictOf(runWord(parity, 'ab'));
    expect(v).toHaveAttribute('data-accepted', 'false');
    expect(v).toHaveTextContent("Stuck: no 'b' transition from q1");
  });

  it('NFA: accepts when some active state is accepting', () => {
    const v = verdictOf(runWord(endsInA, 'ba'));
    expect(v).toHaveAttribute('data-accepted', 'true');
    expect(v).toHaveTextContent('Ended in {q0, q1}; q1 is accepting');
  });
});

describe('RunTraceView sound', () => {
  it('replays the Run chime when the run comes back to its first step', () => {
    const trace = runWord(parity, 'ab');
    const { rerender } = show(trace, 0);
    // The Run button plays the chime that opens the run.
    expect(playRunSound).not.toHaveBeenCalled();
    rerender(<RunTraceView trace={trace} stepIndex={1} />);
    rerender(<RunTraceView trace={trace} stepIndex={lastIndex(trace)} />);
    expect(playRunSound).not.toHaveBeenCalled();
    rerender(<RunTraceView trace={trace} stepIndex={0} />);
    expect(playRunSound).toHaveBeenCalledTimes(1);
    // A new run opens at its first step: that chime is the Run button's.
    rerender(<RunTraceView trace={runWord(parity, 'a')} stepIndex={0} />);
    expect(playRunSound).toHaveBeenCalledTimes(1);
  });
});
