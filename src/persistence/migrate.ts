export const CURRENT_VERSION = 2;

type V1Automaton = { start?: unknown; states?: unknown };

/**
 * v1 → v2: `start: id | null` becomes `starts: [id]` or `[]`. v1 never checked that the start
 * named a state, so a dangling one is dropped rather than failing the whole file.
 */
function fromV1(a: unknown): unknown {
  if (typeof a !== 'object' || a === null) return a;
  const { start, ...rest } = a as V1Automaton;
  const states = Array.isArray(rest.states) ? (rest.states as { id?: unknown }[]) : [];
  const exists = typeof start === 'string' && states.some((s) => s?.id === start);
  return { ...rest, starts: exists ? [start] : [] };
}

/** Bring a parsed file up to `CURRENT_VERSION`; newer files are refused. */
export function migrate(json: unknown): unknown {
  const version = (json as { version?: unknown } | null)?.version;
  if (typeof version === 'number' && version > CURRENT_VERSION) {
    throw new Error('This file is from a newer version of AutoMotion');
  }
  if (version === 1) {
    const file = json as { automata?: unknown };
    const automata = Array.isArray(file.automata) ? file.automata.map(fromV1) : file.automata;
    return { ...file, version: 2, automata };
  }
  return json;
}
