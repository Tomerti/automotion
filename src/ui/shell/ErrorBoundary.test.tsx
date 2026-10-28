import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../../core/testing/fixtures';
import { appStore } from '../../store/store';
import { ErrorBoundary } from './ErrorBoundary';
import * as download from './download';

function Boom(): React.JSX.Element {
  throw new Error('boom');
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('offers data export after a crash', async () => {
    const dfa = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0'], start: 'q0' });
    appStore.getState().replaceAll([dfa]);
    const spy = vi.spyOn(download, 'downloadText').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Export your data' }));
    expect(spy).toHaveBeenCalledTimes(1);
    const [name, text] = spy.mock.calls[0]!;
    expect(name).toBe('automata.automaton.json');
    expect(JSON.parse(text).automata).toHaveLength(1);
    expect(console.error).toHaveBeenCalled();
  });
});
