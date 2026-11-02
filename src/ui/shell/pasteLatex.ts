import { useEffect } from 'react';
import { looksLikeLatex } from '../../persistence/latexImport';
import { appStore } from '../../store/store';
import type { AppState } from '../../store/store';
import { isTypingTarget } from './help';
import { importLatexText } from './importFile';

/**
 * Ctrl+V with LaTeX (TikZ) on the system clipboard adds the automata it draws, like Import.
 *
 * The app's own clipboard (copied states or a copied automaton) lives in memory, and the
 * browser can't say when the system clipboard last changed. So the app's copy pastes while
 * the window has kept the focus since it was made; once the window lost the focus, something
 * may have been copied elsewhere, and the canvas lets the `paste` event look first (`deferPaste`).
 */

/** Counters, so equal timestamps can't tie: the app's last copy, the window's last blur. */
let tick = 0;
let copiedAt = -1;
let blurredAt = -1;
let pending: (() => void) | null = null;

/** The payload a copy makes anew (pasting only updates the clipboard's bookkeeping). */
function copied(s: AppState): unknown {
  const c = s.clipboard;
  return c === null ? null : c.kind === 'states' ? c.clip : c.automaton;
}

/** Track the app's copies and the window's blurs; returns a function that stops. */
export function startPasteTracking(): () => void {
  copiedAt = -1;
  blurredAt = -1;
  const unsubscribe = appStore.subscribe((s, prev) => {
    if (copied(s) !== copied(prev) && copied(s) !== null) copiedAt = tick++;
  });
  const onBlur = (): void => {
    blurredAt = tick++;
  };
  window.addEventListener('blur', onBlur);
  return () => {
    unsubscribe();
    window.removeEventListener('blur', onBlur);
  };
}

/** Whether something may have been copied outside the app since the app's own last copy. */
export function systemClipboardMayBeNewer(): boolean {
  return blurredAt > copiedAt;
}

/**
 * Run the app's own paste, unless the `paste` event that follows the key finds LaTeX on the
 * system clipboard. Runs it anyway when no paste event comes (a browser that sends none).
 */
export function deferPaste(run: () => void): void {
  pending = run;
  setTimeout(() => {
    if (pending !== run) return;
    pending = null;
    run();
  }, 0);
}

/** The window's `paste` listener: LaTeX pasted outside a text field is imported. */
export function onPaste(e: ClipboardEvent): void {
  if (e.defaultPrevented || isTypingTarget(e.target)) return;
  if (document.querySelector('[aria-modal="true"]')) return;
  const text = e.clipboardData?.getData('text/plain') ?? '';
  if (!looksLikeLatex(text)) return;
  e.preventDefault();
  pending = null;
  importLatexText(text, 'Pasted');
}

/** Ctrl+V pastes LaTeX anywhere in the app outside text fields (mounted once, by App). */
export function usePasteLatex(): void {
  useEffect(() => {
    const stop = startPasteTracking();
    window.addEventListener('paste', onPaste);
    return () => {
      stop();
      window.removeEventListener('paste', onPaste);
    };
  }, []);
}
