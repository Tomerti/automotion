import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { playbackStore } from './playback';
import { TracePlayer } from './TracePlayer';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness({
  n = 4,
  onClose = () => {},
  autoPlay,
}: {
  n?: number;
  onClose?: () => void;
  autoPlay?: boolean;
}): React.JSX.Element {
  const [i, setI] = useState(0);
  return (
    <TracePlayer
      stepCount={n}
      index={i}
      onIndex={(k) => setI(Math.min(Math.max(k, 0), n - 1))}
      explanation={`explain ${i}`}
      onClose={onClose}
      autoPlay={autoPlay}
    />
  );
}

describe('TracePlayer', () => {
  it('Next/Previous/scrubber move the index and clamp', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText('Step 1 / 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('Step 1 / 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step 2 / 4')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Step'), { target: { value: '3' } });
    expect(screen.getByText('Step 4 / 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step 4 / 4')).toBeInTheDocument();
    expect(screen.getByText('explain 3').closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('First and Last jump to the ends and are disabled there', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'First' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Last' }));
    expect(screen.getByText('Step 4 / 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'First' }));
    expect(screen.getByText('Step 1 / 4')).toBeInTheDocument();
  });

  it('jumping back pauses playback; Next keeps it going', () => {
    vi.useFakeTimers();
    render(<Harness n={6} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.change(screen.getByLabelText('Step'), { target: { value: '4' } });
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByText('Step 5 / 6')).toBeInTheDocument();
  });

  it('autoPlay starts playing as soon as it opens; a single step has nothing to play', () => {
    vi.useFakeTimers();
    const { unmount } = render(<Harness n={3} autoPlay />);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(800));
    expect(screen.getByText('Step 2 / 3')).toBeInTheDocument();
    unmount();
    render(<Harness n={1} autoPlay />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('renders label subscripts in the explanation', () => {
    render(
      <TracePlayer
        stepCount={1}
        index={0}
        onIndex={() => {}}
        explanation="Read 'a': {q_0} → {q_{12}}"
        onClose={() => {}}
      />,
    );
    const line = screen.getByText((_, el) => el?.getAttribute('aria-live') === 'polite');
    expect(line).toHaveTextContent("Read 'a': {q0} → {q12}");
    expect([...line.querySelectorAll('sub')].map((s) => s.textContent)).toEqual(['0', '12']);
  });

  it('autoplay advances and stops at the end', () => {
    vi.useFakeTimers();
    render(<Harness n={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(800));
    expect(screen.getByText('Step 2 / 3')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(800));
    expect(screen.getByText('Step 3 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    // Play at the last step restarts from the first.
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByText('Step 1 / 3')).toBeInTheDocument();
  });

  it('speed changes the interval and is shared with the views', () => {
    vi.useFakeTimers();
    render(<Harness n={5} />);
    expect(playbackStore.getState().speed).toBe(1);
    fireEvent.change(screen.getByLabelText('Speed'), { target: { value: '2' } });
    expect(playbackStore.getState().speed).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    act(() => void vi.advanceTimersByTime(400));
    expect(screen.getByText('Step 2 / 5')).toBeInTheDocument();
  });

  it('keyboard: arrows, space and Esc', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Step 2 / 4')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Step 1 / 4')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores keys typed into inputs', () => {
    render(
      <>
        <input aria-label="other" />
        <Harness />
      </>,
    );
    fireEvent.keyDown(screen.getByLabelText('other'), { key: 'ArrowRight' });
    expect(screen.getByText('Step 1 / 4')).toBeInTheDocument();
  });

  it('Space on a focused button is left to the button, not the global toggle', () => {
    render(<Harness />);
    const next = screen.getByRole('button', { name: 'Next' });
    next.focus();
    fireEvent.keyDown(next, { key: ' ' });
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('Close button closes and extraActions render', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <TracePlayer
        stepCount={2}
        index={0}
        onIndex={() => {}}
        explanation="x"
        onClose={onClose}
        extraActions={<button>Extra</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Extra' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
