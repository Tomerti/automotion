import { expect, test, type Page } from '@playwright/test';
import { clickState, FIXTURES, item, openApp } from './helpers.ts';

async function openRegexDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('menuitem', { name: 'From regex…' }).click();
}

test('from regex to a minimal DFA', async ({ page }) => {
  await openApp(page, { clear: true });
  await openRegexDialog(page);
  await page.getByTestId('regex-input').fill('(a|b)*abb');
  await page.keyboard.press('Enter');
  const first = page
    .getByRole('navigation', { name: 'History' })
    .getByTestId('history-item')
    .first();
  await expect(first).toContainText('(a|b)*abb');
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

test('to regex, picking a state', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openApp(page, { clear: true });
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  await item(page, 'Ends in ab (NFA)').click();
  await page.getByRole('button', { name: 'To regex' }).click();
  // Opens paused on the GNFA step.
  await expect(page.getByTestId('step-counter')).toHaveText('Step 1 / 10');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  const explanation = page.getByTestId('trace-player').locator('.av-player-explanation');
  // The automatic first pick is q₁ (one arrow in, one out); remove q₂ first instead.
  await expect(explanation).toContainText('Remove q₁');
  await clickState(page, 'q_2');
  await expect(explanation).toContainText('Remove q₂');
  await expect(page.getByTestId('step-counter')).toHaveText('Step 2 / 10');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.getByRole('button', { name: 'Last' }).click();
  await expect(page.getByTestId('regex-result')).not.toBeEmpty();
  const regex = await page.getByTestId('regex-result').textContent();
  await page.getByTestId('regex-copy').click();
  await expect(page.getByText('Regex copied')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(regex);
});
