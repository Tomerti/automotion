import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Automaton } from '../../core/model';
import { runWord } from '../../core/run';
import { moveState } from '../../core/edit';
import { STATE_RADIUS, transitionPolyline } from '../../core/geometry';
import { fixture } from '../../core/testing/fixtures';
import { layoutAutomaton } from '../../layout/layout';
import { appStore, resetAppStore } from '../../store/store';
import { closeRegexDialog, useRegexDialog } from '../shell/regexDialogStore';
import { toastStore } from '../shell/toastStore';
import { Canvas } from './Canvas';
import { fitActive, tidyActive } from './useCanvasEditing';
import { fitToView, fitToViewInset } from './viewport';

// The real layout by default; Tidy tests make it fail or hold it at the await.
vi.mock('../../layout/layout', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../layout/layout')>();
  return { ...real, layoutAutomaton: vi.fn(real.layoutAutomaton) };
});
const layoutMock = vi.mocked(layoutAutomaton);

// jsdom: getBoundingClientRect is all zeros, so at the default viewport world = client coords.
// fixture() places states at x = 100 * index, y = 0.

const st = () => appStore.getState();
const active = (): Automaton => {
  const s = st();
  const a = s.automata.find((x) => x.id === s.activeId);
  if (!a) throw new Error('no active automaton');
  return a;
};

const two = (
  kind: 'DFA' | 'NFA' = 'DFA',
  alphabet = 'ab',
  edges: [string, string, string][] = [],
) => fixture({ kind, alphabet, states: ['q0', 'q1'], edges, name: 'm' });

function load(a: Automaton): void {
  // A stored viewport (the default one) keeps the canvas from fitting on first show.
  resetAppStore({ automata: [a], activeId: a.id });
  st().setViewport(a.id, { x: 0, y: 0, zoom: 1 });
}

const diagram = () => screen.getByTestId('diagram');
const canvas = () => screen.getByTestId('canvas');
const stateEl = (label: string) => screen.getByTestId(`state-${label}`);

type Mods = { shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean };
const at = (x: number, y: number, mods: Mods = {}) => ({
  clientX: x,
  clientY: y,
  pointerId: 1,
  button: 0,
  ...mods,
});

/** Press on `target` at (x, y), optionally move through `path`, release at the last point. */
function drag(
  target: Element,
  from: [number, number],
  path: [number, number][] = [],
  mods: Mods = {},
): void {
  fireEvent.pointerDown(target, at(...from, mods));
  for (const p of path) fireEvent.pointerMove(diagram(), at(...p, mods));
  const end = path[path.length - 1] ?? from;
  fireEvent.pointerUp(diagram(), at(...end, mods));
}

const click = (target: Element, x: number, y: number) => drag(target, [x, y]);

/** Shift-drag from q0's center to the center of the state at `to`. */
function drawEdge(to: [number, number] = [100, 0]): void {
  drag(stateEl('q0'), [0, 0], [[40, 0], to], { shiftKey: true });
}

const toasts = () => toastStore.getState().toasts;

beforeEach(() => resetAppStore());
afterEach(cleanup);

describe('fit on first show', () => {
  afterEach(cleanup);
  it('stores a fitted viewport when none exists', () => {
    const a = two();
    resetAppStore({ automata: [a], activeId: a.id });
    render(<Canvas />);
    const vp = st().viewports.m;
    expect(vp).toBeDefined();
    expect(vp).not.toEqual({ x: 0, y: 0, zoom: 1 });
    expect(vp).toEqual(fitToView(active().states, { width: 800, height: 500 }));
  });
  it('keeps clear of the tutorial card, like Fit', () => {
    const a = two();
    resetAppStore({ automata: [a], activeId: a.id });
    render(
      <div style={{ '--av-tutorial-pad': '120px' } as React.CSSProperties}>
        <Canvas />
      </div>,
    );
    expect(st().viewports.m).toEqual(
      fitToViewInset(active().states, { width: 800, height: 500 }, 0, 120),
    );
  });
  it('leaves an existing viewport alone', () => {
    load(two());
    act(() => st().setViewport('m', { x: 5, y: 6, zoom: 1 }));
    render(<Canvas />);
    expect(st().viewports.m).toEqual({ x: 5, y: 6, zoom: 1 });
  });
});

