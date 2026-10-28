import { expect, test } from '@playwright/test';
import { automataMenu, item, openApp } from './helpers.ts';

test('convert the example NFA to a DFA and save it', async ({ page }) => {
  await openApp(page, { clear: true });
  await automataMenu(page, 'Load examples');
  await (await item(page, 'Ends in ab (NFA)')).click();
  await page.getByRole('button', { name: 'Convert to DFA' }).click();
  await page.getByRole('button', { name: 'Last' }).click();
  await page.getByRole('button', { name: 'Save as new automaton' }).click();
  await expect(await item(page, 'Ends in ab (NFA) → DFA')).toBeVisible();
});
