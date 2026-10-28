import type { Locator, Page } from '@playwright/test';

export interface Point {
  x: number;
  y: number;
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

/** Draw a transition by dragging from a state's outer ring onto another state. */
export async function ringDrag(page: Page, from: string, to: string): Promise<void> {
  const a = await stateCenter(page, from);
  const b = await stateCenter(page, to);
  await page.mouse.move(a.x + 28, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
}

export async function clickState(page: Page, label: string): Promise<void> {
  const c = await stateCenter(page, label);
  await page.mouse.click(c.x, c.y);
}

export function item(page: Page, name: string): Locator {
  return page.getByTestId('automaton-item').filter({ hasText: name });
}
