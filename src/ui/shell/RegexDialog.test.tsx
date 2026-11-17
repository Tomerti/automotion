import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appStore, resetAppStore } from '../../store/store';
import { RegexDialog } from './RegexDialog';
import { closeRegexDialog, openRegexDialog, useRegexDialog } from './regexDialogStore';

beforeEach(() => {
  resetAppStore();
  closeRegexDialog();
});
afterEach(cleanup);

function openDialog(): void {
  act(() => openRegexDialog());
  render(<RegexDialog />);
}

describe('RegexDialog', () => {
  it('renders nothing while closed', () => {
    render(<RegexDialog />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('normalises \\eps live and builds on Enter', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Regex'), '(a|\\eps)*');
    expect(screen.getByLabelText('Regex')).toHaveValue('(a|ε)*');
    await user.type(screen.getByLabelText('Regex'), '{Enter}');
    expect(appStore.getState().trace?.kind).toBe('thompson');
    expect(useRegexDialog.getState().open).toBe(false);
  });

  it('shows the error under the offending character and disables Build NFA', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Regex'), 'a|');
    expect(screen.getByTestId('regex-error')).toHaveTextContent('Nothing after |');
    // The error is at the `|` (offset 1): one column in.
    expect(screen.getByTestId('regex-caret').textContent).toBe(' ^');
    const build = screen.getByTestId('regex-build');
    expect(build).toBeDisabled();
    expect(build).toHaveAttribute('title', 'Nothing after |');
    await user.type(screen.getByLabelText('Regex'), '{Enter}');
    expect(appStore.getState().trace).toBeNull();
    expect(useRegexDialog.getState().open).toBe(true);
  });

  it('counts an astral character as one column in the caret', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Regex'), '😀)');
    expect(screen.getByTestId('regex-caret').textContent).toBe(' ^');
  });

  it('empty input: Build NFA disabled, no error shown yet', () => {
    openDialog();
    expect(screen.queryByTestId('regex-error')).toBeNull();
    expect(screen.getByTestId('regex-build')).toBeDisabled();
    expect(screen.getByTestId('regex-build')).toHaveAttribute('title', 'Type a regex');
  });

  it('the Build NFA button builds', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Regex'), 'ab');
    await user.click(screen.getByTestId('regex-build'));
    expect(appStore.getState().trace?.kind).toBe('thompson');
  });

  it('Escape cancels', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Regex'), 'ab');
    await user.keyboard('{Escape}');
    expect(useRegexDialog.getState().open).toBe(false);
    expect(appStore.getState().trace).toBeNull();
  });
});
