import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Automaton } from '../../core/model';
import { runWord } from '../../core/run';
import { fixture } from '../../core/testing/fixtures';
import { layoutAutomaton } from '../../layout/layout';
import { appStore, resetAppStore } from '../../store/store';
import { Toolbar } from '../shell/Toolbar';
import { Canvas } from './Canvas';
import { fitToView } from './viewport';

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

const at = (x: number, y: number) => ({ clientX: x, clientY: y, pointerId: 1, button: 0 });

/** Press on `target` at (x, y), optionally move through `path`, release at the last point. */
function drag(target: Element, from: [number, number], path: [number, number][] = []): void {
  fireEvent.pointerDown(target, at(...from));
  for (const p of path) fireEvent.pointerMove(diagram(), at(...p));
  const end = path[path.length - 1] ?? from;
  fireEvent.pointerUp(diagram(), at(...end));
}

const click = (target: Element, x: number, y: number) => drag(target, [x, y]);

/** Drag from q0's ring (radius 28 to its right) to the center of the state at `to`. */
function drawEdge(to: [number, number] = [100, 0]): void {
  drag(stateEl('q0'), [28, 0], [[60, 0], to]);
}

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
  it('double-click on empty space adds q0', () => {
    load(fixture({ kind: 'DFA', alphabet: 'a', states: [], name: 'm' }));
    render(<Canvas />);
    fireEvent.doubleClick(diagram(), { clientX: 200, clientY: 150 });
    expect(active().states).toEqual([expect.objectContaining({ label: 'q0', x: 200, y: 150 })]);
    expect(stateEl('q0')).toBeInTheDocument();
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

  it('S and A keys set start and accepting on the selected state', () => {
    load(two());
    render(<Canvas />);
    click(stateEl('q1'), 100, 0);
    fireEvent.keyDown(canvas(), { key: 's' });
    expect(active().start).toBe('q1');
    fireEvent.keyDown(canvas(), { key: 'a' });
    expect(active().accepting).toEqual(['q1']);
    fireEvent.keyDown(canvas(), { key: 'A' });
    expect(active().accepting).toEqual([]);
  });

  it('S and A ignore a selected state that undo removed', () => {
    load(fixture({ kind: 'DFA', alphabet: 'a', states: [], name: 'm' }));
    render(<Canvas />);
    fireEvent.doubleClick(diagram(), { clientX: 10, clientY: 10 });
    click(stateEl('q0'), 10, 10);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(canvas(), { key: 's' });
    fireEvent.keyDown(canvas(), { key: 'a' });
    expect(active().start).toBeNull();
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

  it('dragging from the ring to another state opens the symbol input; "a, b" creates an edge', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    fireEvent.pointerDown(stateEl('q0'), at(28, 0));
    fireEvent.pointerMove(diagram(), at(60, 10));
    expect(screen.getByTestId('rubber-band')).toBeInTheDocument();
    fireEvent.pointerUp(diagram(), at(100, 0));
    expect(screen.queryByTestId('rubber-band')).toBeNull();
    const input = screen.getByTestId('symbol-input');
    expect(input).toHaveFocus();
    await user.type(input, 'a, b{Enter}');
    expect(active().transitions).toEqual([
      expect.objectContaining({ from: 'q0', to: 'q1', symbols: ['a', 'b'] }),
    ]);
    expect(screen.queryByTestId('symbol-input')).toBeNull();
    expect(active().states.map((s) => [s.x, s.y])).toEqual([
      [0, 0],
      [100, 0],
    ]);
  });

  it('dragging from the ring back onto the same state draws a self-loop', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    drag(
      stateEl('q0'),
      [28, 0],
      [
        [60, -40],
        [5, 5],
      ],
    );
    await user.type(screen.getByTestId('symbol-input'), 'a{Enter}');
    expect(active().transitions).toEqual([
      expect.objectContaining({ from: 'q0', to: 'q0', symbols: ['a'] }),
    ]);
  });

  it('releasing the rubber band on empty space opens nothing', () => {
    load(two());
    render(<Canvas />);
    drawEdge([300, 200]);
    expect(screen.queryByTestId('symbol-input')).toBeNull();
    expect(screen.queryByTestId('rubber-band')).toBeNull();
  });

  it('a new symbol typed on an edge is added to the alphabet', async () => {
    const user = userEvent.setup();
    load(two('DFA', 'a'));
    render(<Canvas />);
    drawEdge();
    await user.type(screen.getByTestId('symbol-input'), 'c{Enter}');
    expect(active().alphabet).toEqual(['a', 'c']);
    expect(active().transitions[0]?.symbols).toEqual(['c']);
    act(() => st().undo());
    expect(active().alphabet).toEqual(['a']);
    expect(active().transitions).toEqual([]);
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

  it('ε typed on a DFA edge shows an error', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    drawEdge();
    await user.type(screen.getByTestId('symbol-input'), 'eps{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent("A DFA can't have ε-transitions");
    expect(active().transitions).toEqual([]);
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

  it('the state context menu sets start, toggles accepting and deletes', async () => {
    const user = userEvent.setup();
    load(two());
    render(<Canvas />);
    const menuOn = (label: string) => {
      fireEvent.contextMenu(stateEl(label), { clientX: 100, clientY: 0 });
      return screen.getByRole('menu');
    };
    const items = within(menuOn('q1')).getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Set as start', 'Toggle accepting', 'Delete']);
    await user.click(screen.getByRole('menuitem', { name: 'Set as start' }));
    expect(active().start).toBe('q1');
    expect(screen.queryByRole('menu')).toBeNull();
    menuOn('q1');
    await user.click(screen.getByRole('menuitem', { name: 'Toggle accepting' }));
    expect(active().accepting).toEqual(['q1']);
    menuOn('q1');
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(active().states.map((s) => s.id)).toEqual(['q0']);
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
    ).toEqual(['Edit symbols', 'Delete']);
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
    fireEvent.doubleClick(stateEl('q0'), { clientX: 10, clientY: 10 });
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
    expect(active().start).toBeNull();
    expect(active().accepting).toEqual([]);
    expect(active().states).toHaveLength(2);
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

  it('Space+drag on a state pans instead of moving it', () => {
    load(two());
    render(<Canvas />);
    fireEvent.keyDown(canvas(), { key: ' ' });
    drag(stateEl('q1'), [100, 0], [[150, 0]]);
    fireEvent.keyUp(canvas(), { key: ' ' });
    expect(active().states[1]).toMatchObject({ x: 100, y: 0 });
    expect(st().viewports.m).toEqual({ x: 50, y: 0, zoom: 1 });
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

describe('Fit and Tidy', () => {
  it('Fit fits the states into the canvas', async () => {
    const user = userEvent.setup();
    load(two());
    render(
      <>
        <Toolbar />
        <Canvas />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Fit' }));
    expect(st().viewports.m).toEqual(fitToView(active().states, { width: 0, height: 0 }));
  });

  it('Tidy lays the states out and undoes in one step', async () => {
    const user = userEvent.setup();
    const a = two('DFA', 'a', [['q1', 'a', 'q0']]);
    load({ ...a, start: 'q1' });
    render(
      <>
        <Toolbar />
        <Canvas />
      </>,
    );
    const expected = (await layoutAutomaton(active())).states;
    await user.click(screen.getByRole('button', { name: 'Tidy' }));
    await waitFor(() => expect(active().states).toEqual(expected));
    expect(st().history.m?.past).toHaveLength(1);
    expect(st().viewports.m).toEqual(fitToView(expected, { width: 0, height: 0 }));
    act(() => st().undo());
    expect(active().states.map((s) => [s.x, s.y])).toEqual([
      [0, 0],
      [100, 0],
    ]);
  });

  it('Tidy is disabled while a trace is open', () => {
    load({ ...two('DFA', 'a', [['q0', 'a', 'q1']]), start: 'q0' });
    act(() => st().openTrace(runWord(active(), 'a')));
    render(<Toolbar />);
    expect(screen.getByRole('button', { name: 'Tidy' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Fit' })).toBeEnabled();
  });
});
