import { newId } from '../core/id';
import type { Automaton } from '../core/model';
import { parseFile, type ParseResult } from './fileFormat';
import { CURRENT_VERSION } from './migrate';
import { FORMAT } from './schema';

const DAMAGED = 'This link is damaged or incomplete';
const PREFIX = '#a=';

async function pipe(bytes: Uint8Array, transform: GenericTransformStream): Promise<Uint8Array> {
  const stream = new Response(bytes as BodyInit).body!.pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('bad payload');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** The automaton as a compact base64url payload (deflated JSON in the file format, no id). */
export async function encodeShare(a: Automaton): Promise<string> {
  const rest: Partial<Automaton> = { ...a };
  delete rest.id;
  const shared = {
    ...rest,
    states: a.states.map((s) => ({ ...s, x: Math.round(s.x), y: Math.round(s.y) })),
  };
  const text = JSON.stringify({ format: FORMAT, version: CURRENT_VERSION, automata: [shared] });
  const bytes = await pipe(new TextEncoder().encode(text), new CompressionStream('deflate-raw'));
  return toBase64Url(bytes);
}

export async function shareUrl(a: Automaton, base: string): Promise<string> {
  return `${base}${PREFIX}${await encodeShare(a)}`;
}

/** The payload of `#a=<payload>`, or null when the hash isn't a share link. */
export function readShareHash(hash: string): string | null {
  if (!hash.startsWith(PREFIX)) return null;
  const payload = hash.slice(PREFIX.length);
  return payload === '' ? null : payload;
}

/** Never rejects: a bad payload comes back as `{ ok: false }`. */
export async function decodeShare(payload: string, existingIds: Set<string>): Promise<ParseResult> {
  try {
    const bytes = await pipe(fromBase64Url(payload), new DecompressionStream('deflate-raw'));
    const json: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const list = (json as { automata?: unknown } | null)?.automata;
    if (Array.isArray(list)) {
      for (const item of list) {
        if (typeof item === 'object' && item !== null && !('id' in item)) {
          (item as { id?: string }).id = newId();
        }
      }
    }
    return parseFile(JSON.stringify(json), existingIds);
  } catch {
    return { ok: false, error: DAMAGED };
  }
}

function withoutId(a: Automaton): string {
  const rest: Partial<Automaton> = { ...a };
  delete rest.id;
  return JSON.stringify(rest);
}

/** Deep equality ignoring the automaton's id. */
export function sameAutomaton(a: Automaton, b: Automaton): boolean {
  return withoutId(a) === withoutId(b);
}
