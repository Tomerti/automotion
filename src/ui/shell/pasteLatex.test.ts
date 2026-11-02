import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../../core/testing/fixtures';
import { appStore, resetAppStore } from '../../store/store';
import { deferPaste, onPaste, startPasteTracking, systemClipboardMayBeNewer } from './pasteLatex';
import { toastStore } from './toastStore';

const TIKZ = String.raw`
\begin{tikzpicture}
  \node[state, initial] (a) at (0,0) {$a$};
  \node[state, accepting] (b) at (2,0) {$b$};
  \path[->] (a) edge node {0} (b);
\end{tikzpicture}`;

/** A paste event carrying `text`, dispatched at `target`; whether something took it. */
function paste(text: string, target: EventTarget = document.body): boolean {
  const e = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'clipboardData', {
    value: { getData: (type: string) => (type === 'text/plain' ? text : '') },
  });
  target.dispatchEvent(e);
  return e.defaultPrevented;
}

const st = () => appStore.getState();
let stop: () => void = () => {};

beforeEach(() => {
  vi.useFakeTimers();
  resetAppStore();
  const a = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0'], start: 'q0', name: 'Mine' });
  st().addAutomaton(a);
  toastStore.setState({ toasts: [] });
  stop = startPasteTracking();
  window.addEventListener('paste', onPaste);
});

afterEach(() => {
  window.removeEventListener('paste', onPaste);
  stop();
  vi.useRealTimers();
});

describe('pasting LaTeX', () => {
  it('adds the automata a pasted tikzpicture draws, and says so', () => {
    expect(paste(TIKZ)).toBe(true);
    expect(st().automata.map((a) => a.name)).toEqual(['Pasted', 'Mine']);
    expect(st().automata[0]?.states.map((s) => s.label)).toEqual(['a', 'b']);
    expect(st().activeId).toBe(st().automata[0]?.id);
    expect(toastStore.getState().toasts[0]?.message).toBe('Pasted 1 automaton from LaTeX');
  });

  it('says why when the LaTeX draws no automaton', () => {
    expect(paste(String.raw`\begin{tikzpicture}\draw (0,0) -- (1,1);\end{tikzpicture}`)).toBe(true);
    expect(st().automata).toHaveLength(1);
    expect(toastStore.getState().toasts[0]?.kind).toBe('error');
  });

  it('leaves text that is not LaTeX, and pastes into fields as usual', () => {
    expect(paste('just some words')).toBe(false);
    const input = document.createElement('input');
    document.body.append(input);
    expect(paste(TIKZ, input)).toBe(false);
    input.remove();
    expect(st().automata).toHaveLength(1);
  });

  it('a deferred in-app paste runs unless the clipboard turns out to hold LaTeX', () => {
    const inApp = vi.fn();
    deferPaste(inApp);
    paste('not latex');
    vi.runAllTimers();
    expect(inApp).toHaveBeenCalledTimes(1);

    const again = vi.fn();
    deferPaste(again);
    paste(TIKZ);
    vi.runAllTimers();
    expect(again).not.toHaveBeenCalled();
    expect(st().automata).toHaveLength(2);
  });

  it('a deferred in-app paste still runs when no paste event comes', () => {
    const inApp = vi.fn();
    deferPaste(inApp);
    vi.runAllTimers();
    expect(inApp).toHaveBeenCalledTimes(1);
  });
});

describe('which clipboard is newer', () => {
  it('the system one only once the window lost focus after the app last copied', () => {
    expect(systemClipboardMayBeNewer()).toBe(false); // the window hasn't lost the focus yet
    st().copyAutomaton(st().automata[0]?.id ?? '');
    expect(systemClipboardMayBeNewer()).toBe(false);
    window.dispatchEvent(new Event('blur'));
    expect(systemClipboardMayBeNewer()).toBe(true);
    st().select({ states: [st().automata[0]?.states[0]?.id ?? ''], transitions: [] });
    st().copySelection();
    expect(systemClipboardMayBeNewer()).toBe(false);
  });

  it('pasting what the app copied is not a new copy', () => {
    const id = st().automata[0]?.states[0]?.id ?? '';
    st().select({ states: [id], transitions: [] });
    st().copySelection();
    window.dispatchEvent(new Event('blur'));
    st().paste({ x: 0, y: 0 });
    expect(systemClipboardMayBeNewer()).toBe(true);
  });
});
