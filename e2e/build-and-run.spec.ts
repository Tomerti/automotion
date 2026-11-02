import { expect, test } from '@playwright/test';
import { addStateAt, clickState, openApp, shiftDrag, stateCenter } from './helpers.ts';

test('build a DFA, rename a state, and run a word', async ({ page }) => {
  await openApp(page, { clear: true });
  // First launch is one blank automaton, ready to draw on.
  await expect(page.getByTestId('canvas-hint')).toBeVisible();

  await addStateAt(page, 150, 150);
  await addStateAt(page, 400, 150);
  await expect(page.getByTestId('state-q_0')).toBeVisible();
  await expect(page.getByTestId('state-q_1')).toBeVisible();

  await shiftDrag(page, 'q_0', 'q_1');
  await page.getByTestId('symbol-input').fill('a');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('edge-q_0-q_1')).toBeVisible();

  // Regression guard: pointer capture must not swallow the dblclick on a state.
  const c = await stateCenter(page, 'q_1');
  await page.mouse.dblclick(c.x, c.y);
  await page.getByTestId('rename-input').fill('end');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('state-end')).toBeVisible();

  await clickState(page, 'q_0');
  await page.keyboard.press('s');
  await expect(page.getByTestId('state-q_0')).toHaveAttribute('data-start', 'true');
  await clickState(page, 'end');
  await page.keyboard.press('a');
  await expect(page.getByTestId('state-end')).toHaveAttribute('data-accepting', 'true');

  // end has no 'a' transition yet: an incomplete DFA can't be run.
  await page.getByLabel('Word').fill('a');
  const run = page.getByRole('button', { name: 'Run' });
  await expect(run).toBeDisabled();
  await expect(run).toHaveAttribute('title', /^Complete the DFA first/);

  // Shift-drag out of end and back onto it: a self-loop on 'a' completes the DFA.
  const e = await stateCenter(page, 'end');
  await page.keyboard.down('Shift');
  await page.mouse.move(e.x, e.y);
  await page.mouse.down();
  await page.mouse.move(e.x + 60, e.y - 60, { steps: 6 });
  await page.mouse.move(e.x, e.y, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.getByTestId('symbol-input').fill('a');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('edge-end-end')).toBeVisible();

  await run.click();
  await page.getByRole('button', { name: 'Last' }).click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-accepted', 'true');
  await expect(page.getByTestId('verdict')).toContainText('Accepted');
});

test('\\eps turns into ε and makes the automaton an NFA', async ({ page }) => {
  await openApp(page, { clear: true });
  await addStateAt(page, 150, 150);
  await addStateAt(page, 400, 150);
  await shiftDrag(page, 'q_0', 'q_1');
  const input = page.getByTestId('symbol-input');
  await input.pressSequentially('\\eps');
  await expect(input).toHaveValue('ε');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('edge-q_0-q_1').getByTestId('edge-label')).toHaveText('ε');
  await expect(page.getByRole('button', { name: 'NFA', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('drag an edge to curve it', async ({ page }) => {
  await openApp(page, { clear: true });
  await addStateAt(page, 150, 200);
  await addStateAt(page, 450, 200);
  await shiftDrag(page, 'q_0', 'q_1');
  await page.getByTestId('symbol-input').fill('a');
  await page.keyboard.press('Enter');

  const path = page.getByTestId('edge-q_0-q_1').locator('.av-edge-path');
  const before = await path.getAttribute('d');
  const a = await stateCenter(page, 'q_0');
  const b = await stateCenter(page, 'q_1');
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.down();
  await page.mouse.move(mid.x, mid.y - 60, { steps: 10 });
  await page.mouse.up();
  await expect(path).not.toHaveAttribute('d', before ?? '');
  await expect(path).toHaveAttribute('d', /Q/);
});

test('drag the start arrow to turn it around its state', async ({ page }) => {
  await openApp(page, { clear: true });
  await addStateAt(page, 300, 250);
  await clickState(page, 'q_0');
  await page.keyboard.press('s');

  const arrow = page.getByTestId('start-arrow');
  const c = await stateCenter(page, 'q_0');
  const box = await arrow.boundingBox();
  if (!box) throw new Error('no start arrow');
  // It comes from the left; drag its tail over the top round to the right of the state.
  expect(box.x + box.width).toBeLessThan(c.x);
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x, c.y - 80, { steps: 8 });
  await page.mouse.move(c.x + 80, c.y, { steps: 8 });
  await page.mouse.up();

  const turned = await arrow.boundingBox();
  if (!turned) throw new Error('no start arrow');
  expect(turned.x).toBeGreaterThan(c.x);
  await expect(page.getByTestId('state-q_0')).toHaveAttribute('data-start', 'true');
  expect(await stateCenter(page, 'q_0')).toEqual(c);
});
