import type { Automaton } from '../core/model';
import { exampleAutomata } from './examples';
import { parseFile, serialize } from './fileFormat';

export const STORAGE_KEY = 'automaton-vis:v1';
export const BACKUP_KEY = 'automaton-vis:v1:corrupt-backup';

export const NO_PERSIST_WARNING = "Changes won't persist — export to save";
const CORRUPT_WARNING =
  'Saved data could not be read; a backup was kept and the examples were loaded';

export function loadFromStorage(storage: Storage | null): {
  automata: Automaton[];
  warning?: string;
} {
  if (storage === null) return { automata: exampleAutomata(), warning: NO_PERSIST_WARNING };
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { automata: exampleAutomata(), warning: NO_PERSIST_WARNING };
  }
  if (raw === null) return { automata: exampleAutomata() };
  const parsed = parseFile(raw, new Set());
  if (parsed.ok) return { automata: parsed.automata };
  try {
    storage.setItem(BACKUP_KEY, raw);
  } catch {
    // The backup is best-effort.
  }
  return { automata: exampleAutomata(), warning: CORRUPT_WARNING };
}

export function saveToStorage(storage: Storage | null, automata: Automaton[]): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(STORAGE_KEY, serialize(automata));
    return true;
  } catch {
    return false;
  }
}
