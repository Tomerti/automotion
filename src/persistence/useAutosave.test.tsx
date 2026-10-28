import { cleanup, renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../core/testing/fixtures';
import { appStore, resetAppStore } from '../store/store';
import { toastStore } from '../ui/shell/toastStore';
import { STORAGE_KEY } from './storage';
import { useAutosave } from './useAutosave';

beforeEach(() => {
  vi.useFakeTimers();
  resetAppStore();
  toastStore.setState({ toasts: [] });
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useAutosave', () => {
  it('debounces saves by 500 ms', () => {
    renderHook(() => useAutosave());
    act(() => appStore.getState().addAutomaton(fixture({ kind: 'DFA', alphabet: '', name: 'A', states: ['q0'] })));
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"A"');
  });

  it('toasts once when saving fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    renderHook(() => useAutosave());
    for (const n of ['A', 'B']) {
      act(() => appStore.getState().addAutomaton(fixture({ kind: 'DFA', alphabet: '', name: n, states: ['q0'] })));
      act(() => {
        vi.advanceTimersByTime(600);
      });
    }
    expect(toastStore.getState().toasts.map((t) => t.message)).toEqual([
      "Changes won't persist — export to save",
    ]);
  });
});
