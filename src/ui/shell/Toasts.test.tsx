import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toasts } from './Toasts';
import { toast, toastStore } from './toastStore';

beforeEach(() => toastStore.setState({ toasts: [] }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Toasts', () => {
  it('renders a toast as status and dismisses via the close button', async () => {
    const user = userEvent.setup();
    render(<Toasts />);
    act(() => toast('Hello'));
    expect(screen.getByRole('status')).toHaveTextContent('Hello');
    await user.click(screen.getByRole('button', { name: /close|dismiss/i }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('auto-dismisses after 5 seconds', () => {
    vi.useFakeTimers();
    render(<Toasts />);
    act(() => toast('Bye', 'error'));
    expect(toastStore.getState().toasts[0]?.kind).toBe('error');
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
