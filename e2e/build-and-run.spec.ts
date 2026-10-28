import { expect, test } from '@playwright/test';
import { addStateAt, clickState, ringDrag, stateCenter } from './helpers.ts';

test('build a DFA, rename a state, and run a word', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('./');
  await page.getByRole('button', { name: 'New DFA' }).click();

  await addStateAt(page, 150, 150);
  await addStateAt(page, 400, 150);
  await expect(page.getByTestId('state-q0')).toBeVisible();
  await expect(page.getByTestId('state-q1')).toBeVisible();

  await ringDrag(page, 'q0', 'q1');
  await page.getByTestId('symbol-input').fill('a');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('edge-q0-q1')).toBeVisible();

  // Regression guard: pointer capture must not swallow the dblclick on a state.
  const c = await stateCenter(page, 'q1');
  await page.mouse.dblclick(c.x, c.y);
  await page.getByTestId('rename-input').fill('end');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('state-end')).toBeVisible();

  await clickState(page, 'q0');
  await page.keyboard.press('s');
  await clickState(page, 'end');
  await page.keyboard.press('a');

  await page.getByLabel('Word').fill('a');
  await page.getByRole('button', { name: 'Run' }).click();
  const next = page.getByRole('button', { name: 'Next' });
  while (await next.isEnabled()) await next.click();
  await expect(page.getByTestId('verdict')).toHaveText(/Accepted/);
});
