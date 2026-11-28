import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
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

  it('a phone keyboard neither capitalises nor corrects the regex (abb must not become Abb)', () => {
    openDialog();
    const input = screen.getByTestId('regex-input');
    expect(input).toHaveAttribute('autocapitalize', 'off');
    expect(input).toHaveAttribute('autocorrect', 'off');
  });

  it('Create DFA is the orange pill (av-go), like Run, not the blue av-primary', () => {
    openDialog();
    const build = screen.getByTestId('regex-build');
    expect(build).toHaveClass('av-go');
    expect(build).not.toHaveClass('av-primary');
  });

  it('normalises \\eps live; Enter creates the DFA and closes', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Regex'), String.raw`(a|\eps)*`);
    expect(screen.getByLabelText('Regex')).toHaveValue('(a|ε)*');
    await user.type(screen.getByLabelText('Regex'), '{Enter}');
    expect(useRegexDialog.getState().open).toBe(false);
    await waitFor(() => expect(appStore.getState().automata[0]?.name).toBe('(a|ε)*'));
    expect(appStore.getState().automata[0]?.kind).toBe('DFA');
    expect(appStore.getState().trace).toBeNull();
  });

  it('shows the error under the offending character and disables Create DFA', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Regex'), 'a|');
    expect(screen.getByTestId('regex-error')).toHaveTextContent('Nothing after |');
    // The error is at the `|` (offset 1): one column in.
    expect(screen.getByTestId('regex-caret-pad').textContent).toBe('a');
    const build = screen.getByTestId('regex-build');
    expect(build).toBeDisabled();
    expect(build).toHaveAttribute('title', 'Nothing after |');
    await user.type(screen.getByLabelText('Regex'), '{Enter}');
    expect(appStore.getState().automata).toHaveLength(0);
    expect(useRegexDialog.getState().open).toBe(true);
  });

  it('a too-big regex shows its reason under the box, without a caret', async () => {
    const user = userEvent.setup();
    openDialog();
    // The 7th symbol from the end: its DFA needs 2^7 = 128 states.
    await user.type(screen.getByLabelText('Regex'), '(a|b)*a(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)');
    const reason = 'Too big: the DFA would have more than 64 states';
    expect(screen.getByTestId('regex-error')).toHaveTextContent(reason);
    expect(screen.queryByTestId('regex-caret')).toBeNull();
    expect(screen.getByLabelText('Regex')).toHaveAccessibleDescription(reason);
    const build = screen.getByTestId('regex-build');
    expect(build).toBeDisabled();
    expect(build).toHaveAttribute('title', reason);
  });

  it('the syntax reminder sets each operator apart, with commas between', () => {
    openDialog();
    const input = screen.getByLabelText('Regex');
    expect(input).toHaveAccessibleDescription(
      String.raw`| or, + one or more, * any number, ε as \eps, ∅ as \emptyset`,
    );
    const chips = [...document.querySelectorAll('.av-regex-syntax code')].map((c) => c.textContent);
    expect(chips).toEqual(['|', '+', '*', String.raw`\eps`, String.raw`\emptyset`]);
  });

  it('counts an astral character as one column in the caret', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Regex'), '😀)');
    expect(screen.getByTestId('regex-caret-pad').textContent).toBe('😀');
  });

  it('keeps non-monospace symbols in the caret padding so the ^ lines up', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Regex'), String.raw`(a|\eps)*)`);
    expect(screen.getByTestId('regex-caret-pad').textContent).toBe('(a|ε)*');
    expect(screen.getByTestId('regex-caret').textContent).toBe('(a|ε)*^');
  });

  it('typing \\epsilon key by key gives ε, not εilon', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Regex'), String.raw`(a|\epsilon)*`);
    expect(screen.getByLabelText('Regex')).toHaveValue('(a|ε)*');
  });

  it('a rewrite in the middle of the regex keeps the caret where typing left it', async () => {
    const user = userEvent.setup();
    openDialog();
    const input = screen.getByLabelText<HTMLInputElement>('Regex');
    await user.type(input, 'ab');
    await user.type(input, String.raw`\eps|X`, {
      initialSelectionStart: 1,
      initialSelectionEnd: 1,
    });
    expect(input).toHaveValue('aε|Xb');
  });

  it('a \\eps left at the end turns into ε when the box loses focus', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Regex'), String.raw`a|\eps`);
    expect(screen.getByLabelText('Regex')).toHaveValue(String.raw`a|\eps`);
    await user.tab();
    expect(screen.getByLabelText('Regex')).toHaveValue('a|ε');
  });

  it('Enter right after \\eps names the DFA with ε', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Regex'), String.raw`a|\eps{Enter}`);
    await waitFor(() => expect(appStore.getState().automata[0]?.name).toBe('a|ε'));
  });

  it('the ^ lines up after a \\eps still being typed', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Regex'), String.raw`(\eps`);
    expect(screen.getByTestId('regex-error')).toHaveTextContent('Missing )');
    expect(screen.getByTestId('regex-caret-pad').textContent).toBe(String.raw`(\eps`);
  });

  it('empty input: Create DFA disabled, no error shown yet', () => {
    openDialog();
    expect(screen.queryByTestId('regex-error')).toBeNull();
    expect(screen.getByTestId('regex-build')).toBeDisabled();
    expect(screen.getByTestId('regex-build')).toHaveAttribute('title', 'Type a regex');
  });

  it('the build button is Create DFA, and it creates', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Regex'), 'ab');
    await user.click(screen.getByRole('button', { name: 'Create DFA' }));
    await waitFor(() => expect(appStore.getState().automata[0]?.name).toBe('ab'));
    expect(appStore.getState().trace).toBeNull();
  });

  it('Escape cancels', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Regex'), 'ab');
    await user.keyboard('{Escape}');
    expect(useRegexDialog.getState().open).toBe(false);
    expect(appStore.getState().automata).toHaveLength(0);
  });
});
