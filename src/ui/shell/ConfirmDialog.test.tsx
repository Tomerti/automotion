import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';
import { askConfirm, confirmStore } from './confirmStore';

afterEach(() => {
  cleanup();
  confirmStore.setState({ request: null });
});

describe('ConfirmDialog', () => {
  it('renders nothing until askConfirm asks', () => {
    render(<ConfirmDialog />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('lists the names, cutting a long list short, and resolves with the answer', async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);
    let answer: Promise<boolean> = Promise.resolve(false);
    act(() => {
      answer = askConfirm({
        title: 'Delete 8 automata?',
        items: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
        confirmLabel: 'Delete',
        danger: true,
      });
    });
    const ask = screen.getByRole('alertdialog', { name: 'Delete 8 automata?' });
    expect(
      within(ask)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['a', 'b', 'c', 'd', 'e', 'and 3 more']);
    const confirm = within(ask).getByRole('button', { name: 'Delete' });
    expect(confirm).toHaveClass('av-danger');
    await user.click(confirm);
    await expect(answer).resolves.toBe(true);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('opens with the dialog focused, not a button; Enter confirms, Enter on a tabbed-to Cancel cancels', async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);
    let answer: Promise<boolean> = Promise.resolve(false);
    act(() => {
      answer = askConfirm({ title: 'Delete "A"?', confirmLabel: 'Delete', danger: true });
    });
    const ask = screen.getByRole('alertdialog', { name: 'Delete "A"?' });
    expect(ask).toHaveFocus();
    await user.keyboard('{Enter}');
    await expect(answer).resolves.toBe(true);

    act(() => {
      answer = askConfirm({ title: 'Delete "B"?', confirmLabel: 'Delete', danger: true });
    });
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await expect(answer).resolves.toBe(false);
  });

  it('the backdrop cancels, and a new question cancels the open one', async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);
    let first: Promise<boolean> = Promise.resolve(true);
    let second: Promise<boolean> = Promise.resolve(true);
    act(() => {
      first = askConfirm({ title: 'First?', confirmLabel: 'OK' });
    });
    act(() => {
      second = askConfirm({ title: 'Second?', confirmLabel: 'OK' });
    });
    await expect(first).resolves.toBe(false);
    expect(screen.getByRole('alertdialog', { name: 'Second?' })).toBeInTheDocument();
    await user.pointer({ keys: '[MouseLeft]', target: screen.getByTestId('modal-backdrop') });
    await expect(second).resolves.toBe(false);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
