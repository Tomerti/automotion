export const CURRENT_VERSION = 1;

/** Bring a parsed file up to `CURRENT_VERSION`. v1 is current, so it passes through. */
export function migrate(json: unknown): unknown {
  const version = (json as { version?: unknown } | null)?.version;
  if (typeof version === 'number' && version > CURRENT_VERSION) {
    throw new Error('This file is from a newer version of Automaton Vis');
  }
  return json;
}
