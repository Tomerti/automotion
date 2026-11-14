import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { State } from '../../core/model';
import { fitToView, zoomAt, ZOOM_STEP } from '../canvas/viewport';
import type { Viewport } from '../../store/types';
import { useFittedViewport } from './useFittedViewport';

afterEach(cleanup);

const FALLBACK = { width: 800, height: 500 };
const st = (id: string, x: number, y: number): State => ({ id, label: id, x, y });
const A = [st('a', 0, 0), st('b', 200, 100)];
const B = [st('a', 0, 0), st('b', 600, 300)];
const pts = (s: State[]): { x: number; y: number }[] => s.map((q) => ({ x: q.x, y: q.y }));

let api: ReturnType<typeof useFittedViewport>;
function Probe({ states, interactive }: { states: State[]; interactive?: boolean }) {
  const { ref, onPointerDown, ...rest } = useFittedViewport(
    states,
    interactive === undefined ? undefined : { interactive },
  );
  // Published after each commit, so the tests read what the hook returned last.
  useLayoutEffect(() => {
    api = { ref, onPointerDown, ...rest };
  });
  return <div data-testid="p" ref={ref} onPointerDown={onPointerDown} />;
}
const vp = (): Viewport => api.viewport;
const wheel = (el: HTMLElement, init: WheelEventInit = {}): WheelEvent => {
  const ev = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true, ...init });
  act(() => {
    el.dispatchEvent(ev);
  });
  return ev;
};

describe('useFittedViewport', () => {
  it('starts fitted', () => {
    render(<Probe states={A} />);
    expect(vp()).toEqual(fitToView(pts(A), FALLBACK));
    expect(api.moved).toBe(false);
  });

  it('wheel zooms around the pointer and prevents default', () => {
    const { getByTestId } = render(<Probe states={A} />);
    const fitted = fitToView(pts(A), FALLBACK);
    const ev = wheel(getByTestId('p'), { clientX: 100, clientY: 50 });
    expect(ev.defaultPrevented).toBe(true);
    expect(vp()).toEqual(zoomAt(fitted, { x: 100, y: 50 }, ZOOM_STEP));
    expect(api.moved).toBe(true);
  });

  it('drag pans', () => {
    const { getByTestId } = render(<Probe states={A} />);
    const fitted = fitToView(pts(A), FALLBACK);
    const el = getByTestId('p');
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10, pointerId: 1, button: 0 });
    fireEvent.pointerMove(el, { clientX: 40, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 40, clientY: 30, pointerId: 1 });
    expect(vp().x).toBeCloseTo(fitted.x + 30);
    expect(vp().y).toBeCloseTo(fitted.y + 20);
    expect(vp().zoom).toBe(fitted.zoom);
    expect(api.moved).toBe(true);
  });

  it('Fit resets', () => {
    const { getByTestId } = render(<Probe states={A} />);
    wheel(getByTestId('p'));
    expect(api.moved).toBe(true);
    act(() => api.fit());
    expect(vp()).toEqual(fitToView(pts(A), FALLBACK));
    expect(api.moved).toBe(false);
  });

  it('re-fits when the states change', () => {
    const { getByTestId, rerender } = render(<Probe states={A} />);
    wheel(getByTestId('p'));
    expect(api.moved).toBe(true);
    rerender(<Probe states={B} />);
    expect(vp()).toEqual(fitToView(pts(B), FALLBACK));
    expect(api.moved).toBe(false);
  });

  it('re-fits when the size changes', () => {
    // jsdom lays nothing out: stub ResizeObserver and give the element a size to measure.
    const observers: (() => void)[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          observers.push(cb);
        }
        observe(): void {}
        disconnect(): void {}
      },
    );
    try {
      const { getByTestId } = render(<Probe states={A} />);
      const el = getByTestId('p');
      const resize = (width: number, height: number): void => {
        Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
        Object.defineProperty(el, 'clientHeight', { value: height, configurable: true });
        act(() => observers.forEach((cb) => cb()));
      };
      resize(800, 500);
      wheel(el);
      expect(api.moved).toBe(true);
      resize(400, 300);
      expect(vp()).toEqual(fitToView(pts(A), { width: 400, height: 300 }));
      expect(api.moved).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('two wheel events in one frame both count', () => {
    const { getByTestId } = render(<Probe states={A} />);
    const fitted = fitToView(pts(A), FALLBACK);
    const el = getByTestId('p');
    const at = { clientX: 100, clientY: 50 };
    act(() => {
      for (let i = 0; i < 2; i++) {
        el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true, ...at }));
      }
    });
    const once = zoomAt(fitted, { x: 100, y: 50 }, ZOOM_STEP);
    expect(vp()).toEqual(zoomAt(once, { x: 100, y: 50 }, ZOOM_STEP));
  });

  it('does not bring a view back when the fitted target returns', () => {
    const { getByTestId, rerender } = render(<Probe states={A} />);
    wheel(getByTestId('p'));
    expect(api.moved).toBe(true);
    rerender(<Probe states={B} />);
    rerender(<Probe states={A} />);
    expect(vp()).toEqual(fitToView(pts(A), FALLBACK));
    expect(api.moved).toBe(false);
  });

  it('keeps the view across rerenders with the same fit', () => {
    const { getByTestId, rerender } = render(<Probe states={A} />);
    wheel(getByTestId('p'));
    rerender(<Probe states={[...A]} />);
    expect(api.moved).toBe(true);
  });

  it('does nothing when not interactive', () => {
    const { getByTestId } = render(<Probe states={A} interactive={false} />);
    const ev = wheel(getByTestId('p'));
    fireEvent.pointerDown(getByTestId('p'), { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(getByTestId('p'), { clientX: 40, clientY: 30, pointerId: 1 });
    expect(ev.defaultPrevented).toBe(false);
    expect(api.moved).toBe(false);
  });
});
