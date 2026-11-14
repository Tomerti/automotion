import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Automaton } from '../../core/model';
import { encodeShare } from '../../persistence/shareLink';
import { appStore, resetAppStore } from '../../store/store';
import { endsAb } from '../../store/testing/fixtures';
import { startRun } from '../../store/traceActions';
import { toastStore } from './toastStore';
import { openSharedLink } from './useSharedLink';

const shared: Automaton = { ...endsAb, id: 'shared-id', name: 'From a friend' };

let replaceState: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetAppStore();
  toastStore.setState({ toasts: [] });
  replaceState = vi.spyOn(history, 'replaceState');
});
afterEach(() => replaceState.mockRestore());

describe('openSharedLink', () => {
  it('adds and opens the shared automaton', async () => {
    await openSharedLink('#a=' + (await encodeShare(shared)));
    const s = appStore.getState();
    expect(s.automata[0]?.name).toBe('From a friend');
    expect(s.activeId).toBe(s.automata[0]?.id);
    expect(toastStore.getState().toasts.map((t) => [t.message, t.kind])).toEqual([
      ['Opened “From a friend”', 'info'],
    ]);
    expect(replaceState).toHaveBeenCalledWith(null, '', location.pathname + location.search);
  });

  it('opens the saved copy instead of adding a duplicate', async () => {
    appStore.getState().addAutomaton({ ...shared, id: 'mine' });
    appStore.getState().addAutomaton({ ...endsAb, id: 'other', name: 'Other' });
    await openSharedLink('#a=' + (await encodeShare(shared)));
    const s = appStore.getState();
    expect(s.automata).toHaveLength(2);
    expect(s.activeId).toBe('mine');
  });

  it('opens a link while a trace is open', async () => {
    for (const saved of [false, true]) {
      resetAppStore();
      if (saved) appStore.getState().addAutomaton({ ...shared, id: 'mine' });
      appStore.getState().addAutomaton({ ...endsAb, id: 'other', name: 'Other' });
      startRun('ab');
      expect(appStore.getState().trace).not.toBeNull();
      await openSharedLink('#a=' + (await encodeShare(shared)));
      const s = appStore.getState();
      expect(s.trace).toBeNull();
      expect(s.automata.find((a) => a.id === s.activeId)?.name).toBe('From a friend');
    }
  });

  it('closes a trace when the saved copy is the active automaton', async () => {
    appStore.getState().addAutomaton({ ...shared, id: 'mine' });
    startRun('ab');
    await openSharedLink('#a=' + (await encodeShare(shared)));
    expect(appStore.getState().trace).toBeNull();
  });

  it('reports a broken link', async () => {
    await openSharedLink('#a=!!!');
    expect(appStore.getState().automata).toHaveLength(0);
    expect(toastStore.getState().toasts.map((t) => [t.message, t.kind])).toEqual([
      ["This link's automaton couldn't be read", 'error'],
    ]);
    expect(replaceState).toHaveBeenCalledWith(null, '', location.pathname + location.search);
  });

  it('ignores other hashes', async () => {
    await openSharedLink('#foo');
    expect(toastStore.getState().toasts).toHaveLength(0);
    expect(replaceState).not.toHaveBeenCalled();
  });
});
