import { newId } from '../core/id';
import type { Automaton } from '../core/model';
import { CURRENT_VERSION, migrate } from './migrate';
import { FORMAT, LEGACY_FORMAT, fileSchema } from './schema';

export type ParseResult = { ok: true; automata: Automaton[] } | { ok: false; error: string };

export function serialize(automata: Automaton[]): string {
  return JSON.stringify({ format: FORMAT, version: CURRENT_VERSION, automata }, null, 2);
}

function isOurFormat(format: unknown): boolean {
  return format === FORMAT || format === LEGACY_FORMAT;
}

/**
 * Drop start and accepting ids that name no state. Older builds could save one (the schema
 * didn't check), so the autosave load repairs them instead of losing the whole list.
 */
function repairDangling(json: unknown): unknown {
  if (typeof json !== 'object' || json === null) return json;
  const automata = (json as { automata?: unknown }).automata;
  if (!Array.isArray(automata)) return json;
  const repaired = automata.map((a: unknown) => {
    if (typeof a !== 'object' || a === null) return a;
    const { states, starts, accepting } = a as {
      states?: unknown;
      starts?: unknown;
      accepting?: unknown;
    };
    if (!Array.isArray(states)) return a;
    const ids = new Set(states.map((s: unknown) => (s as { id?: unknown } | null)?.id));
    const keep = (list: unknown) => (Array.isArray(list) ? list.filter((id) => ids.has(id)) : list);
    return { ...a, starts: keep(starts), accepting: keep(accepting) };
  });
  return { ...json, automata: repaired };
}

/**
 * Read a saved file. Imports and share links are strict; `repair` (the autosave load) first drops
 * dangling start and accepting ids.
 */
export function parseFile(
  text: string,
  existingIds: Set<string>,
  { repair = false }: { repair?: boolean } = {},
): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not a valid JSON file' };
  }
  if (
    typeof json !== 'object' ||
    json === null ||
    !isOurFormat((json as { format?: unknown }).format)
  ) {
    return { ok: false, error: 'Not an AutoMotion file' };
  }
  let migrated: unknown;
  try {
    migrated = migrate(json);
    if (repair) migrated = repairDangling(migrated);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not read the file' };
  }
  const result = fileSchema.safeParse(migrated);
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? 'Not an AutoMotion file' };
  }
  const seen = new Set(existingIds);
  const automata = result.data.automata.map((a) => {
    const id = seen.has(a.id) ? newId() : a.id;
    seen.add(id);
    return id === a.id ? a : { ...a, id };
  });
  return { ok: true, automata };
}
