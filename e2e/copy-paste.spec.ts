import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addStateAt, openApp, shiftDrag, stateCenter } from './helpers.ts';

async function arrow(page: Page, from: string, to: string, symbols: string): Promise<void> {
  await shiftDrag(page, from, to);
  await page.getByTestId('symbol-input').fill(symbols);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId(`edge-${from}-${to}`)).toBeVisible();
}

/** Ctrl + drag a selection box between two screen points. */
async function boxSelect(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.keyboard.down('Control');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await expect(page.getByTestId('select-box')).toBeVisible();
  await page.mouse.up();
  await page.keyboard.up('Control');
}

test('box-select a chain, copy it and paste it with its arrows', async ({ page }) => {
  await openApp(page, { clear: true });
  await addStateAt(page, 120, 150);
  await addStateAt(page, 280, 150);
  await addStateAt(page, 440, 150);
  await arrow(page, 'q_0', 'q_1', 'a');
  await arrow(page, 'q_1', 'q_2', 'a');
  await arrow(page, 'q_2', 'q_0', 'b');

  // A box around q_1 and q_2 selects them and the arrow between them.
  const q1 = await stateCenter(page, 'q_1');
  const q2 = await stateCenter(page, 'q_2');
  await boxSelect(page, { x: q1.x - 50, y: q1.y - 50 }, { x: q2.x + 50, y: q2.y + 50 });
  await expect(page.getByTestId('state-q_1')).toHaveAttribute('data-selected', 'true');
  await expect(page.getByTestId('state-q_2')).toHaveAttribute('data-selected', 'true');
  await expect(page.getByTestId('state-q_0')).not.toHaveAttribute('data-selected', 'true');

  await page.keyboard.press('Control+c');
  // Paste at the pointer, below the chain.
  await page.mouse.move((q1.x + q2.x) / 2, q1.y + 180);
  await page.keyboard.press('Control+v');

  const copy1 = page.getByTestId("state-q_1'");
  const copy2 = page.getByTestId("state-q_2'");
  await expect(copy1).toBeVisible();
  await expect(copy2).toBeVisible();
  await expect(copy1).toHaveAttribute('data-selected', 'true');
  await expect(page.getByTestId("edge-q_1'-q_2'")).toBeVisible();
  // The arrow out to q_0 comes along; the arrow into the chain does not.
  await expect(page.getByTestId("edge-q_2'-q_0")).toBeVisible();
  await expect(page.getByTestId("edge-q_0-q_1'")).toHaveCount(0);
  const c1 = await stateCenter(page, "q_1'");
  expect(Math.abs(c1.x - q1.x)).toBeLessThan(2);
  expect(Math.abs(c1.y - (q1.y + 180))).toBeLessThan(2);

  // Dragging one pasted state moves both.
  const c2 = await stateCenter(page, "q_2'");
  await page.mouse.move(c1.x, c1.y);
  await page.mouse.down();
  await page.mouse.move(c1.x + 37, c1.y + 53, { steps: 8 });
  await page.mouse.up();
  const moved2 = await stateCenter(page, "q_2'");
  expect(Math.abs(moved2.x - (c2.x + 37))).toBeLessThan(2);
  expect(Math.abs(moved2.y - (c2.y + 53))).toBeLessThan(2);

  // One undo removes the paste's move, the next the paste.
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(copy1).toHaveCount(0);
  await expect(page.getByTestId('state-q_1')).toBeVisible();
});

test('a copy pastes into another automaton', async ({ page }) => {
  await openApp(page, { clear: true });
  await addStateAt(page, 150, 150);
  await addStateAt(page, 320, 150);
  await arrow(page, 'q_0', 'q_1', 'a');
  const q0 = await stateCenter(page, 'q_0');
  const q1 = await stateCenter(page, 'q_1');
  await boxSelect(page, { x: q0.x - 50, y: q0.y - 50 }, { x: q1.x + 50, y: q1.y + 50 });
  await page.keyboard.press('Control+c');

  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByTestId('canvas-hint')).toBeVisible();
  await page.mouse.move(q0.x + 60, q0.y + 60);
  await page.keyboard.press('Control+v');
  // Names are free here, so they stay as they were.
  await expect(page.getByTestId('state-q_0')).toBeVisible();
  await expect(page.getByTestId('state-q_1')).toBeVisible();
  await expect(page.getByTestId('edge-q_0-q_1')).toBeVisible();
});

test('Ctrl+A selects everything, Ctrl+X cuts it and Ctrl+V puts it back in place', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  await addStateAt(page, 150, 150);
  await addStateAt(page, 320, 150);
  await arrow(page, 'q_0', 'q_1', 'a');
  const q0 = await stateCenter(page, 'q_0');

  await page.keyboard.press('Control+a');
  await expect(page.getByTestId('state-q_0')).toHaveAttribute('data-selected', 'true');
  await expect(page.getByTestId('state-q_1')).toHaveAttribute('data-selected', 'true');

  await page.keyboard.press('Control+x');
  await expect(page.getByTestId('state-q_0')).toHaveCount(0);
  await expect(page.getByTestId('state-q_1')).toHaveCount(0);

  // With the pointer off the canvas, the first paste lands where the states were cut from.
  await page.mouse.move(5, 5);
  await page.keyboard.press('Control+v');
  await expect(page.getByTestId('edge-q_0-q_1')).toBeVisible();
  const back = await stateCenter(page, 'q_0');
  expect(Math.abs(back.x - q0.x)).toBeLessThan(2);
  expect(Math.abs(back.y - q0.y)).toBeLessThan(2);

  // Shift + drag inside a selection of everything still draws an arrow, moving nothing.
  await page.keyboard.press('Control+a');
  await arrow(page, 'q_1', 'q_0', 'b');
  const after = await stateCenter(page, 'q_0');
  expect(Math.abs(after.x - q0.x)).toBeLessThan(2);
  expect(Math.abs(after.y - q0.y)).toBeLessThan(2);

  // Ctrl+A gives the canvas the keyboard, so Delete clears it.
  await page.getByRole('button', { name: 'Fit' }).focus();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('state-q_0')).toHaveCount(0);
  await expect(page.getByTestId('canvas-hint')).toBeVisible();
});
