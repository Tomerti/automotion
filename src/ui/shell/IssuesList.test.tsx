import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../core/validate';
import { IssuesList } from './IssuesList';

afterEach(cleanup);

const issues: Issue[] = [
  { severity: 'warning', message: 'q1 is unreachable', stateId: 'q1' },
  { severity: 'error', message: 'bad edge', transitionId: 't1' },
  { severity: 'warning', message: 'No start state' },
  { severity: 'error', message: 'dup', stateId: 'q0' },
];

describe('IssuesList', () => {
  it('orders errors first, then warnings, keeping order otherwise', () => {
    render(<IssuesList issues={issues} onSelect={() => {}} />);
    const items = screen.getAllByRole('button');
    expect(items.map((b) => b.textContent)).toEqual([
      'bad edge',
      'dup',
      'q1 is unreachable',
      'No start state',
    ]);
    expect(items[0]).toHaveAttribute('data-severity', 'error');
    expect(items[2]).toHaveAttribute('data-severity', 'warning');
  });

  it('selects the offending element on click', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<IssuesList issues={issues} onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'bad edge' }));
    expect(onSelect).toHaveBeenLastCalledWith({ states: [], transitions: ['t1'] });
    await user.click(screen.getByRole('button', { name: 'dup' }));
    expect(onSelect).toHaveBeenLastCalledWith({ states: ['q0'], transitions: [] });
    await user.click(screen.getByRole('button', { name: 'No start state' }));
    expect(onSelect).toHaveBeenLastCalledWith({ states: [], transitions: [] });
  });

  it('shows No issues when empty', () => {
    render(<IssuesList issues={[]} onSelect={() => {}} />);
    expect(screen.getByText('No issues')).toBeInTheDocument();
  });

  it('keeps the message in one element, so the row lays out as a dot and one text', () => {
    // The row is a flex box: text and <sub> as separate items were spaced apart and wrapped.
    render(
      <IssuesList
        issues={[{ severity: 'error', message: "q_0 needs a transition on '1'", stateId: 'q' }]}
        onSelect={() => {}}
      />,
    );
    const button = screen.getByRole('button', { name: "q0 needs a transition on '1'" });
    expect(button.childNodes).toHaveLength(1);
    expect(button.querySelector('sub')).toHaveTextContent('0');
  });

  it('leaves quoted symbols alone', () => {
    render(
      <IssuesList
        issues={[{ severity: 'error', message: "q_1 needs a transition on 'a_b'" }]}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole('button').querySelectorAll('sub')).toHaveLength(1);
  });

  it('renders subscripts in state labels', () => {
    render(
      <IssuesList
        issues={[{ severity: 'warning', message: 'q_{12} is unreachable', stateId: 'q' }]}
        onSelect={() => {}}
      />,
    );
    const button = screen.getByRole('button', { name: 'q12 is unreachable' });
    expect(button.querySelector('sub')).toHaveTextContent('12');
  });
});
