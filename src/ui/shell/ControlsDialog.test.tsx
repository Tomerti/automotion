import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAppStore } from '../../store/store';
import App from './App';
import { LESSONS_DONE_KEY, markLessonFinished } from '../tutorial/lessonsDone';
import { endLesson } from '../tutorial/tutorialStore';
import { SEEN_HELP_KEY } from './help';

const dialog = () => screen.queryByRole('dialog', { name: 'Controls' });

beforeEach(() => {
  resetAppStore();
  localStorage.removeItem(LESSONS_DONE_KEY);
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

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

  it('the Keys tab lists each key once, Ctrl+C and Delete covering history entries too', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Controls' }));
    await user.click(within(dialog()!).getByRole('tab', { name: 'Keys' }));
    const panel = within(dialog()!).getByRole('tabpanel');
    const rows = Array.from(panel.querySelectorAll('.av-guide-row'));
    const combos = rows.map((r) =>
      Array.from(r.querySelectorAll('kbd'))
        .map((k) => k.textContent)
        .join('+'),
    );
    expect(new Set(combos).size).toBe(combos.length);
    expect(combos).toEqual(expect.arrayContaining(['Ctrl+X', 'Ctrl+A']));
    expect(within(panel).getAllByText('selection or history entry')).toHaveLength(2);
    expect(within(panel).getByText('canvas or history bar')).toBeInTheDocument();
  });

  it('shows only the open tab, so the dialog is as tall as that tab', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Controls' }));
    const d = dialog()!;
    const panels = d.querySelectorAll('[role="tabpanel"]');
    expect(panels).toHaveLength(5);
    expect(Array.from(panels).filter((p) => !(p as HTMLElement).hidden)).toHaveLength(1);
    await user.click(within(d).getByRole('tab', { name: 'Run' }));
    expect(within(d).getByRole('tabpanel')).toHaveTextContent('Run the word');
    expect(Array.from(panels).filter((p) => !(p as HTMLElement).hidden)).toHaveLength(1);
  });

  it('arrow keys move between tabs and Tab stays inside the dialog', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Controls' }));
    const d = dialog()!;
    const tab = (name: string) => within(d).getByRole('tab', { name });
    expect(d).toHaveFocus();
    await user.tab();
    expect(within(d).getByRole('button', { name: 'Lessons' })).toHaveFocus();
    await user.tab();
    expect(within(d).getByRole('button', { name: 'Close controls' })).toHaveFocus();
    await user.tab();
    expect(tab('Build')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tab('Arrange')).toHaveFocus();
    expect(tab('Arrange')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(tab('Lessons')).toHaveAttribute('aria-selected', 'true');
    await user.tab();
    expect(within(d).getByRole('button', { name: 'Lessons' })).toHaveFocus();
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

  it('does not open by itself on a first visit (the welcome dialog does)', () => {
    localStorage.removeItem(SEEN_HELP_KEY);
    render(<App />);
    expect(dialog()).toBeNull();
  });

  it("the header's Lessons button opens the Lessons tab, a row starts its lesson", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Controls' }));
    await user.click(within(dialog()!).getByRole('button', { name: 'Lessons' }));
    expect(within(dialog()!).getByRole('tab', { name: 'Lessons' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const row = within(dialog()!).getByTestId('lesson-basics');
    expect(row).toHaveTextContent('Basics');
    expect(row).toHaveTextContent(/~\d+ min/);
    expect(within(row).queryByLabelText('finished')).toBeNull();
    await user.click(row);
    expect(dialog()).toBeNull();
    expect(screen.getByTestId('tutorial-card')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Controls' }));
    await user.click(within(dialog()!).getByRole('button', { name: 'Lessons' }));
    expect(within(dialog()!).getByTestId('lesson-basics')).toHaveTextContent('Restart');
    act(() => endLesson());
  });

  it('a finished lesson shows a tick', async () => {
    markLessonFinished('basics');
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Controls' }));
    await user.click(within(dialog()!).getByRole('tab', { name: 'Lessons' }));
    expect(
      within(within(dialog()!).getByTestId('lesson-basics')).getByLabelText('finished'),
    ).toBeInTheDocument();
  });

  it('on a touch-only device the lessons are disabled, with a note', async () => {
    const mm = vi.fn((q: string) => ({
      matches: q === '(pointer: coarse)',
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    vi.stubGlobal('matchMedia', mm);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Controls' }));
    await user.click(within(dialog()!).getByRole('tab', { name: 'Lessons' }));
    expect(within(dialog()!).getByText('Lessons need a mouse and keyboard.')).toBeInTheDocument();
    expect(within(dialog()!).getByTestId('lesson-basics')).toBeDisabled();
  });
});
