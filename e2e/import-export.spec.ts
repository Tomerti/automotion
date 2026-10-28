import { expect, test } from '@playwright/test';
import { item } from './helpers.ts';

const NAMES = ['Ends in ab (NFA)', 'Even number of 0s (DFA)', 'Redundant states (DFA)'];

test('export all, wipe storage, re-import', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await page.goto('./');
  for (const n of NAMES) await expect(item(page, n)).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all' }).click();
  const file = await (await download).path();

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // A clean storage seeds the examples again; remove them so the import is the only source.
  for (const n of NAMES) await page.getByRole('button', { name: `Delete ${n}` }).click();
  await expect(page.getByTestId('automaton-item')).toHaveCount(0);

  await page.getByLabel('Import file').setInputFiles(file);
  for (const n of NAMES) await expect(item(page, n)).toBeVisible();
  await expect(page.getByTestId('automaton-item')).toHaveCount(NAMES.length);
});
