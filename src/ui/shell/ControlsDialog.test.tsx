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
  it('opens from the help button on the Build tab, gestures shown as chips', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(dialog()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Controls' }));
    const d = dialog()!;
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(within(d).getByRole('tab', { name: 'Build' })).toHaveAttribute('aria-selected', 'true');
    const panel = within(d).getByRole('tabpanel');
    expect(within(panel).getByText('Add a state')).toBeInTheDocument();
    expect(within(panel).getAllByText('Double-click').length).toBeGreaterThan(0);
    expect(Array.from(panel.querySelectorAll('kbd')).map((k) => k.textContent)).toContain('Shift');
  });

  it('the Keys tab lists S and A for start and accepting, not Enter or Space', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Controls' }));
    await user.click(within(dialog()!).getByRole('tab', { name: 'Keys' }));
    const panel = within(dialog()!).getByRole('tabpanel');
    const keys = Array.from(panel.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(keys).toEqual(expect.arrayContaining(['S', 'A', 'Delete', '?']));
    expect(keys).not.toContain('Enter');
    expect(keys).not.toContain('Space');
    expect(within(panel).getByText('Toggle start state')).toBeInTheDocument();
  });

  it('arrow keys move between tabs and Tab stays inside the dialog', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Controls' }));
    const d = dialog()!;
    const tab = (name: string) => within(d).getByRole('tab', { name });
    expect(d).toHaveFocus();
    await user.tab();
    expect(within(d).getByRole('button', { name: 'Close controls' })).toHaveFocus();
    await user.tab();
    expect(tab('Build')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tab('Arrange')).toHaveFocus();
    expect(tab('Arrange')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(tab('Keys')).toHaveAttribute('aria-selected', 'true');
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
