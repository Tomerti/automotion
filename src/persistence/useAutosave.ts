import { useEffect } from 'react';
import { appStore } from '../store/store';
import { toast } from '../ui/shell/toastStore';
import { NO_PERSIST_WARNING, saveToStorage } from './storage';

const DEBOUNCE_MS = 500;

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Save the automata to localStorage 500 ms after the last change. */
export function useAutosave(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let warned = false;
    const unsubscribe = appStore.subscribe((state, prev) => {
      if (state.automata === prev.automata) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!saveToStorage(browserStorage(), appStore.getState().automata) && !warned) {
          warned = true;
          toast(NO_PERSIST_WARNING, 'error');
        }
      }, DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);
}
