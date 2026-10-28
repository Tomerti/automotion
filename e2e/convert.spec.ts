import { expect, test } from '@playwright/test';
import { item } from './helpers.ts';

test('convert the example NFA to a DFA and save it', async ({ page }) => {
  await page.goto('./');
  await item(page, 'Ends in ab (NFA)').click();
  await page.getByRole('button', { name: 'Convert to DFA' }).click();
  const next = page.getByRole('button', { name: 'Next' });
  const save = page.getByRole('button', { name: 'Save as new automaton' });
  while (!(await save.isVisible())) await next.click();
  await save.click();
  await expect(item(page, 'Ends in ab (NFA) → DFA')).toBeVisible();
});
