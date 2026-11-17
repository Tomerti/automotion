import { expect, test, type Page } from '@playwright/test';
import { item, openApp } from './helpers.ts';

async function openRegexDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'More ways to create' }).click();
  await page.getByRole('menuitem', { name: 'From regex…' }).click();
}

test('from regex to a saved NFA', async ({ page }) => {
  await openApp(page, { clear: true });
  await openRegexDialog(page);
  await page.getByTestId('regex-input').fill('(a|b)*abb');
  await page.keyboard.press('Enter');
  // The walkthrough opens playing, so it may already be past step 1.
  await expect(page.getByTestId('step-counter')).toHaveText(/\/ 12$/);
  await page.getByRole('button', { name: 'Last' }).click();
  await expect(page.getByTestId('step-counter')).toHaveText('Step 12 / 12');
  await page.getByRole('button', { name: 'Save as new automaton' }).click();
  const first = page
    .getByRole('navigation', { name: 'History' })
    .getByTestId('history-item')
    .first();
  await expect(first).toContainText('(a|b)*abb');
  await expect(first).toContainText('14 states');
  await expect(item(page, '(a|b)*abb')).toBeVisible();
});

test('the empty canvas hint opens the same dialog', async ({ page }) => {
  await openApp(page, { clear: true });
  await page.getByRole('button', { name: 'or build one from a regex' }).click();
  await expect(page.getByRole('dialog', { name: 'Build an NFA from a regex' })).toBeVisible();
});

test('a parse error is shown in the dialog', async ({ page }) => {
  await openApp(page, { clear: true });
  await openRegexDialog(page);
  await page.getByTestId('regex-input').fill('a|');
  await expect(page.getByTestId('regex-error')).toBeVisible();
  await expect(page.getByTestId('regex-error')).toContainText('Nothing after |');
  await expect(page.getByTestId('regex-build')).toBeDisabled();
});
