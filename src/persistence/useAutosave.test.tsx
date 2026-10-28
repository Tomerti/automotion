import { cleanup, renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../core/testing/fixtures';
import { appStore, resetAppStore } from '../store/store';
import { STORAGE_KEY } from './storage';
import { useAutosave } from './useAutosave';

beforeEach(() => {
  vi.useFakeTimers();
  resetAppStore();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const add = (name: string): void =>
  act(() =>
    appStore
      .getState()
      .addAutomaton(fixture({ kind: 'DFA', alphabet: '', name, states: ['q0'] })),
  );

describe('useAutosave', () => {
  it('debounces saves by 500 ms', () => {
    renderHook(() => useAutosave());
    add('A');
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"A"');
  });

  it('reports a failed save once through onFail', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    const onFail = vi.fn();
    renderHook(() => useAutosave({ onFail }));
    for (const n of ['A', 'B']) {
      add(n);
      act(() => {
        vi.advanceTimersByTime(600);
      });
    }
    expect(onFail.mock.calls).toEqual([["Changes won't persist — export to save"]]);
  });

  it('saves a pending change immediately on pagehide', () => {
    renderHook(() => useAutosave());
    add('A');
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"A"');
  });

  it('pagehide with nothing pending writes nothing', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderHook(() => useAutosave());
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(setItem).not.toHaveBeenCalled();
  });
});
