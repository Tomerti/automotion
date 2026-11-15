/// <reference lib="webworker" />
import type { Automaton } from '../core/model';
import { layoutAutomaton } from './layout';
import type { LayoutReply, LayoutRequest } from './layoutClient';

declare const self: DedicatedWorkerGlobalScope;

// Assigned, not added: elk.bundled.js, imported above, sets `self.onmessage` to its own dispatcher
// when it finds itself in a worker; this replaces it, so only layout requests are answered.
self.onmessage = async (e: MessageEvent<LayoutRequest>) => {
  const { id, automaton } = e.data;
  let reply: LayoutReply;
  try {
    const result: Automaton = await layoutAutomaton(automaton);
    reply = { id, ok: true, result };
  } catch (err) {
    reply = { id, ok: false, message: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(reply);
};