describe('Canvas editing', () => {
  it('double-click on empty space adds q_0', () => {
    load(fixture({ kind: 'DFA', alphabet: 'a', states: [], name: 'm' }));
    render(<Canvas />);
    fireEvent.doubleClick(diagram(), { clientX: 200, clientY: 150 });
    expect(active().states).toEqual([expect.objectContaining({ label: 'q_0', x: 200, y: 150 })]);
    expect(stateEl('q_0')).toBeInTheDocument();
  });

  it('shows a hint while the automaton has no states', () => {
    load(fixture({ kind: 'DFA', alphabet: 'a', states: [], name: 'm' }));
    render(<Canvas />);
    expect(screen.getByTestId('canvas-hint')).toHaveTextContent(
      'Double-click to add a state · Press ? for controls',
    );
    expect(screen.getByTestId('canvas-hint')).toHaveTextContent(
      'Ctrl+V pastes LaTeX (TikZ) code · Drop a .json / .tex file to import',
    );
    fireEvent.doubleClick(diagram(), { clientX: 200, clientY: 150 });
    expect(screen.queryByTestId('canvas-hint')).toBeNull();
  });

  it('shows no hint on a lesson’s empty automaton', () => {
    load(fixture({ kind: 'DFA', alphabet: 'a', states: [], name: 'm' }));
    act(() => appStore.getState().setLessonIds([appStore.getState().activeId!]));
    render(<Canvas />);
    expect(screen.queryByTestId('canvas-hint')).toBeNull();
  });

  it('the empty canvas offers building from a regex', async () => {
    load(fixture({ kind: 'DFA', alphabet: 'a', states: [], name: 'm' }));
    render(<Canvas />);
    closeRegexDialog();
    await userEvent.setup().click(
      within(screen.getByTestId('canvas-hint')).getByRole('button', {
        name: 'or build one from a regex',
      }),
    );
    expect(useRegexDialog.getState().open).toBe(true);
    closeRegexDialog();
  });

  it('clicking a state selects it; clicking the background clears the selection', () => {
    load(two());
    render(<Canvas />);
    click(stateEl('q1'), 100, 0);
    expect(st().selection).toEqual({ states: ['q1'], transitions: [] });
    expect(stateEl('q1')).toHaveAttribute('data-selected', 'true');
    click(diagram(), 300, 200);
    expect(st().selection).toEqual({ states: [], transitions: [] });
  });

  it('Enter and Space do not toggle accepting or start', () => {
    load(two());
    render(<Canvas />);
    click(stateEl('q1'), 100, 0);
    fireEvent.keyDown(canvas(), { key: 'Enter' });
    fireEvent.keyDown(canvas(), { key: ' ' });
    expect(active().accepting).toEqual([]);
    expect(active().starts).toEqual([]);
  });

  it('S toggles start and A toggles accepting on the selected state', () => {
    load(two());
    render(<Canvas />);
    click(stateEl('q1'), 100, 0);
    fireEvent.keyDown(canvas(), { key: 's' });
    expect(active().starts).toEqual(['q1']);
    fireEvent.keyDown(canvas(), { key: 'a' });
    expect(active().accepting).toEqual(['q1']);
    fireEvent.keyDown(canvas(), { key: 'A' });
    expect(active().accepting).toEqual([]);
    fireEvent.keyDown(canvas(), { key: 'S' });
    expect(active().starts).toEqual([]);
  });

  it('S and A work on a Hebrew layout (the keys type ד and ש)', () => {
    load(two());
    render(<Canvas />);
    click(stateEl('q1'), 100, 0);
    fireEvent.keyDown(canvas(), { key: 'ד', code: 'KeyS' });
    expect(active().starts).toEqual(['q1']);
    fireEvent.keyDown(canvas(), { key: 'ש', code: 'KeyA' });
    expect(active().accepting).toEqual(['q1']);
  });

  it('S and A ignore a selected state that undo removed', () => {
    load(fixture({ kind: 'DFA', alphabet: 'a', states: [], name: 'm' }));
    render(<Canvas />);
    fireEvent.doubleClick(diagram(), { clientX: 10, clientY: 10 });
    click(stateEl('q_0'), 10, 10);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(canvas(), { key: 's' });
    fireEvent.keyDown(canvas(), { key: 'a' });
    expect(active().starts).toEqual([]);
    expect(active().accepting).toEqual([]);
  });

  it('Delete removes the selected state', () => {
    load(two('DFA', 'a', [['q0', 'a', 'q1']]));
    render(<Canvas />);
    click(stateEl('q1'), 100, 0);
    fireEvent.keyDown(canvas(), { key: 'Delete' });
    expect(active().states.map((s) => s.label)).toEqual(['q0']);
    expect(active().transitions).toEqual([]);
    expect(st().selection).toEqual({ states: [], transitions: [] });
  });

  it('Backspace removes the selected edge', () => {
    load(two('DFA', 'a', [['q0', 'a', 'q1']]));
    render(<Canvas />);
    click(screen.getByTestId('edge-q0-q1'), 50, 0);
    expect(st().selection).toEqual({ states: [], transitions: ['q0->q1'] });
    fireEvent.keyDown(canvas(), { key: 'Backspace' });
    expect(active().transitions).toEqual([]);
    expect(active().states).toHaveLength(2);
  });

  it('Shift-dragging from a state to another opens the symbol input; "a, b" creates an edge', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    fireEvent.pointerDown(stateEl('q0'), at(0, 0, { shiftKey: true }));
    fireEvent.pointerMove(diagram(), at(60, 10, { shiftKey: true }));
    expect(screen.getByTestId('rubber-band')).toBeInTheDocument();
    fireEvent.pointerUp(diagram(), at(100, 0));
    // The arrow stays while its symbols are typed.
    expect(screen.getByTestId('rubber-band').querySelector('.av-edge-path')).toHaveAttribute(
      'd',
      'M 24 0 L 76 0',
    );
    const input = screen.getByTestId('symbol-input');
    expect(input).toHaveFocus();
    await user.type(input, 'a, b{Enter}');
    expect(active().transitions).toEqual([
      expect.objectContaining({ from: 'q0', to: 'q1', symbols: ['a', 'b'] }),
    ]);
    expect(screen.queryByTestId('symbol-input')).toBeNull();
    expect(screen.queryByTestId('rubber-band')).toBeNull();
    expect(active().states.map((s) => [s.x, s.y])).toEqual([
      [0, 0],
      [100, 0],
    ]);
  });

  it('a new arrow that would run through a state bends around it, previews included', async () => {
    const user = userEvent.setup();
    // q0, q1, q2 in a row (x = 0, 100, 200), q0 → q1 → q2; then an arrow from q2 back to q0.
    load(
      fixture({
        kind: 'DFA',
        alphabet: 'ab',
        states: ['q0', 'q1', 'q2'],
        edges: [
          ['q0', 'a', 'q1'],
          ['q1', 'a', 'q2'],
        ],
        name: 'm',
      }),
    );
    render(<Canvas />);
    const band = () => screen.getByTestId('rubber-band').querySelector('.av-edge-path');
    fireEvent.pointerDown(stateEl('q2'), at(200, 0, { shiftKey: true }));
    fireEvent.pointerMove(diagram(), at(100, 40, { shiftKey: true }));
    fireEvent.pointerMove(diagram(), at(5, 5, { shiftKey: true }));
    // Over q0: the preview is already the curve the release creates, not a line through q1.
    const preview = band()?.getAttribute('d');
    expect(preview).toMatch(/^M .* Q /);
    fireEvent.pointerUp(diagram(), at(5, 5));
    expect(band()?.getAttribute('d')).toBe(preview);
    await user.type(screen.getByTestId('symbol-input'), 'b{Enter}');
    const created = active().transitions.find((t) => t.from === 'q2' && t.to === 'q0');
    expect(created?.bend).not.toBeUndefined();
    expect(screen.getByTestId('edge-q2-q0').querySelector('.av-edge-path')).toHaveAttribute(
      'd',
      preview,
    );
    // Clear of q1's circle all along.
    const q1 = { x: 100, y: 0 };
    const pts = transitionPolyline(active(), active().states[2]!, active().states[0]!, 32);
    expect(Math.min(...pts.map((p) => Math.hypot(p.x - q1.x, p.y - q1.y)))).toBeGreaterThan(
      STATE_RADIUS,
    );
  });

  it('Shift-dragging from a state back onto itself draws a self-loop', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    drag(
      stateEl('q0'),
      [0, 0],
      [
        [60, -40],
        [5, 5],
      ],
      { shiftKey: true },
    );
    await user.type(screen.getByTestId('symbol-input'), 'a{Enter}');
    expect(active().transitions).toEqual([
      expect.objectContaining({ from: 'q0', to: 'q0', symbols: ['a'] }),
    ]);
  });

  it('the rubber band is an arrow that previews the edge, or a self-loop over its own state', () => {
    load(two());
    render(<Canvas />);
    fireEvent.pointerDown(stateEl('q0'), at(0, 0, { shiftKey: true }));
    fireEvent.pointerMove(diagram(), at(60, 40, { shiftKey: true }));
    const band = () => screen.getByTestId('rubber-band');
    const path = () => band().querySelector('.av-edge-path')?.getAttribute('d');
    const head = () => band().querySelector('.av-edge-head')?.getAttribute('transform');
    expect(band()).toHaveAttribute('data-loop', 'false');
    expect(head()).toBe('translate(60 40) rotate(33.690067525979785)');
    // Over another state: the arrow ends on its circle, as the created edge will.
    fireEvent.pointerMove(diagram(), at(105, 5, { shiftKey: true }));
    expect(path()).toBe('M 24 0 L 76 0');
    // Back over the source state: the self-loop the release would create.
    fireEvent.pointerMove(diagram(), at(5, 5, { shiftKey: true }));
    expect(band()).toHaveAttribute('data-loop', 'true');
    expect(path()).toMatch(/^M .* C /);
    fireEvent.pointerUp(diagram(), at(5, 5));
    expect(band()).toHaveAttribute('data-loop', 'true');
  });

  it('the new arrow goes away when its symbol input is cancelled or loses focus', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    drawEdge([100, 0]);
    expect(screen.getByTestId('rubber-band')).toBeInTheDocument();
    await user.type(screen.getByTestId('symbol-input'), 'a{Escape}');
    expect(screen.queryByTestId('rubber-band')).toBeNull();
    drawEdge([100, 0]);
    act(() => screen.getByTestId('symbol-input').blur());
    expect(screen.queryByTestId('rubber-band')).toBeNull();
  });

  it('releasing the rubber band on empty space opens nothing', () => {
    load(two());
    render(<Canvas />);
    drawEdge([300, 200]);
    expect(screen.queryByTestId('symbol-input')).toBeNull();
    expect(screen.queryByTestId('rubber-band')).toBeNull();
  });

  it('the alphabet follows the symbols on the edges, in one undo step', async () => {
    const user = userEvent.setup();
    load(two('DFA', 'a', [['q1', 'a', 'q0']]));
    render(<Canvas />);
    drawEdge();
    await user.type(screen.getByTestId('symbol-input'), 'c{Enter}');
    expect(active().alphabet).toEqual(['a', 'c']);
    expect(active().transitions[1]?.symbols).toEqual(['c']);
    act(() => st().undo());
    expect(active().alphabet).toEqual(['a']);
    expect(active().transitions).toHaveLength(1);
  });

  it('a new edge onto an existing one edits that arrow’s symbols in place', async () => {
    const user = userEvent.setup();
    load(two('NFA', 'ab', [['q0', 'a', 'q1']]));
    render(<Canvas />);
    drawEdge();
    // No second arrow and input on top of the first: its own label turns into the input,
    // with what it reads already there, set as drawn (no space: the symbol font is a monospace).
    expect(screen.queryByTestId('rubber-band')).toBeNull();
    expect(screen.getByTestId('edge-q0-q1')).toHaveAttribute('data-editing', 'true');
    const input = screen.getByTestId('symbol-input');
    expect(input).toHaveValue('a,');
    await user.type(input, 'b, a{Enter}');
    expect(active().transitions).toEqual([
      expect.objectContaining({ id: 'q0->q1', symbols: ['a', 'b'] }),
    ]);
  });

  it('a new self-loop onto an existing one edits that loop, and Escape leaves it as it was', async () => {
    const user = userEvent.setup();
    load(two('DFA', 'a', [['q0', 'a', 'q0']]));
    render(<Canvas />);
    drag(
      stateEl('q0'),
      [0, 0],
      [
        [60, -40],
        [5, 5],
      ],
      { shiftKey: true },
    );
    expect(screen.getByTestId('edge-q0-q0')).toHaveAttribute('data-editing', 'true');
    await user.type(screen.getByTestId('symbol-input'), 'b{Escape}');
    expect(active().transitions).toEqual([
      expect.objectContaining({ id: 'q0->q0', symbols: ['a'] }),
    ]);
  });

  it('an invalid symbol shows the parse error and keeps the input open', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    drawEdge();
    await user.type(screen.getByTestId('symbol-input'), 'ab{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Symbols must be single characters: ab');
    expect(screen.getByTestId('symbol-input')).toBeInTheDocument();
    expect(active().transitions).toEqual([]);
  });

  it('typing \\eps turns into ε at the next key', async () => {
    const user = userEvent.setup();
    load(two('NFA'));
    render(<Canvas />);
    drawEdge();
    const input = screen.getByTestId('symbol-input');
    await user.type(input, 'a, \\eps');
    // It may still become \epsilon.
    expect(input).toHaveValue('a, \\eps');
    await user.type(input, ',');
    expect(input).toHaveValue('a, ε,');
    await user.type(input, ' b{Enter}');
    expect(active().transitions[0]?.symbols).toEqual(['a', 'ε', 'b']);
  });

  it('typing \\epsilon key by key gives ε, not εilon', async () => {
    const user = userEvent.setup();
    load(two('NFA'));
    render(<Canvas />);
    drawEdge();
    const input = screen.getByTestId('symbol-input');
    await user.type(input, 'a,\\epsilon');
    expect(input).toHaveValue('a,ε');
    await user.type(input, '{Enter}');
    expect(active().transitions[0]?.symbols).toEqual(['a', 'ε']);
  });

  it('a rewrite in the middle of the symbols keeps the caret where typing left it', async () => {
    const user = userEvent.setup();
    load(two('NFA'));
    render(<Canvas />);
    drawEdge();
    const input = screen.getByTestId<HTMLInputElement>('symbol-input');
    await user.type(input, 'ab');
    await user.type(input, '\\eps,X', { initialSelectionStart: 1, initialSelectionEnd: 1 });
    expect(input).toHaveValue('aε,Xb');
  });

  it('Enter right after \\eps commits ε', async () => {
    const user = userEvent.setup();
    load(two('NFA'));
    render(<Canvas />);
    drawEdge();
    await user.type(screen.getByTestId('symbol-input'), '\\eps{Enter}');
    expect(active().transitions[0]?.symbols).toEqual(['ε']);
  });

  it('ε on a DFA edge switches the automaton to an NFA with a toast', async () => {
    const user = userEvent.setup();
    toastStore.setState({ toasts: [] });
    load(two());
    render(<Canvas />);
    drawEdge();
    await user.type(screen.getByTestId('symbol-input'), 'eps{Enter}');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(active().kind).toBe('NFA');
    expect(active().transitions[0]?.symbols).toEqual(['ε']);
    expect(toasts()).toEqual([
      expect.objectContaining({
        message: 'Switched to NFA: ε-transitions need an NFA',
        kind: 'info',
      }),
    ]);
    act(() => st().undo());
    expect(active().kind).toBe('DFA');
    expect(active().transitions).toEqual([]);
  });

  it('ε on an NFA edge switches nothing and shows no toast', async () => {
    const user = userEvent.setup();
    toastStore.setState({ toasts: [] });
    load(two('NFA'));
    render(<Canvas />);
    drawEdge();
    await user.type(screen.getByTestId('symbol-input'), 'ε{Enter}');
    expect(active().transitions[0]?.symbols).toEqual(['ε']);
    expect(toasts()).toEqual([]);
  });

  it('an empty symbol list or Escape cancels the new edge', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    drawEdge();
    await user.type(screen.getByTestId('symbol-input'), ' {Enter}');
    expect(screen.queryByTestId('symbol-input')).toBeNull();
    drawEdge();
    await user.type(screen.getByTestId('symbol-input'), 'a{Escape}');
    expect(screen.queryByTestId('symbol-input')).toBeNull();
    expect(active().transitions).toEqual([]);
    expect(st().history.m?.past ?? []).toHaveLength(0);
  });

  it('double-click a state renames it; a duplicate label is refused', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    fireEvent.doubleClick(stateEl('q0'), { clientX: 0, clientY: 0 });
    const input = screen.getByTestId('rename-input');
    expect(input).toHaveValue('q0');
    await user.clear(input);
    await user.type(input, 'q1{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Two states are named q1');
    expect(screen.getByTestId('rename-input')).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, 'start{Enter}');
    expect(active().states[0]?.label).toBe('start');
    expect(screen.queryByTestId('rename-input')).toBeNull();
  });

  it('double-click a state opens its name selected, so typing replaces it', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    fireEvent.doubleClick(stateEl('q0'), { clientX: 0, clientY: 0 });
    const input = screen.getByTestId<HTMLInputElement>('rename-input');
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 2]);
    await user.keyboard('even{Enter}');
    expect(active().states[0]?.label).toBe('even');
  });

  it('typing \\emptyset in a state name turns into ∅', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    fireEvent.doubleClick(stateEl('q0'), { clientX: 0, clientY: 0 });
    const input = screen.getByTestId('rename-input');
    await user.clear(input);
    await user.type(input, '\\emptyse');
    expect(input).toHaveValue('\\emptyse');
    await user.type(input, 't');
    expect(input).toHaveValue('∅');
    await user.type(input, '{Enter}');
    expect(active().states[0]?.label).toBe('∅');
  });

  it('the rename input sits on the state in its label font and hides the drawn label', () => {
    load(two());
    st().setViewport('m', { x: 10, y: 20, zoom: 2 });
    render(<Canvas />);
    fireEvent.doubleClick(stateEl('q1'), { clientX: 210, clientY: 20 });
    const box = screen.getByTestId('rename-input').parentElement as HTMLElement;
    expect(box).toHaveClass('av-inline');
    expect(box.style).toMatchObject({ left: '210px', top: '20px', fontSize: '30px' });
    expect(stateEl('q1')).toHaveAttribute('data-editing', 'true');
    expect(stateEl('q0')).not.toHaveAttribute('data-editing');
  });

  it('the symbol input for a new edge or self-loop sits where its label will be drawn', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    for (const [to, edge] of [
      [[100, 0], 'edge-q0-q1'],
      [[5, 5], 'edge-q0-q0'],
    ] as const) {
      drawEdge([...to]);
      const box = screen.getByTestId('symbol-input').parentElement as HTMLElement;
      const at = [box.style.left, box.style.top];
      await user.type(screen.getByTestId('symbol-input'), 'a{Enter}');
      const label = within(screen.getByTestId(edge)).getByTestId('edge-label');
      expect(at).toEqual([`${label.getAttribute('x')}px`, `${label.getAttribute('y')}px`]);
    }
  });

  it('the rename input commits on blur; a duplicate name on blur is dropped', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    fireEvent.doubleClick(stateEl('q0'), { clientX: 0, clientY: 0 });
    await user.type(screen.getByTestId('rename-input'), 'x');
    act(() => screen.getByTestId('rename-input').blur());
    expect(screen.queryByTestId('rename-input')).toBeNull();
    expect(active().states[0]?.label).toBe('q0x');

    fireEvent.doubleClick(stateEl('q0x'), { clientX: 0, clientY: 0 });
    const input = screen.getByTestId('rename-input');
    await user.clear(input);
    await user.type(input, 'q1');
    act(() => input.blur());
    expect(screen.queryByTestId('rename-input')).toBeNull();
    expect(active().states.map((s) => s.label)).toEqual(['q0x', 'q1']);
  });

  it('a new edge typed and then left by blur is created', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    drawEdge();
    await user.type(screen.getByTestId('symbol-input'), 'b');
    act(() => screen.getByTestId('symbol-input').blur());
    expect(active().transitions).toEqual([expect.objectContaining({ symbols: ['b'] })]);
  });

  it('double-click an edge label replaces its symbols; empty deletes the edge', async () => {
    const user = userEvent.setup();
    load(two('DFA', 'ab', [['q0', 'ab', 'q1']]));
    render(<Canvas />);
    const label = () => within(screen.getByTestId('edge-q0-q1')).getByTestId('edge-label');
    fireEvent.doubleClick(label(), { clientX: 50, clientY: -14 });
    const input = screen.getByTestId('symbol-input');
    expect(input).toHaveValue('a,b'); // as the label draws it
    await user.clear(input);
    await user.type(input, 'b{Enter}');
    expect(active().transitions[0]?.symbols).toEqual(['b']);
    fireEvent.doubleClick(label(), { clientX: 50, clientY: -14 });
    await user.clear(screen.getByTestId('symbol-input'));
    await user.keyboard('{Enter}');
    expect(active().transitions).toEqual([]);
  });

  it('captures the pointer only once a press becomes a drag', () => {
    load(two());
    render(<Canvas />);
    const capture = vi.fn();
    Object.assign(diagram(), { setPointerCapture: capture });
    click(stateEl('q1'), 100, 0);
    click(diagram(), 300, 200);
    expect(capture).not.toHaveBeenCalled();
    drag(stateEl('q1'), [100, 0], [[110, 0]]);
    expect(capture).toHaveBeenCalledWith(1);
  });

  // Chromium delivers dblclick to the <svg> when the pointer was captured; hit-test geometrically.
  it('a double-click delivered to the svg over a state renames it instead of adding a state', () => {
    load(two());
    render(<Canvas />);
    fireEvent.doubleClick(diagram(), { clientX: 3, clientY: 2 });
    expect(screen.getByTestId('rename-input')).toHaveValue('q0');
    expect(active().states).toHaveLength(2);
  });

  it('a double-click delivered to the svg over an edge label edits its symbols', () => {
    load(two('DFA', 'ab', [['q0', 'ab', 'q1']]));
    render(<Canvas />);
    fireEvent.doubleClick(diagram(), { clientX: 52, clientY: -12 });
    expect(screen.getByTestId('symbol-input')).toHaveValue('a,b');
    expect(active().states).toHaveLength(2);
  });

  it('the state context menu sets start, toggles accepting, renames and deletes', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    const menuOn = (label: string) => {
      fireEvent.contextMenu(stateEl(label), { clientX: 100, clientY: 0 });
      return screen.getByRole('menu');
    };
    const items = within(menuOn('q1')).getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual([
      'Set as start',
      'Toggle accepting',
      'Rename',
      'Cut',
      'Copy',
      'Delete',
    ]);
    await user.click(screen.getByRole('menuitem', { name: 'Set as start' }));
    expect(active().starts).toEqual(['q1']);
    expect(screen.queryByRole('menu')).toBeNull();
    menuOn('q1');
    await user.click(screen.getByRole('menuitem', { name: 'Toggle accepting' }));
    expect(active().accepting).toEqual(['q1']);
    menuOn('q1');
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const input = screen.getByTestId('rename-input');
    expect(input).toHaveFocus();
    await user.type(input, 'x{Enter}');
    expect(active().states[1]?.label).toBe('q1x');
    menuOn('q1x');
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(active().states.map((s) => s.id)).toEqual(['q0']);
  });

  it('Straighten in the edge menu straightens a bent edge and resets a self-loop', async () => {
    const user = userEvent.setup();
    const a = two('DFA', 'ab', [
      ['q0', 'a', 'q1'],
      ['q1', 'b', 'q1'],
    ]);
    load({
      ...a,
      transitions: a.transitions.map((t) =>
        t.from === t.to ? { ...t, loopAngle: 1 } : { ...t, bend: 30 },
      ),
    });
    render(<Canvas />);
    fireEvent.contextMenu(screen.getByTestId('edge-q0-q1'), { clientX: 50, clientY: -30 });
    await user.click(screen.getByRole('menuitem', { name: 'Straighten' }));
    expect(active().transitions[0]?.bend).toBe(0);
    fireEvent.contextMenu(screen.getByTestId('edge-q1-q1'), { clientX: 100, clientY: -60 });
    await user.click(screen.getByRole('menuitem', { name: 'Straighten' }));
    expect(active().transitions[1]).not.toHaveProperty('loopAngle');
  });

  it('Label on other side in the edge menu flips the label, as one undo step; loops have none', async () => {
    const user = userEvent.setup();
    const a = two('DFA', 'ab', [
      ['q0', 'a', 'q1'],
      ['q1', 'b', 'q1'],
    ]);
    // Bent down: the automatic label is below (right of q0 → q1).
    load({
      ...a,
      transitions: a.transitions.map((t) => (t.from === t.to ? t : { ...t, bend: -30 })),
    });
    render(<Canvas />);
    const flip = async () => {
      fireEvent.contextMenu(screen.getByTestId('edge-q0-q1'), { clientX: 50, clientY: 30 });
      await user.click(screen.getByRole('menuitem', { name: 'Label on other side' }));
    };
    await flip();
    expect(active().transitions[0]?.labelSide).toBe('left');
    expect(st().history.m?.past).toHaveLength(1);
    await flip();
    expect(active().transitions[0]?.labelSide).toBe('right');

    fireEvent.contextMenu(screen.getByTestId('edge-q1-q1'), { clientX: 100, clientY: -60 });
    expect(screen.queryByRole('menuitem', { name: 'Label on other side' })).toBeNull();
  });

  it('the edge context menu edits symbols and deletes; Escape and outside clicks close it', async () => {
    const user = userEvent.setup();
    load(two('DFA', 'ab', [['q0', 'a', 'q1']]));
    render(<Canvas />);
    const edge = () => screen.getByTestId('edge-q0-q1');
    fireEvent.contextMenu(edge(), { clientX: 50, clientY: 0 });
    expect(
      within(screen.getByRole('menu'))
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['Edit symbols', 'Label on other side', 'Straighten', 'Delete']);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.contextMenu(edge(), { clientX: 50, clientY: 0 });
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.contextMenu(edge(), { clientX: 50, clientY: 0 });
    await user.click(screen.getByRole('menuitem', { name: 'Edit symbols' }));
    const input = screen.getByTestId('symbol-input');
    await user.clear(input);
    await user.type(input, 'b{Enter}');
    expect(active().transitions[0]?.symbols).toEqual(['b']);

    fireEvent.contextMenu(edge(), { clientX: 50, clientY: 0 });
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(active().transitions).toEqual([]);
  });

  it('a state drag moves it and undoes in one step', () => {
    load(two());
    render(<Canvas />);
    drag(
      stateEl('q1'),
      [105, 5],
      [
        [130, 15],
        [160, 25],
        [205, 45],
      ],
    );
    expect(active().states[1]).toMatchObject({ x: 200, y: 40 });
    expect(st().history.m?.past).toHaveLength(1);
    act(() => st().undo());
    expect(active().states[1]).toMatchObject({ x: 100, y: 0 });
  });

  it('a press on a state without movement records no history', () => {
    load(two());
    render(<Canvas />);
    drag(stateEl('q1'), [100, 0], [[101, 1]]);
    expect(active().states[1]).toMatchObject({ x: 100, y: 0 });
    expect(st().history.m?.past ?? []).toHaveLength(0);
  });

  it('marks the svg as dragging only during a drag', () => {
    load(two());
    render(<Canvas />);
    fireEvent.pointerDown(stateEl('q1'), at(100, 0));
    fireEvent.pointerMove(diagram(), at(150, 0));
    expect(diagram()).toHaveAttribute('data-dragging');
    fireEvent.pointerUp(diagram(), at(150, 0));
    expect(diagram()).not.toHaveAttribute('data-dragging');
  });

  it('Ctrl+Z and Ctrl+Shift+Z / Ctrl+Y undo and redo, but not inside an input', () => {
    load(fixture({ kind: 'DFA', alphabet: 'a', states: [], name: 'm' }));
    render(<Canvas />);
    fireEvent.doubleClick(diagram(), { clientX: 10, clientY: 10 });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(active().states).toHaveLength(0);
    fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true });
    expect(active().states).toHaveLength(1);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    expect(active().states).toHaveLength(1);
    fireEvent.doubleClick(stateEl('q_0'), { clientX: 10, clientY: 10 });
    fireEvent.keyDown(screen.getByTestId('rename-input'), { key: 'z', ctrlKey: true });
    expect(active().states).toHaveLength(1);
  });

  it('undo and redo work on a Hebrew layout, but not with Alt (AltGr is Ctrl+Alt)', () => {
    load(fixture({ kind: 'DFA', alphabet: 'a', states: [], name: 'm' }));
    render(<Canvas />);
    fireEvent.doubleClick(diagram(), { clientX: 10, clientY: 10 });
    fireEvent.keyDown(window, { key: 'ז', code: 'KeyZ', ctrlKey: true, altKey: true });
    expect(active().states).toHaveLength(1);
    fireEvent.keyDown(window, { key: 'ז', code: 'KeyZ', ctrlKey: true });
    expect(active().states).toHaveLength(0);
    fireEvent.keyDown(window, { key: 'ט', code: 'KeyY', ctrlKey: true });
    expect(active().states).toHaveLength(1);
    fireEvent.keyDown(window, { key: 'ז', code: 'KeyZ', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'Z', code: 'KeyZ', ctrlKey: true, shiftKey: true });
    expect(active().states).toHaveLength(1);
  });

  it('keys typed into an inline input do not edit the selection', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    click(stateEl('q1'), 100, 0);
    fireEvent.doubleClick(stateEl('q1'), { clientX: 100, clientY: 0 });
    await user.type(screen.getByTestId('rename-input'), 'sa{Backspace}');
    expect(active().starts).toEqual([]);
    expect(active().accepting).toEqual([]);
    expect(active().states).toHaveLength(2);
  });

  it('closing the rename input with Enter or Escape refocuses the canvas for S/A/Delete', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    click(stateEl('q1'), 100, 0);
    fireEvent.doubleClick(stateEl('q1'), { clientX: 100, clientY: 0 });
    await user.type(screen.getByTestId('rename-input'), 'x{Enter}');
    expect(screen.queryByTestId('rename-input')).toBeNull();
    expect(canvas()).toHaveFocus();
    await user.keyboard('a');
    expect(active().accepting).toEqual(['q1']);

    fireEvent.doubleClick(stateEl('q1x'), { clientX: 100, clientY: 0 });
    await user.type(screen.getByTestId('rename-input'), '{Escape}');
    expect(screen.queryByTestId('rename-input')).toBeNull();
    expect(canvas()).toHaveFocus();
    await user.keyboard('s');
    expect(active().starts).toEqual(['q1']);
  });

  it('closing the symbol input refocuses the canvas', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    drawEdge();
    await user.type(screen.getByTestId('symbol-input'), 'a{Enter}');
    expect(screen.queryByTestId('symbol-input')).toBeNull();
    expect(canvas()).toHaveFocus();
  });

  it('choosing a context-menu item or pressing Escape refocuses the canvas', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    fireEvent.contextMenu(stateEl('q1'), { clientX: 100, clientY: 0 });
    await user.click(screen.getByRole('menuitem', { name: 'Toggle accepting' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(canvas()).toHaveFocus();
    await user.keyboard('s');
    expect(active().starts).toEqual(['q1']);

    (document.activeElement as HTMLElement).blur();
    fireEvent.contextMenu(stateEl('q1'), { clientX: 100, clientY: 0 });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(canvas()).toHaveFocus();
  });

  it('dragging the background pans; the wheel zooms by 1.1 per notch at the pointer', () => {
    load(two());
    render(<Canvas />);
    drag(
      diagram(),
      [10, 10],
      [
        [20, 15],
        [40, 30],
      ],
    );
    expect(st().viewports.m).toEqual({ x: 30, y: 20, zoom: 1 });
    fireEvent.wheel(canvas(), { deltaY: -100, clientX: 30, clientY: 20 });
    expect(st().viewports.m?.zoom).toBeCloseTo(1.1);
    expect(st().viewports.m?.x).toBeCloseTo(30);
    expect(st().viewports.m?.y).toBeCloseTo(20);
    fireEvent.wheel(canvas(), { deltaY: 100, clientX: 30, clientY: 20 });
    expect(st().viewports.m?.zoom).toBeCloseTo(1);
  });

  it('a plain drag from the rim of a state moves it (no draw gesture, no rubber band)', () => {
    load(two());
    render(<Canvas />);
    fireEvent.pointerDown(stateEl('q0'), at(28, 0));
    fireEvent.pointerMove(diagram(), at(60, 40));
    expect(screen.queryByTestId('rubber-band')).toBeNull();
    fireEvent.pointerUp(diagram(), at(60, 40));
    expect(active().states[0]).toMatchObject({ x: 32, y: 40 });
    expect(screen.queryByTestId('symbol-input')).toBeNull();
    expect(active().transitions).toEqual([]);
  });

  it('holding Space and dragging a state still moves it (no Space panning)', () => {
    load(two());
    render(<Canvas />);
    fireEvent.keyDown(window, { key: ' ' });
    drag(stateEl('q1'), [100, 0], [[150, 30]]);
    fireEvent.keyUp(window, { key: ' ' });
    expect(active().states[1]).toMatchObject({ x: 150, y: 30 });
    expect(st().viewports.m).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('dragging an edge bends it through the pointer, in one undo step', () => {
    load(two('DFA', 'a', [['q0', 'a', 'q1']]));
    render(<Canvas />);
    const edge = screen.getByTestId('edge-q0-q1');
    fireEvent.pointerDown(edge, at(50, 0));
    fireEvent.pointerMove(diagram(), at(50, -20));
    fireEvent.pointerMove(diagram(), at(60, -40));
    // Positive bends go left of q0 → q1, i.e. up on screen.
    expect(active().transitions[0]?.bend).toBeCloseTo(40);
    fireEvent.pointerUp(diagram(), at(60, -40));
    expect(st().selection).toEqual({ states: [], transitions: ['q0->q1'] });
    expect(st().history.m?.past).toHaveLength(1);
    act(() => st().undo());
    expect(active().transitions[0]).not.toHaveProperty('bend');
  });

  it('a dragged edge snaps straight within 6 screen px', () => {
    load(two('DFA', 'a', [['q0', 'a', 'q1']]));
    st().setViewport('m', { x: 0, y: 0, zoom: 2 });
    render(<Canvas />);
    // World q1 is at screen (200, 0) now; the press grabs the edge where it is (bend 0).
    drag(
      screen.getByTestId('edge-q0-q1'),
      [100, 0],
      [
        [100, 40],
        [100, 11],
      ],
    );
    expect(active().transitions[0]?.bend).toBeCloseTo(-5.5);
    drag(
      screen.getByTestId('edge-q0-q1'),
      [100, 11],
      [
        [100, 40],
        [100, 2],
      ],
    );
    expect(active().transitions[0]?.bend).toBe(0);
  });

  it('dragging an edge keeps the grab point: an already bent edge does not jump', () => {
    const a = two('DFA', 'a', [['q0', 'a', 'q1']]);
    load({ ...a, transitions: a.transitions.map((t) => ({ ...t, bend: 30 })) });
    render(<Canvas />);
    // Grab the label (14 px beyond the apex) and move it up by 10.
    drag(
      screen.getByTestId('edge-q0-q1'),
      [50, -44],
      [
        [50, -50],
        [50, -54],
      ],
    );
    expect(active().transitions[0]?.bend).toBeCloseTo(40);
  });

  it('dragging an edge label moves it to the side of the arrow the pointer is on, in one undo step', () => {
    load(two('DFA', 'a', [['q0', 'a', 'q1']]));
    render(<Canvas />);
    const label = () => within(screen.getByTestId('edge-q0-q1')).getByTestId('edge-label');
    expect(Number(label().getAttribute('y'))).toBeCloseTo(-14);
    fireEvent.pointerDown(label(), at(50, -14));
    // Still above the arrow: nothing changes yet.
    fireEvent.pointerMove(diagram(), at(50, -4));
    expect(active().transitions[0]).not.toHaveProperty('labelSide');
    fireEvent.pointerMove(diagram(), at(52, 9));
    expect(active().transitions[0]?.labelSide).toBe('right');
    expect(Number(label().getAttribute('y'))).toBeCloseTo(14);
    fireEvent.pointerMove(diagram(), at(52, -9));
    fireEvent.pointerMove(diagram(), at(52, 12));
    fireEvent.pointerUp(diagram(), at(52, 12));
    expect(active().transitions[0]?.labelSide).toBe('right');
    // The arrow itself is not bent.
    expect(active().transitions[0]).not.toHaveProperty('bend');
    expect(st().selection).toEqual({ states: [], transitions: ['q0->q1'] });
    expect(st().history.m?.past).toHaveLength(1);
    act(() => st().undo());
    expect(active().transitions[0]).not.toHaveProperty('labelSide');
  });

  it('a label dragged along its own side records no history', () => {
    load(two('DFA', 'a', [['q0', 'a', 'q1']]));
    render(<Canvas />);
    const label = within(screen.getByTestId('edge-q0-q1')).getByTestId('edge-label');
    drag(label, [50, -14], [[70, -30]]);
    expect(active().transitions[0]).not.toHaveProperty('labelSide');
    expect(st().history.m?.past ?? []).toHaveLength(0);
  });

  it('on a bent edge the label moves inside the curve, and dragging the arrow still bends it', () => {
    const a = two('DFA', 'a', [['q0', 'a', 'q1']]);
    load({ ...a, transitions: a.transitions.map((t) => ({ ...t, bend: 40 })) });
    render(<Canvas />);
    const label = within(screen.getByTestId('edge-q0-q1')).getByTestId('edge-label');
    // Between the chord and the apex (40 up) is the inside of the curve.
    drag(
      label,
      [50, -54],
      [
        [50, -40],
        [50, -20],
      ],
    );
    expect(active().transitions[0]).toMatchObject({ bend: 40, labelSide: 'right' });
    drag(
      screen.getByTestId('edge-q0-q1'),
      [50, -40],
      [
        [50, -50],
        [50, -60],
      ],
    );
    expect(active().transitions[0]).toMatchObject({ labelSide: 'right' });
    expect(active().transitions[0]?.bend).toBeCloseTo(60);
  });

  it("dragging a self-loop's label still rotates the loop", () => {
    load(two('DFA', 'a', [['q0', 'a', 'q0']]));
    render(<Canvas />);
    const label = within(screen.getByTestId('edge-q0-q0')).getByTestId('edge-label');
    drag(
      label,
      [0, -80],
      [
        [40, -60],
        [80, 0],
      ],
    );
    expect(active().transitions[0]?.loopAngle).toBeCloseTo(0);
    expect(active().transitions[0]).not.toHaveProperty('labelSide');
  });

  it('dragging a self-loop rotates it toward the pointer', () => {
    load(two('DFA', 'a', [['q0', 'a', 'q0']]));
    render(<Canvas />);
    drag(
      screen.getByTestId('edge-q0-q0'),
      [0, -60],
      [
        [30, -60],
        [80, 0],
      ],
    );
    expect(active().transitions[0]?.loopAngle).toBeCloseTo(0);
    drag(
      screen.getByTestId('edge-q0-q0'),
      [60, 0],
      [
        [60, 30],
        [0, 70],
      ],
    );
    expect(active().transitions[0]?.loopAngle).toBeCloseTo(Math.PI / 2);
    expect(st().history.m?.past).toHaveLength(2);
  });

  it('a dragged self-loop snaps to 45° unless Alt is held', () => {
    load(two('DFA', 'a', [['q0', 'a', 'q0']]));
    render(<Canvas />);
    // Up round to just off down-right: snaps to 45°.
    drag(
      screen.getByTestId('edge-q0-q0'),
      [0, -60],
      [
        [40, -40],
        [60, 55],
      ],
    );
    expect(active().transitions[0]?.loopAngle).toBeCloseTo(Math.PI / 4);
    // On round to just off straight down, with Alt: kept as dragged.
    drag(
      screen.getByTestId('edge-q0-q0'),
      [42, 42],
      [
        [30, 50],
        [5, 80],
      ],
      { altKey: true },
    );
    expect(active().transitions[0]?.loopAngle).toBeCloseTo(Math.atan2(80, 5));
  });

  it('dragging the start arrow turns it around its state, snapping to 45° unless Alt is held', () => {
    load({ ...two(), starts: ['q0'] });
    render(<Canvas />);
    const arrow = () => screen.getByTestId('start-arrow');
    // From the left round to just off straight up: snaps to up.
    drag(
      arrow(),
      [-40, 0],
      [
        [-40, -30],
        [5, -80],
      ],
    );
    expect(active().states[0]?.startAngle).toBeCloseTo(-Math.PI / 2);
    expect(active().states[0]).toMatchObject({ x: 0, y: 0 });
    expect(st().selection).toEqual({ states: ['q0'], transitions: [] });
    // Round to the right, with Alt: kept as dragged.
    drag(
      arrow(),
      [0, -40],
      [
        [30, -30],
        [80, 5],
      ],
      { altKey: true },
    );
    expect(active().states[0]?.startAngle).toBeCloseTo(Math.atan2(5, 80));
    expect(st().history.m?.past).toHaveLength(2);
  });

  it('the state menu turns a turned start arrow back to the left', async () => {
    const user = userEvent.setup();
    const a = two();
    load({
      ...a,
      starts: ['q0'],
      states: a.states.map((s) => (s.id === 'q0' ? { ...s, startAngle: 0 } : s)),
    });
    render(<Canvas />);
    fireEvent.contextMenu(stateEl('q1'), { clientX: 100, clientY: 0 });
    expect(screen.queryByRole('menuitem', { name: 'Start arrow from the left' })).toBeNull();
    fireEvent.contextMenu(stateEl('q0'), { clientX: 0, clientY: 0 });
    await user.click(screen.getByRole('menuitem', { name: 'Start arrow from the left' }));
    expect(active().states[0]).not.toHaveProperty('startAngle');
  });

  it('a dragged state snaps to another state’s x and y with dashed guides', () => {
    load(two());
    render(<Canvas />);
    fireEvent.pointerDown(stateEl('q1'), at(100, 0));
    fireEvent.pointerMove(diagram(), at(205, 6));
    expect(active().states[1]).toMatchObject({ x: 205, y: 0 });
    const guides = () => screen.queryAllByTestId('snap-guide');
    expect(guides()).toHaveLength(1);
    expect(guides()[0]).toHaveClass('av-snap-guide');
    // Horizontal, spanning both states.
    expect(guides()[0]).toHaveAttribute('y1', '0');
    expect(guides()[0]).toHaveAttribute('y2', '0');
    expect(Number(guides()[0]?.getAttribute('x1'))).toBeLessThan(0);
    expect(Number(guides()[0]?.getAttribute('x2'))).toBeGreaterThan(205);

    fireEvent.pointerMove(diagram(), at(-7, 100));
    expect(active().states[1]).toMatchObject({ x: 0, y: 100 });
    expect(guides()).toHaveLength(1);
    expect(guides()[0]).toHaveAttribute('x1', '0');

    fireEvent.pointerMove(diagram(), at(5, -4));
    expect(active().states[1]).toMatchObject({ x: 0, y: 0 });
    expect(guides()).toHaveLength(2);

    fireEvent.pointerMove(diagram(), at(150, 50));
    expect(guides()).toHaveLength(0);
    fireEvent.pointerMove(diagram(), at(205, 6));
    fireEvent.pointerUp(diagram(), at(205, 6));
    expect(guides()).toHaveLength(0);
  });

  it('a dragged state snaps to an equal gap along a row, marking the equal gaps', () => {
    load(fixture({ kind: 'DFA', alphabet: 'a', states: ['q0', 'q1', 'q2'], name: 'm' }));
    render(<Canvas />);
    const gaps = () => screen.queryAllByTestId('gap-guide');
    fireEvent.pointerDown(stateEl('q2'), at(200, 0));
    fireEvent.pointerMove(diagram(), at(150, 60));
    expect(gaps()).toHaveLength(0);
    fireEvent.pointerMove(diagram(), at(205, 3));
    expect(active().states[2]).toMatchObject({ x: 200, y: 0 });
    expect(gaps()).toHaveLength(2);
    expect(gaps()[0]).toHaveClass('av-gap-guide');
    // Alt places freely, without markers.
    fireEvent.pointerMove(diagram(), at(205, 3, { altKey: true }));
    expect(active().states[2]).toMatchObject({ x: 205, y: 3 });
    expect(gaps()).toHaveLength(0);
    fireEvent.pointerMove(diagram(), at(205, 3));
    fireEvent.pointerUp(diagram(), at(205, 3));
    expect(gaps()).toHaveLength(0);
  });

  it('snapping works in screen px under zoom, and Alt turns it off', () => {
    load(two());
    st().setViewport('m', { x: 0, y: 0, zoom: 2 });
    render(<Canvas />);
    // 6 world px off q0's y is 12 screen px at zoom 2, too far to snap; 3 world px (6 screen) snaps.
    drag(stateEl('q1'), [200, 0], [[400, 12]]);
    expect(active().states[1]).toMatchObject({ x: 200, y: 6 });
    drag(stateEl('q1'), [400, 12], [[400, 6]]);
    expect(active().states[1]).toMatchObject({ x: 200, y: 0 });
    fireEvent.pointerDown(stateEl('q1'), at(400, 0));
    fireEvent.pointerMove(diagram(), at(400, 6, { altKey: true }));
    expect(active().states[1]).toMatchObject({ x: 200, y: 3 });
    expect(screen.queryAllByTestId('snap-guide')).toHaveLength(0);
    fireEvent.pointerUp(diagram(), at(400, 6, { altKey: true }));
  });

  it('gestures use world coordinates under a panned and zoomed viewport', () => {
    load(fixture({ kind: 'DFA', alphabet: 'a', states: [], name: 'm' }));
    st().setViewport('m', { x: 100, y: 50, zoom: 2 });
    render(<Canvas />);
    fireEvent.doubleClick(diagram(), { clientX: 300, clientY: 250 });
    expect(active().states[0]).toMatchObject({ x: 100, y: 100 });
  });

  it('editing is disabled while a trace is open', () => {
    const a = fixture({
      kind: 'DFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      start: 'q0',
      accepting: ['q1'],
      edges: [
        ['q0', 'a', 'q1'],
        ['q1', 'a', 'q1'],
      ],
      name: 'm',
    });
    load(a);
    act(() => st().openTrace(runWord(active(), 'a')));
    render(<Canvas />);
    const before = active();
    fireEvent.doubleClick(diagram(), { clientX: 200, clientY: 150 });
    click(stateEl('q1'), 100, 0);
    fireEvent.keyDown(canvas(), { key: 'Delete' });
    drag(stateEl('q1'), [100, 0], [[200, 50]]);
    drawEdge([0, 0]);
    fireEvent.doubleClick(stateEl('q0'), { clientX: 0, clientY: 0 });
    fireEvent.contextMenu(stateEl('q0'), { clientX: 0, clientY: 0 });
    expect(active()).toBe(before);
    expect(st().selection).toEqual({ states: [], transitions: [] });
    expect(screen.queryByTestId('symbol-input')).toBeNull();
    expect(screen.queryByTestId('rename-input')).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

/** jsdom lays nothing out: give the canvas element a size. */
function sizeCanvas(width: number, height: number): void {
  Object.defineProperty(canvas(), 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(canvas(), 'clientHeight', { value: height, configurable: true });
}

describe('selecting several states, copy and paste', () => {
  /** q0 -a-> q1 -a-> q2 -b-> q0, at x = 0, 100, 200. */
  const three = () =>
    fixture({
      kind: 'DFA',
      alphabet: 'ab',
      states: ['q0', 'q1', 'q2'],
      start: 'q0',
      accepting: ['q2'],
      edges: [
        ['q0', 'a', 'q1'],
        ['q1', 'a', 'q2'],
        ['q2', 'b', 'q0'],
      ],
      name: 'm',
    });
  const ctrl = { ctrlKey: true };
  const key = (k: string, mods: { ctrlKey?: boolean; metaKey?: boolean } = ctrl) =>
    fireEvent.keyDown(window, { key: k, ...mods });
  const byLabel = (label: string) => active().states.find((s) => s.label === label);

  it('Ctrl + drag on the background draws a box that selects the states inside', () => {
    load(three());
    render(<Canvas />);
    fireEvent.pointerDown(diagram(), at(50, -50, ctrl));
    fireEvent.pointerMove(diagram(), at(150, 0, ctrl));
    fireEvent.pointerMove(diagram(), at(250, 50, ctrl));
    expect(screen.getByTestId('select-box')).toHaveAttribute('width', '200');
    expect(st().selection).toEqual({ states: ['q1', 'q2'], transitions: ['q1->q2'] });
    fireEvent.pointerUp(diagram(), at(250, 50, ctrl));
    expect(screen.queryByTestId('select-box')).toBeNull();
    expect(stateEl('q1')).toHaveAttribute('data-selected', 'true');
    expect(stateEl('q2')).toHaveAttribute('data-selected', 'true');
    // No pan.
    expect(st().viewports.m).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('a box adds to the selection; a Ctrl+click on the background keeps it', () => {
    load(three());
    render(<Canvas />);
    click(stateEl('q0'), 0, 0);
    drag(diagram(), [150, -50], [[250, 50]], ctrl);
    expect(st().selection.states).toEqual(['q0', 'q2']);
    expect(st().selection.transitions).toEqual(['q2->q0']);
    drag(diagram(), [300, 300], [], ctrl);
    expect(st().selection.states).toEqual(['q0', 'q2']);
  });

  it('Ctrl+click adds a state (with its arrows to selected states) or takes it out', () => {
    load(three());
    render(<Canvas />);
    click(stateEl('q0'), 0, 0);
    drag(stateEl('q1'), [100, 0], [], ctrl);
    expect(st().selection).toEqual({ states: ['q0', 'q1'], transitions: ['q0->q1'] });
    drag(stateEl('q0'), [0, 0], [], ctrl);
    expect(st().selection).toEqual({ states: ['q1'], transitions: [] });
  });

  it('dragging a selected state moves the whole selection in one undo step', () => {
    load(three());
    render(<Canvas />);
    click(stateEl('q0'), 0, 0);
    drag(stateEl('q1'), [100, 0], [], ctrl);
    drag(
      stateEl('q1'),
      [100, 0],
      [
        [120, 30],
        [130, 60],
      ],
    );
    expect(active().states.map((s) => [s.x, s.y])).toEqual([
      [30, 60],
      [130, 60],
      [200, 0],
    ]);
    expect(st().selection.states).toEqual(['q0', 'q1']);
    expect(st().history.m?.past).toHaveLength(1);
    act(() => st().undo());
    expect(active().states.map((s) => s.x)).toEqual([0, 100, 200]);
  });

  it('a click without a drag on a state of the selection selects it alone', () => {
    load(three());
    render(<Canvas />);
    click(stateEl('q0'), 0, 0);
    drag(stateEl('q1'), [100, 0], [], ctrl);
    click(stateEl('q1'), 100, 0);
    expect(st().selection).toEqual({ states: ['q1'], transitions: [] });
  });

  it('Delete removes every selected state', () => {
    load(three());
    render(<Canvas />);
    drag(diagram(), [-50, -50], [[150, 50]], ctrl);
    fireEvent.keyDown(canvas(), { key: 'Delete' });
    expect(active().states.map((s) => s.id)).toEqual(['q2']);
    expect(active().transitions).toEqual([]);
  });

  it('Ctrl+C then Ctrl+V pastes a copy a step off, with its arrows, selected', () => {
    load(three());
    render(<Canvas />);
    drag(diagram(), [50, -50], [[250, 50]], ctrl);
    key('c');
    // The pointer is off the canvas: the copy lands a step down and right of the original.
    fireEvent.pointerLeave(canvas());
    key('v');
    expect(active().states.map((s) => s.label)).toEqual(['q0', 'q1', 'q2', "q1'", "q2'"]);
    expect(byLabel("q1'")).toMatchObject({ x: 140, y: 40 });
    const ids = [byLabel("q1'")!.id, byLabel("q2'")!.id];
    expect(st().selection.states).toEqual(ids);
    const pasted = active().transitions.filter((t) => ids.includes(t.from));
    expect(pasted.map((t) => [t.from, t.to, t.symbols])).toEqual([
      [ids[0], ids[1], ['a']],
      [ids[1], 'q0', ['b']],
    ]);
    expect(active().accepting).toEqual(['q2', ids[1]]);
    expect(stateEl("q1'")).toHaveAttribute('data-selected', 'true');
    // One undo step.
    act(() => st().undo());
    expect(active().states).toHaveLength(3);
  });

  it('pastes centred on the pointer while it is over the canvas', () => {
    load(three());
    render(<Canvas />);
    drag(diagram(), [50, -50], [[250, 50]], ctrl);
    key('c');
    fireEvent.pointerMove(diagram(), at(500, 300));
    key('v');
    expect(byLabel("q1'")).toMatchObject({ x: 450, y: 300 });
    expect(byLabel("q2'")).toMatchObject({ x: 550, y: 300 });
    fireEvent.pointerLeave(canvas());
    key('v');
    expect(byLabel("q1''")).toMatchObject({ x: 140, y: 40 });
  });

  it('copy and paste work on a Hebrew layout (Ctrl+ב, Ctrl+ה)', () => {
    load(three());
    render(<Canvas />);
    click(stateEl('q0'), 0, 0);
    fireEvent.keyDown(window, { key: 'ב', code: 'KeyC', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'ה', code: 'KeyV', ctrlKey: true });
    expect(byLabel("q0'")).toBeDefined();
  });

  it('⌘ works like Ctrl', () => {
    load(three());
    render(<Canvas />);
    click(stateEl('q0'), 0, 0);
    key('c', { metaKey: true });
    key('v', { metaKey: true });
    expect(byLabel("q0'")).toBeDefined();
  });

  it('copy and paste leave inputs and open traces alone', () => {
    load(three());
    render(<Canvas />);
    click(stateEl('q0'), 0, 0);
    // Nothing copied yet: Ctrl+V does nothing and keeps the browser's paste.
    expect(fireEvent.keyDown(window, { key: 'v', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(window, { key: 'c', ctrlKey: true })).toBe(false);
    fireEvent.doubleClick(stateEl('q1'), { clientX: 100, clientY: 0 });
    fireEvent.keyDown(screen.getByTestId('rename-input'), { key: 'v', ctrlKey: true });
    expect(active().states).toHaveLength(3);
    fireEvent.keyDown(screen.getByTestId('rename-input'), { key: 'Escape' });
    act(() => st().openTrace(runWord({ ...active(), kind: 'NFA' }, 'a')));
    key('v');
    expect(active().states).toHaveLength(3);
  });

  it('pasting ε-arrows into a DFA switches it to an NFA with a toast', () => {
    const nfa = fixture({
      kind: 'NFA',
      alphabet: 'a',
      states: ['q0', 'q1'],
      edges: [['q0', 'ε', 'q1']],
      name: 'n',
    });
    const dfa = fixture({ kind: 'DFA', alphabet: '', states: [], name: 'm' });
    resetAppStore({ automata: [dfa, nfa], activeId: 'n' });
    st().setViewport('n', { x: 0, y: 0, zoom: 1 });
    st().setViewport('m', { x: 0, y: 0, zoom: 1 });
    render(<Canvas />);
    act(() => st().select({ states: ['q0', 'q1'], transitions: [] }));
    key('c');
    act(() => st().setActive('m'));
    key('v');
    expect(active().kind).toBe('NFA');
    expect(active().states.map((s) => s.label)).toEqual(['q0', 'q1']);
    expect(toasts().at(-1)?.message).toBe('Switched to NFA: ε-transitions need an NFA');
  });

  it('Ctrl+X cuts the selected states (on a Hebrew layout too) and Ctrl+V pastes them back', () => {
    load(three());
    render(<Canvas />);
    click(stateEl('q1'), 100, 0);
    drag(stateEl('q2'), [200, 0], [], ctrl);
    expect(key('x')).toBe(false);
    expect(active().states.map((s) => s.label)).toEqual(['q0']);
    expect(st().clipboard).toMatchObject({ kind: 'states' });
    key('v');
    expect(active().states.map((s) => s.label)).toEqual(['q0', 'q1', 'q2']);
    click(stateEl('q0'), 0, 0);
    fireEvent.keyDown(window, { key: 'ס', code: 'KeyX', ctrlKey: true });
    expect(active().states.map((s) => s.label)).toEqual(['q1', 'q2']);
  });

  it('Cut in a state’s menu cuts it', async () => {
    const user = userEvent.setup();
    load(three());
    render(<Canvas />);
    fireEvent.contextMenu(stateEl('q1'), { clientX: 100, clientY: 0 });
    await user.click(screen.getByRole('menuitem', { name: 'Cut' }));
    expect(active().states.map((s) => s.label)).toEqual(['q0', 'q2']);
    expect(st().clipboard).toMatchObject({ kind: 'states' });
  });

  it('Ctrl+X leaves inputs, arrows alone and open traces to the browser', () => {
    load(three());
    render(<Canvas />);
    click(screen.getByTestId('edge-q0-q1'), 50, 0);
    expect(key('x')).toBe(true);
    expect(active().transitions).toHaveLength(3);
    click(stateEl('q0'), 0, 0);
    fireEvent.doubleClick(stateEl('q1'), { clientX: 100, clientY: 0 });
    fireEvent.keyDown(screen.getByTestId('rename-input'), { key: 'x', ctrlKey: true });
    fireEvent.keyDown(screen.getByTestId('rename-input'), { key: 'Escape' });
    expect(active().states).toHaveLength(3);
    click(stateEl('q0'), 0, 0);
    act(() => st().openTrace(runWord({ ...active(), kind: 'NFA' }, 'a')));
    expect(key('x')).toBe(true);
    expect(active().states).toHaveLength(3);
  });

  it('Ctrl+A selects every state and arrow and focuses the canvas, so Delete clears it', () => {
    load(three());
    render(<Canvas />);
    expect(key('a')).toBe(false);
    expect(st().selection).toEqual({
      states: ['q0', 'q1', 'q2'],
      transitions: ['q0->q1', 'q1->q2', 'q2->q0'],
    });
    expect(canvas()).toHaveFocus();
    fireEvent.keyDown(canvas(), { key: 'Delete' });
    expect(active().states).toEqual([]);
  });

  it('Ctrl+A works on a Hebrew layout, but not while typing or with a trace open', () => {
    load(three());
    render(<Canvas />);
    click(stateEl('q1'), 100, 0);
    fireEvent.doubleClick(stateEl('q1'), { clientX: 100, clientY: 0 });
    fireEvent.keyDown(screen.getByTestId('rename-input'), { key: 'a', ctrlKey: true });
    expect(st().selection.states).toEqual(['q1']);
    fireEvent.keyDown(screen.getByTestId('rename-input'), { key: 'Escape' });
    act(() => st().openTrace(runWord({ ...active(), kind: 'NFA' }, 'a')));
    const during = st().selection;
    expect(key('a')).toBe(true);
    expect(st().selection).toBe(during);
    act(() => st().closeTrace());
    fireEvent.keyDown(window, { key: 'ש', code: 'KeyA', ctrlKey: true });
    expect(st().selection.states).toEqual(['q0', 'q1', 'q2']);
  });

  it('the menu on a multi-selection copies or deletes it; the background menu pastes', async () => {
    const user = userEvent.setup();
    load(three());
    render(<Canvas />);
    drag(diagram(), [50, -50], [[250, 50]], ctrl);
    fireEvent.contextMenu(stateEl('q1'), { clientX: 100, clientY: 0 });
    expect(
      within(screen.getByRole('menu'))
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['Cut 2 states', 'Copy 2 states', 'Delete 2 states']);
    expect(st().selection.states).toEqual(['q1', 'q2']);
    await user.click(screen.getByRole('menuitem', { name: 'Copy 2 states' }));
    fireEvent.contextMenu(diagram(), { clientX: 400, clientY: 200 });
    await user.click(screen.getByRole('menuitem', { name: 'Paste' }));
    expect(byLabel("q1'")).toMatchObject({ x: 350, y: 200 });
    fireEvent.contextMenu(stateEl("q1'"), { clientX: 350, clientY: 200 });
    await user.click(screen.getByRole('menuitem', { name: 'Delete 2 states' }));
    expect(active().states.map((s) => s.label)).toEqual(['q0', 'q1', 'q2']);
  });

  it('the background menu offers nothing before anything is copied', () => {
    load(three());
    render(<Canvas />);
    fireEvent.contextMenu(diagram(), { clientX: 400, clientY: 200 });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Fit and Tidy', () => {
  it('Fit fits the states into the canvas', () => {
    load(two());
    render(<Canvas />);
    sizeCanvas(640, 480);
    act(() => fitActive());
    expect(st().viewports.m).toEqual(fitToView(active().states, { width: 640, height: 480 }));
  });

  it('Fit does nothing while the canvas has no size', () => {
    load(two());
    render(<Canvas />);
    act(() => fitActive());
    expect(st().viewports.m).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('Tidy lays the states out and undoes in one step', async () => {
    const a = two('DFA', 'a', [['q1', 'a', 'q0']]);
    load({ ...a, starts: ['q1'] });
    render(<Canvas />);
    sizeCanvas(640, 480);
    const expected = (await layoutAutomaton(active())).states;
    await act(() => tidyActive());
    expect(active().states).toEqual(expected);
    expect(st().history.m?.past).toHaveLength(1);
    expect(st().viewports.m).toEqual(fitToView(expected, { width: 640, height: 480 }));
    act(() => st().undo());
    expect(active().states.map((s) => [s.x, s.y])).toEqual([
      [0, 0],
      [100, 0],
    ]);
  });

  it('Tidy redraws arrows and start arrows too, undone with the positions', async () => {
    const a = two('DFA', 'a', [['q0', 'a', 'q1']]);
    const messy: Automaton = {
      ...a,
      states: a.states.map((s) => ({ ...s, startAngle: 1 })),
      transitions: a.transitions.map((t) => ({ ...t, bend: 120, labelSide: 'right' as const })),
    };
    load(messy);
    render(<Canvas />);
    sizeCanvas(640, 480);
    const expected = await layoutAutomaton(active());
    await act(() => tidyActive());
    expect(active().states).toEqual(expected.states);
    expect(active().transitions).toEqual(expected.transitions);
    expect(active().transitions[0]).not.toHaveProperty('bend');
    expect(active().transitions[0]).not.toHaveProperty('labelSide');
    act(() => st().undo());
    expect(active()).toEqual(messy);
  });

  it('Tidy again leaves no undo entry and keeps the automaton when nothing changes', async () => {
    const a = two('DFA', 'a', [['q0', 'a', 'q1']]);
    load(a);
    render(<Canvas />);
    sizeCanvas(640, 480);
    await act(() => tidyActive());
    expect(st().history.m?.past).toHaveLength(1);
    const tidied = active();
    // Another automaton edited since: a needless edit would move this one back to the front.
    const other = {
      ...fixture({ kind: 'DFA', alphabet: 'a', states: ['p'], edges: [], name: 'other' }),
      id: 'other',
    };
    act(() => appStore.setState({ automata: [other, tidied] }));
    act(() => st().setViewport('m', { x: 5, y: 5, zoom: 3 }));
    await act(() => tidyActive());
    await act(() => tidyActive());
    expect(active()).toBe(tidied);
    expect(st().automata.map((x) => x.id)).toEqual(['other', 'm']);
    expect(st().history.m?.past).toHaveLength(1);
    // Still fits the view.
    expect(st().viewports.m).toEqual(fitToView(tidied.states, { width: 640, height: 480 }));
    act(() => st().undo());
    expect(st().history.m?.past ?? []).toHaveLength(0);
  });

  it('Tidy reports a layout failure and leaves no undo entry', async () => {
    toastStore.setState({ toasts: [] });
    load(two('DFA', 'a', [['q0', 'a', 'q1']]));
    render(<Canvas />);
    const before = active();
    layoutMock.mockRejectedValueOnce(new Error('elk exploded'));
    await act(() => tidyActive());
    expect(toasts()).toEqual([
      expect.objectContaining({ message: 'Could not lay out the automaton', kind: 'error' }),
    ]);
    expect(active()).toBe(before);
    expect(st().history.m?.past ?? []).toHaveLength(0);
  });

  it('Tidy drops its layout when the automaton changes during it', async () => {
    load(two('DFA', 'a', [['q0', 'a', 'q1']]));
    render(<Canvas />);
    let release = (): void => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    layoutMock.mockClear();
    layoutMock.mockImplementationOnce(async (a: Automaton) => {
      await gate;
      return { ...a, states: a.states.map((s) => ({ ...s, x: 999, y: 999 })) };
    });
    let done: Promise<boolean> = Promise.resolve(true);
    act(() => {
      done = tidyActive();
    });
    await waitFor(() => expect(layoutMock).toHaveBeenCalled());
    act(() => st().edit((a) => moveState(a, 'q0', { x: 7, y: 7 })));
    await act(async () => {
      release();
      await done;
    });
    expect(await done).toBe(false);
    expect(active().states.map((s) => [s.x, s.y])).toEqual([
      [7, 7],
      [100, 0],
    ]);
    expect(st().history.m?.past).toHaveLength(1);
  });

  it('tidyActive resolves true once the layout lands', async () => {
    load(two('DFA', 'a', [['q0', 'a', 'q1']]));
    render(<Canvas />);
    sizeCanvas(640, 480);
    expect(await act(() => tidyActive())).toBe(true);
  });

  it('tidyActive resolves false while a trace is open', async () => {
    load({
      ...two('DFA', 'a', [
        ['q0', 'a', 'q1'],
        ['q1', 'a', 'q1'],
      ]),
      starts: ['q0'],
    });
    act(() => st().openTrace(runWord(active(), 'a')));
    render(<Canvas />);
    expect(await act(() => tidyActive())).toBe(false);
  });

  it('Tidy does nothing while a trace is open', async () => {
    load({
      ...two('DFA', 'a', [
        ['q0', 'a', 'q1'],
        ['q1', 'a', 'q1'],
      ]),
      starts: ['q0'],
    });
    act(() => st().openTrace(runWord(active(), 'a')));
    render(<Canvas />);
    const before = active();
    layoutMock.mockClear();
    await act(() => tidyActive());
    expect(layoutMock).not.toHaveBeenCalled();
    expect(active()).toBe(before);
  });
});

describe('several start states', () => {
  const nfa = () =>
    fixture({ kind: 'NFA', alphabet: 'a', states: ['q0', 'q1'], start: 'q0', name: 'm' });
  const arrows = () => screen.queryAllByTestId('start-arrow');

  it('S adds and removes start states on an NFA, with one start arrow each', () => {
    load(nfa());
    render(<Canvas />);
    click(stateEl('q1'), 100, 0);
    fireEvent.keyDown(canvas(), { key: 's' });
    expect(active().starts).toEqual(['q0', 'q1']);
    expect(arrows().map((a) => a.getAttribute('data-state-id'))).toEqual(['q0', 'q1']);
    fireEvent.keyDown(canvas(), { key: 's' });
    expect(active().starts).toEqual(['q0']);
    expect(arrows()).toHaveLength(1);
  });

  it('S moves the start on a DFA', () => {
    load({ ...two(), starts: ['q0'] });
    render(<Canvas />);
    click(stateEl('q1'), 100, 0);
    fireEvent.keyDown(canvas(), { key: 's' });
    expect(active().starts).toEqual(['q1']);
  });

  it('the state menu reads "Toggle start" on an NFA and "Set as start" on a DFA', async () => {
    const user = userEvent.setup();
    load(nfa());
    const { unmount } = render(<Canvas />);
    fireEvent.contextMenu(stateEl('q1'), { clientX: 100, clientY: 0 });
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem')[0]).toHaveTextContent(
      'Toggle start',
    );
    await user.click(screen.getByRole('menuitem', { name: 'Toggle start' }));
    expect(active().starts).toEqual(['q0', 'q1']);
    unmount();

    load({ ...two(), starts: ['q0'] });
    render(<Canvas />);
    fireEvent.contextMenu(stateEl('q0'), { clientX: 0, clientY: 0 });
    // On the DFA's current start, "Set as start" keeps it (it never clears).
    await user.click(screen.getByRole('menuitem', { name: 'Set as start' }));
    expect(active().starts).toEqual(['q0']);
  });
});
