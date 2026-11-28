/**
 * Anonymous usage counts with GoatCounter (https://tomerti.goatcounter.com): page visits, plus an
 * event per run, Convert to DFA, Minimize, DFA built from a regex, and lesson started or finished.
 * Only the live site loads it, so dev, tests and copies hosted elsewhere send nothing. Events are
 * fixed names: never anything the user typed, drew or named.
 */

const LIVE_HOST = 'tomerti.github.io';
const ENDPOINT = 'https://tomerti.goatcounter.com/count';
const SCRIPT = 'https://gc.zgo.at/count.js';

/** Every event that can be sent. Lesson ids are `LessonId`s (`ui/tutorial/engine.ts`). */
export type AnalyticsEvent =
  'run' | 'convert' | 'minimize' | 'regex' | `lesson-${string}-start` | `lesson-${string}-finish`;

declare global {
  interface Window {
    /** Set by GoatCounter's `count.js` once it has loaded. */
    goatcounter?: { count(vars: { path: string; title?: string; event?: boolean }): void };
  }
}

/** Load GoatCounter, which counts this visit, when the page is the live site. */
export function startAnalytics(hostname = location.hostname, doc = document): void {
  if (hostname !== LIVE_HOST) return;
  if (doc.querySelector(`script[src="${SCRIPT}"]`)) return;
  const script = doc.createElement('script');
  script.async = true;
  script.src = SCRIPT;
  script.dataset.goatcounter = ENDPOINT;
  doc.head.append(script);
}

/** Count one use of a feature. Does nothing until GoatCounter has loaded, or if it is blocked. */
export function track(event: AnalyticsEvent): void {
  try {
    window.goatcounter?.count({ path: event, title: event, event: true });
  } catch {
    // Analytics never gets in the way.
  }
}
