import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';

/** An NFA ("Ends in ab (NFA)") and a DFA ("Even number of 0s (DFA)") to import. */
export const FIXTURES = fileURLToPath(new URL('./fixtures/automata.json', import.meta.url));

export interface Point {
  x: number;
  y: number;
}

/** Open the app with the first-visit Controls popup already dismissed. */
export async function openApp(page: Page, opts: { clear?: boolean } = {}): Promise<void> {
  await page.addInitScript((clear) => {
    if (clear && !sessionStorage.getItem('e2e-cleared')) {
      localStorage.clear();
      sessionStorage.setItem('e2e-cleared', '1');
    }
    localStorage.setItem('automaton-vis:seen-help', '1');
  }, opts.clear ?? false);
  await page.goto('./');
}

/** Screen-space center of a state's circle. */
export async function stateCenter(page: Page, label: string): Promise<Point> {
  const box = await page.getByTestId(`state-${label}`).locator('.av-state-body').boundingBox();
  if (!box) throw new Error(`state ${label} not visible`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Double-click an empty spot of the canvas, offset from the svg's top-left corner. */
export async function addStateAt(page: Page, dx: number, dy: number): Promise<void> {
  const svg = await page.getByTestId('diagram').boundingBox();
  if (!svg) throw new Error('diagram not visible');
  await page.mouse.dblclick(svg.x + dx, svg.y + dy);
}

/** Draw a transition: Shift + drag from one state onto another. */
export async function shiftDrag(page: Page, from: string, to: string): Promise<void> {
  const a = await stateCenter(page, from);
  const b = await stateCenter(page, to);
  await page.keyboard.down('Shift');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
}

export async function clickState(page: Page, label: string): Promise<void> {
  const c = await stateCenter(page, label);
  await page.mouse.click(c.x, c.y);
}

/** An automaton's entry in the history bar. */
export function item(page: Page, name: string): Locator {
  return page.getByRole('navigation', { name: 'History' }).getByTestId('history-item').filter({
    hasText: name,
  });
}
