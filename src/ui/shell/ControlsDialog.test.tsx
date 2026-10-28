import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetAppStore } from '../../store/store';
import App from './App';
import { SEEN_HELP_KEY } from './help';

const dialog = () => screen.queryByRole('dialog', { name: 'Controls' });

beforeEach(() => resetAppStore());
afterEach(cleanup);

describe('Controls popup', () => {
  it('opens from the help button and lists the gestures with keys as <kbd>', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(dialog()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Controls' }));
    const d = dialog()!;
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(within(d).getByText('Double-click empty canvas')).toBeInTheDocument();
    expect(within(d).getByText('Add a state')).toBeInTheDocument();
    const keys = Array.from(d.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(keys).toEqual(expect.arrayContaining(['Shift', 'Enter', 'Space', 'Delete', '?']));
    expect(d).toHaveFocus();
    await user.tab();
    expect(within(d).getByRole('button', { name: 'Close controls' })).toHaveFocus();
    await user.tab();
    expect(within(d).getByRole('button', { name: 'Close controls' })).toHaveFocus();
  });

  it('closes with Escape, the close button and the backdrop', async () => {
    const user = userEvent.setup();
    render(<App />);
    const open = () => user.click(screen.getByRole('button', { name: 'Controls' }));

    await open();
    await user.keyboard('{Escape}');
    expect(dialog()).toBeNull();
    expect(screen.getByRole('button', { name: 'Controls' })).toHaveFocus();

    await open();
    await user.click(screen.getByRole('button', { name: 'Close controls' }));
    expect(dialog()).toBeNull();

    await open();
    await user.click(within(dialog()!).getByText('Add a state'));
    expect(dialog()).not.toBeNull();
    await user.click(screen.getByTestId('modal-backdrop'));
    expect(dialog()).toBeNull();
  });

  it('? opens it, except while typing in a field', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText('Word'));
    await user.keyboard('?');
    expect(dialog()).toBeNull();
    expect(screen.getByLabelText('Word')).toHaveValue('?');
    await user.click(document.body);
    await user.keyboard('?');
    expect(dialog()).not.toBeNull();
  });

  it('opens by itself once, on the first visit', async () => {
    const user = userEvent.setup();
    localStorage.removeItem(SEEN_HELP_KEY);
    const first = render(<App />);
    expect(dialog()).not.toBeNull();
    expect(localStorage.getItem(SEEN_HELP_KEY)).not.toBeNull();
    await user.keyboard('{Escape}');
    first.unmount();

    render(<App />);
    expect(dialog()).toBeNull();
  });
});
