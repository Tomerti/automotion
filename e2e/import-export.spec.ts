import { expect, test } from '@playwright/test';
import { automataMenu, item, openApp } from './helpers.ts';

const NAMES = ['Ends in ab (NFA)', 'Even number of 0s (DFA)', 'Redundant states (DFA)'];

test('export all, wipe storage, re-import', async ({ page }) => {
  await openApp(page, { clear: true });
  await automataMenu(page, 'Load examples');
  for (const n of NAMES) await expect(await item(page, n)).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export all' }).click();
  const file = await (await download).path();

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // A clean storage starts with one blank automaton and no examples.
  await expect(page.getByTestId('canvas-hint')).toBeVisible();
  await expect(await item(page, 'Untitled')).toBeVisible();
  await expect(page.getByTestId('automaton-item')).toHaveCount(1);
  await page.keyboard.press('Escape');

  await page.getByLabel('Import file').setInputFiles(file);
  for (const n of NAMES) await expect(await item(page, n)).toBeVisible();
});
