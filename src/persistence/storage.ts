import type { Automaton } from '../core/model';
import { emptyAutomaton } from '../core/model';
import { parseFile, serialize } from './fileFormat';

export const STORAGE_KEY = 'automaton-vis:v1';
export const BACKUP_KEY = 'automaton-vis:v1:corrupt-backup';

export const NO_PERSIST_WARNING = "Changes won't persist — export to save";
const CORRUPT_WARNING =
  'Saved data could not be read; a backup was kept and a blank automaton was opened';

/** First launch (or unreadable data): one blank DFA to draw on. Examples load only on request. */
function blank(): Automaton[] {
  return [emptyAutomaton('Untitled', 'DFA')];
}

export function loadFromStorage(storage: Storage | null): {
  automata: Automaton[];
  warning?: string;
} {
  if (storage === null) return { automata: blank(), warning: NO_PERSIST_WARNING };
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { automata: blank(), warning: NO_PERSIST_WARNING };
  }
  if (raw === null) return { automata: blank() };
  const parsed = parseFile(raw, new Set());
  if (parsed.ok) return { automata: parsed.automata };
  try {
    storage.setItem(BACKUP_KEY, raw);
  } catch {
    // The backup is best-effort.
  }
  return { automata: blank(), warning: CORRUPT_WARNING };
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
