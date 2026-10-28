import { expect, test } from '@playwright/test';
import { FIXTURES, item, openApp } from './helpers.ts';

const NAMES = ['Ends in ab (NFA)', 'Even number of 0s (DFA)'];

test('export all, then import into a fresh browser', async ({ page, browser }) => {
  await openApp(page, { clear: true });
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  for (const n of NAMES) await expect(item(page, n)).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all' }).click();
  const file = await (await download).path();

  // A new context has empty storage. (Clearing and reloading would race the pagehide autosave.)
  const context = await browser.newContext();
  const fresh = await context.newPage();
  await openApp(fresh);
  // A clean storage starts with one blank automaton.
  await expect(fresh.getByTestId('canvas-hint')).toBeVisible();
  await expect(item(fresh, 'Untitled')).toBeVisible();
  await expect(fresh.getByTestId('history-item')).toHaveCount(1);

  await fresh.getByLabel('Import file').setInputFiles(file);
  for (const n of NAMES) await expect(item(fresh, n)).toBeVisible();
  await context.close();
});
