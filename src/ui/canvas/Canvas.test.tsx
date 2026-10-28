import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Automaton } from '../../core/model';
import { runWord } from '../../core/run';
import { moveState } from '../../core/edit';
import { fixture } from '../../core/testing/fixtures';
import { layoutAutomaton } from '../../layout/layout';
import { appStore, resetAppStore } from '../../store/store';
import { toastStore } from '../shell/toastStore';
import { Canvas } from './Canvas';
import { fitActive, tidyActive } from './useCanvasEditing';
import { fitToView } from './viewport';

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

type Mods = { shiftKey?: boolean; altKey?: boolean };
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
    fireEvent.doubleClick(diagram(), { clientX: 200, clientY: 150 });
    expect(screen.queryByTestId('canvas-hint')).toBeNull();
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

  it('a new edge onto an existing one merges the symbols', async () => {
    const user = userEvent.setup();
    load(two('NFA', 'ab', [['q0', 'a', 'q1']]));
    render(<Canvas />);
    drawEdge();
    await user.type(screen.getByTestId('symbol-input'), 'b, a{Enter}');
    expect(active().transitions).toEqual([
      expect.objectContaining({ id: 'q0->q1', symbols: ['a', 'b'] }),
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

  it('typing \\epsilon turns into ε as it is typed', async () => {
    const user = userEvent.setup();
    load(two('NFA'));
    render(<Canvas />);
    drawEdge();
    const input = screen.getByTestId('symbol-input');
    await user.type(input, 'a, \\epsilo');
    expect(input).toHaveValue('a, \\epsilo');
    await user.type(input, 'n');
    expect(input).toHaveValue('a, ε');
    await user.type(input, ', b{Enter}');
    expect(active().transitions[0]?.symbols).toEqual(['a', 'ε', 'b']);
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
    expect(input).toHaveValue('a, b');
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
    expect(screen.getByTestId('symbol-input')).toHaveValue('a, b');
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
    ).toEqual(['Edit symbols', 'Straighten', 'Delete']);
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
      edges: [['q0', 'a', 'q1']],
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
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = tidyActive();
    });
    await waitFor(() => expect(layoutMock).toHaveBeenCalled());
    act(() => st().edit((a) => moveState(a, 'q0', { x: 7, y: 7 })));
    await act(async () => {
      release();
      await done;
    });
    expect(active().states.map((s) => [s.x, s.y])).toEqual([
      [7, 7],
      [100, 0],
    ]);
    expect(st().history.m?.past).toHaveLength(1);
  });

  it('Tidy does nothing while a trace is open', async () => {
    load({ ...two('DFA', 'a', [['q0', 'a', 'q1']]), starts: ['q0'] });
    act(() => st().openTrace(runWord(active(), 'a')));
    render(<Canvas />);
    const before = active();
    layoutMock.mockClear();
    await act(() => tidyActive());
    expect(layoutMock).not.toHaveBeenCalled();
    expect(active()).toBe(before);
  });
});
