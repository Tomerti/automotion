import { newId } from '../core/id';
import type { Automaton } from '../core/model';
import { parseFile, type ParseResult } from './fileFormat';
import { CURRENT_VERSION } from './migrate';
import { FORMAT } from './schema';

const DAMAGED = 'This link is damaged or incomplete';
const TOO_LARGE = 'This link is too large to open';
const PREFIX = '#a=';

/**
 * The most JSON a share link may inflate to. A 64-state automaton with every arrow is well under
 * 1 MB; the cap keeps a crafted link (a few KB deflating to gigabytes) from exhausting memory.
 */
export const MAX_SHARE_BYTES = 2 * 1024 * 1024;

class TooLarge extends Error {}

async function pipe(bytes: Uint8Array, transform: GenericTransformStream): Promise<Uint8Array> {
  const stream = new Response(bytes as BodyInit).body!.pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Inflates deflate-raw `bytes`, stopping as soon as the output passes `max` bytes. */
async function inflateAtMost(bytes: Uint8Array, max: number): Promise<Uint8Array> {
  const stream = new Response(bytes as BodyInit).body!.pipeThrough(
    new DecompressionStream('deflate-raw'),
  );
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      throw new TooLarge();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
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
    const bytes = await inflateAtMost(fromBase64Url(payload), MAX_SHARE_BYTES);
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
  } catch (e) {
    return { ok: false, error: e instanceof TooLarge ? TOO_LARGE : DAMAGED };
  }
}

/** Sorted keys, no `undefined` fields: the same content gives the same text. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = canonical(v);
    }
    return out;
  }
  return value;
}

function normalized(a: Automaton): string {
  const rest: Partial<Automaton> = { ...a };
  delete rest.id;
  rest.states = a.states.map((s) => ({ ...s, x: Math.round(s.x), y: Math.round(s.y) }));
  return JSON.stringify(canonical(rest));
}

/** Same content as `b`, ignoring ids, key order and sub-pixel positions (as a share rounds them). */
export function sameAutomaton(a: Automaton, b: Automaton): boolean {
  return normalized(a) === normalized(b);
}
