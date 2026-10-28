import { useEffect, useRef } from 'react';
import { appStore } from '../store/store';
import { NO_PERSIST_WARNING, saveToStorage } from './storage';

const DEBOUNCE_MS = 500;

export interface AutosaveOptions {
  /** Called once, the first time a save fails (e.g. storage is full or blocked). */
  onFail?: (message: string) => void;
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Save the automata to localStorage 500 ms after the last change; a save still pending when the
 * page is hidden or unloaded (`pagehide`) is written immediately.
 */
export function useAutosave(options: AutosaveOptions = {}): void {
  const onFail = useRef(options.onFail);
  useEffect(() => {
    onFail.current = options.onFail;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = false;
    let warned = false;
    const save = (): void => {
      clearTimeout(timer);
      pending = false;
      if (!saveToStorage(browserStorage(), appStore.getState().automata) && !warned) {
        warned = true;
        onFail.current?.(NO_PERSIST_WARNING);
      }
    };
    const unsubscribe = appStore.subscribe((state, prev) => {
      if (state.automata === prev.automata) return;
      clearTimeout(timer);
      pending = true;
      timer = setTimeout(save, DEBOUNCE_MS);
    });
    const flush = (): void => {
      if (pending) save();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', flush);
      clearTimeout(timer);
    };
  }, []);
}
