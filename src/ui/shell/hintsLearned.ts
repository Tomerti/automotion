import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { Automaton } from '../../core/model';
import { appStore } from '../../store/store';
import type { AppState } from '../../store/store';
import { RETIRE_AFTER } from './hints';
import type { LearnKey, Learned } from './hints';

/** How often each hinted gesture has been used, per browser (`hints.ts` retires learned ones). */
export const HINTS_KEY = 'automotion:hints-learned';

function read(): Learned {
  try {
    const raw = window.localStorage.getItem(HINTS_KEY);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Learned = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k as LearnKey] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function save(learned: Learned): void {
  try {
    window.localStorage.setItem(HINTS_KEY, JSON.stringify(learned));
  } catch {
    // Best-effort: the hints just come back next visit.
  }
}

export const hintsStore = createStore<Learned>()(read);

export const useLearned = (): Learned => useStore(hintsStore);

/** Count one use of `key` (no-op once it has retired, so storage isn't rewritten for nothing). */
export function learn(key: LearnKey): void {
  const now = hintsStore.getState()[key] ?? 0;
  if (now >= RETIRE_AFTER) return;
  const next = { ...hintsStore.getState(), [key]: now + 1 };
  hintsStore.setState(next, true);
  save(next);
}

/** Retire `keys` at once: the strip's × ("I know this"). */
export function dismiss(keys: readonly LearnKey[]): void {
  const next = { ...hintsStore.getState() };
  for (const k of keys) next[k] = RETIRE_AFTER;
  hintsStore.setState(next, true);
  save(next);
}

/** Reload the counts from storage (tests). */
export function reloadLearned(): void {
  hintsStore.setState(read(), true);
}

const sameSet = (x: readonly string[], y: readonly string[]): boolean =>
  x.length === y.length && x.every((v) => y.includes(v));

const symbolCount = (a: Automaton): number =>
  a.transitions.reduce((n, t) => n + t.symbols.length, 0);

/** What an edit of one automaton (`before` → `after`) shows was used. */
function learnedFromEdit(before: Automaton, after: Automaton): LearnKey[] {
  const keys: LearnKey[] = [];
  if (symbolCount(after) > symbolCount(before)) keys.push('transition');
  if (!sameSet(before.starts, after.starts)) keys.push('start');
  if (!sameSet(before.accepting, after.accepting)) keys.push('accept');
  if (after.states.length < before.states.length) keys.push('delete');
  if (after.states.length === before.states.length) {
    const moved = after.states.filter((q) => {
      const old = before.states.find((p) => p.id === q.id);
      return old !== undefined && (old.x !== q.x || old.y !== q.y);
    });
    if (moved.length >= 2) keys.push('group');
  }
  return keys;
}

/** What a store change shows was used. */
export function learnedFrom(s: AppState, prev: AppState): LearnKey[] {
  const keys: LearnKey[] = [];
  if (s.trace !== prev.trace && s.trace) {
    if (s.trace.kind === 'subset') keys.push('convert');
    if (s.trace.kind === 'minimize') keys.push('minimize');
  }
  if (s.clipboard !== prev.clipboard && s.clipboard !== null) keys.push('copy');
  if (s.selection.states.length >= 2 && prev.selection.states.length < 2) keys.push('multi');
  if (s.activeId !== null && s.activeId === prev.activeId && s.automata !== prev.automata) {
    const after = s.automata.find((a) => a.id === s.activeId);
    const before = prev.automata.find((a) => a.id === s.activeId);
    if (after && before && after !== before) keys.push(...learnedFromEdit(before, after));
  }
  return keys;
}

/** Count the hinted gestures as they are used; returns a function that stops. */
export function startHintLearning(): () => void {
  // A drag moves the selection on every pointer move, after one checkpoint: count a group move
  // once per checkpoint (undo entry), not once per frame.
  let groupCountedAt: unknown = null;
  return appStore.subscribe((s, prev) => {
    for (const k of learnedFrom(s, prev)) {
      if (k === 'group') {
        const entry = s.activeId === null ? null : s.history[s.activeId];
        if (entry === groupCountedAt) continue;
        groupCountedAt = entry;
      }
      learn(k);
    }
  });
}
