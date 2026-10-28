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
  await page.keyboard.press('Space');
  await expect(page.getByTestId('state-q_0')).toHaveAttribute('data-start', 'true');
  await clickState(page, 'end');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('state-end')).toHaveAttribute('data-accepting', 'true');

  await page.getByLabel('Word').fill('a');
  await page.getByRole('button', { name: 'Run' }).click();
  await page.getByRole('button', { name: 'Last' }).click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-accepted', 'true');
  await expect(page.getByTestId('verdict')).toContainText('Accepted');
});

test('\\epsilon turns into ε and makes the automaton an NFA', async ({ page }) => {
  await openApp(page, { clear: true });
  await addStateAt(page, 150, 150);
  await addStateAt(page, 400, 150);
  await shiftDrag(page, 'q_0', 'q_1');
  const input = page.getByTestId('symbol-input');
  await input.pressSequentially('\\epsilon');
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
