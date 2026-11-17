import { expect, test, type Page } from '@playwright/test';
import { item, openApp } from './helpers.ts';

async function openRegexDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'or build one from a regex' }).click();
}

test('from regex fills the empty canvas with the minimal DFA, no new history entry', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  const items = page.getByRole('navigation', { name: 'History' }).getByTestId('history-item');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const count = await items.count();
  await openRegexDialog(page);
  await page.getByTestId('regex-input').fill('(a|b)*abb');
  await page.keyboard.press('Enter');
  const first = items.first();
  await expect(first).toContainText('(a|b)*abb');
  await expect(items).toHaveCount(count);
  await expect(first).toContainText('4 states');
  await expect(page.getByTestId('trace-player')).toHaveCount(0);
  await expect(item(page, '(a|b)*abb')).toBeVisible();
});

test('the empty canvas hint opens the same dialog', async ({ page }) => {
  await openApp(page, { clear: true });
  await page.getByRole('button', { name: 'or build one from a regex' }).click();
  await expect(page.getByRole('dialog', { name: 'Create a DFA from a regex' })).toBeVisible();
});

test('a parse error is shown in the dialog', async ({ page }) => {
  await openApp(page, { clear: true });
  await openRegexDialog(page);
  await page.getByTestId('regex-input').fill('a|');
  await expect(page.getByTestId('regex-error')).toBeVisible();
  await expect(page.getByTestId('regex-error')).toContainText('Nothing after |');
  await expect(page.getByTestId('regex-build')).toBeDisabled();
});
