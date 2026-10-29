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

export function parseFile(text: string, existingIds: Set<string>): ParseResult {
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
