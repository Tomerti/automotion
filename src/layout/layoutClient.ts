import type { Automaton } from '../core/model';

export interface LayoutRequest {
  id: number;
  automaton: Automaton;
}

export type LayoutReply =
  { id: number; ok: true; result: Automaton } | { id: number; ok: false; message: string };

let worker: Worker | null = null;
/** Set once the worker failed to start: later layouts run on the page instead. */
let broken = false;
let nextId = 0;
const pending = new Map<
  number,
  { automaton: Automaton; resolve: (a: Automaton) => void; reject: (e: Error) => void }
>();

/** The layout on the page itself: a dynamic import, so elk stays out of the main bundle. */
async function layoutHere(a: Automaton): Promise<Automaton> {
  const { layoutAutomaton } = await import('./layout');
  return layoutAutomaton(a);
}

function startWorker(): Worker | null {
  if (worker || broken) return worker;
  if (typeof Worker === 'undefined') {
    broken = true;
    return null;
  }
  try {
    worker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    broken = true;
    return null;
  }
  worker.onmessage = (e: MessageEvent<LayoutReply>) => {
    const job = pending.get(e.data.id);
    if (!job) return;
    pending.delete(e.data.id);
    if (e.data.ok) job.resolve(e.data.result);
    else job.reject(new Error(e.data.message));
  };
  // The worker script failed to load or threw at the top level: give up on it, and lay out
  // whatever was waiting on the page.
  worker.onerror = (e) => {
    e.preventDefault();
    worker?.terminate();
    worker = null;
    broken = true;
    const waiting = [...pending.values()];
    pending.clear();
    for (const job of waiting) layoutHere(job.automaton).then(job.resolve, job.reject);
  };
  return worker;
}

/**
 * `layoutAutomaton` off the main thread: a 64-state layout takes about a second, which would
 * freeze the page. One worker is started on first use and kept for later layouts. Where workers
 * are missing (tests) or the worker fails to start, the layout runs on the page instead.
 */
export function layoutInWorker(a: Automaton): Promise<Automaton> {
  const w = startWorker();
  if (!w) return layoutHere(a);
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { automaton: a, resolve, reject });
    w.postMessage({ id, automaton: a } satisfies LayoutRequest);
  });
}
