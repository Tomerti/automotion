import type { Automaton } from '../core/model';
import { emptyAutomaton } from '../core/model';
import { parseFile, serialize } from './fileFormat';
import { isUntouchedOldExample } from './oldExamples';

export const STORAGE_KEY = 'automotion:v1';
export const BACKUP_KEY = 'automotion:v1:corrupt-backup';
/** Set once the first release's untouched example automata have been removed. */
export const OLD_EXAMPLES_CHECKED_KEY = 'automotion:old-examples-checked';

/** Every key's prefix before the project was renamed AutoMotion. */
const LEGACY_PREFIX = 'automaton-vis:';
const PREFIX = 'automotion:';

/**
 * Move keys saved under the old name to the new one (same origin, so they are still here),
 * keeping any new key that already exists. Runs before anything reads storage. Best-effort.
 */
export function migrateLegacyKeys(storage: Storage | null): void {
  if (storage === null) return;
  try {
    const legacy: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(LEGACY_PREFIX)) legacy.push(key);
    }
    for (const key of legacy) {
      const value = storage.getItem(key);
      const renamed = PREFIX + key.slice(LEGACY_PREFIX.length);
      if (value !== null && storage.getItem(renamed) === null) storage.setItem(renamed, value);
      storage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable or full; the old keys stay where they are.
  }
}

export const NO_PERSIST_WARNING = "Changes won't persist — export to save";
const CORRUPT_WARNING =
  'Saved data could not be read; a backup was kept and a blank automaton was opened';

/** First launch (or unreadable data): one blank DFA to draw on. Examples load only on request. */
function blank(): Automaton[] {
  return [emptyAutomaton('Untitled', 'DFA')];
}

/**
 * True the first time this browser loads since the old-example cleanup shipped, and marks it done,
 * so the cleanup runs once: examples imported later are left alone. Without storage, never.
 */
function claimOldExampleCleanup(storage: Storage): boolean {
  try {
    if (storage.getItem(OLD_EXAMPLES_CHECKED_KEY) !== null) return false;
    storage.setItem(OLD_EXAMPLES_CHECKED_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

/** Remove the first release's seeded examples that were never changed, and save the result. */
function dropOldExamples(storage: Storage, automata: Automaton[]): Automaton[] {
  const kept = automata.filter((a) => !isUntouchedOldExample(a));
  if (kept.length === automata.length) return automata;
  const out = kept.length > 0 ? kept : blank();
  saveToStorage(storage, out);
  return out;
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
  const cleanup = claimOldExampleCleanup(storage);
  if (raw === null) return { automata: blank() };
  const parsed = parseFile(raw, new Set());
  if (parsed.ok) {
    return { automata: cleanup ? dropOldExamples(storage, parsed.automata) : parsed.automata };
  }
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
