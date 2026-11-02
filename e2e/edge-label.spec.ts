import { expect, test } from '@playwright/test';
import { addStateAt, openApp, shiftDrag, stateCenter } from './helpers.ts';

test("drag an arrow's symbols below it, keep them there across a reload, then flip them back", async ({
  page,
}) => {
  await openApp(page, { clear: true });
  await addStateAt(page, 150, 200);
  await addStateAt(page, 400, 200);
  await shiftDrag(page, 'q_0', 'q_1');
  await page.getByTestId('symbol-input').fill('a');
  await page.keyboard.press('Enter');

  const edge = page.getByTestId('edge-q_0-q_1');
  const label = edge.getByTestId('edge-label');
  const q0 = await stateCenter(page, 'q_0');
  const labelY = async (): Promise<number> => {
    const box = await label.boundingBox();
    if (!box) throw new Error('label not visible');
    return box.y + box.height / 2;
  };
  // An arrow pointing right has its symbols above it.
  expect(await labelY()).toBeLessThan(q0.y);

  const box = await label.boundingBox();
  if (!box) throw new Error('label not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, q0.y + 20, { steps: 8 });
  await page.mouse.up();
  expect(await labelY()).toBeGreaterThan(q0.y);
  // The arrow itself stays straight.
  await expect(edge.locator('.av-edge-path')).toHaveAttribute('d', /^M [\d. -]+ L /);

  // A reload fits the view afresh, so measure the states again.
  await page.reload();
  const p0 = await stateCenter(page, 'q_0');
  const p1 = await stateCenter(page, 'q_1');
  expect(await labelY()).toBeGreaterThan(p0.y);

  await page.mouse.click((p0.x + p1.x) / 2, p0.y, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Label on other side' }).click();
  expect(await labelY()).toBeLessThan(p0.y);
});
