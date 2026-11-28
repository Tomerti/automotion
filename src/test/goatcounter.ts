import { onTestFinished } from 'vitest';

/** Stand in for GoatCounter for this test: returns the events `track` sends, in order. */
export function recordEvents(): string[] {
  const events: string[] = [];
  window.goatcounter = { count: (vars) => void events.push(vars.path) };
  onTestFinished(() => {
    delete window.goatcounter;
  });
  return events;
}
