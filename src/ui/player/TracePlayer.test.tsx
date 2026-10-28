import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TracePlayer } from './TracePlayer';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness({
  n = 4,
  onClose = () => {},
}: {
  n?: number;
  onClose?: () => void;
}): React.JSX.Element {
  const [i, setI] = useState(0);
  return (
    <TracePlayer
      stepCount={n}
      index={i}
      onIndex={(k) => setI(Math.min(Math.max(k, 0), n - 1))}
      explanation={`explain ${i}`}
      onClose={onClose}
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
    expect(screen.getByText('explain 3')).toHaveAttribute('aria-live', 'polite');
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

  it('speed changes the interval', () => {
    vi.useFakeTimers();
    render(<Harness n={5} />);
    fireEvent.change(screen.getByLabelText('Speed'), { target: { value: '2' } });
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
