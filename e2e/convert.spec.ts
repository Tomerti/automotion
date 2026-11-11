import { expect, test } from '@playwright/test';
import { FIXTURES, item, openApp } from './helpers.ts';

test('convert an NFA to a DFA and save it', async ({ page }) => {
  await openApp(page, { clear: true });
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  await item(page, 'Ends in ab (NFA)').click();
  await page.getByRole('button', { name: 'Convert to DFA' }).click();
  await page.getByRole('button', { name: 'Last' }).click();
  await page.getByRole('button', { name: 'Save as new automaton' }).click();
  await expect(item(page, 'Ends in ab (NFA) → DFA')).toBeVisible();
});

test('convert an NFA to a DFA, then save and minimize it in one go', async ({ page }) => {
  await openApp(page, { clear: true });
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  await item(page, 'Ends in ab (NFA)').click();
  await page.getByRole('button', { name: 'Convert to DFA' }).click();
  await page.getByRole('button', { name: 'Last' }).click();
  await page.getByRole('button', { name: 'Save and minimize' }).click();
  await expect(item(page, 'Ends in ab (NFA) → DFA')).toBeVisible();
  await expect(page.getByTestId('block-legend')).toBeVisible();
});
