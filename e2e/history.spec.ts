import { expect, test } from '@playwright/test';
import { addStateAt, openApp } from './helpers.ts';

test('the history bar lists automata newest edit first and switches between them', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  const bar = page.getByRole('navigation', { name: 'History' });
  const entries = bar.getByTestId('history-item');
  const name = page.locator('.av-switcher-name');
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('Untitled');
  await expect(entries.first()).toContainText('Empty');

  await bar.getByRole('button', { name: 'New NFA' }).click();
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText('Untitled NFA');
  await expect(entries.first()).toHaveAttribute('aria-current', 'page');
  await expect(name).toHaveText('Untitled NFA');

  // Opening the older one doesn't reorder; editing it moves it to the top with a picture.
  await entries.nth(1).click();
  await expect(name).toHaveText('Untitled');
  await expect(entries.first()).toContainText('Untitled NFA');
  await addStateAt(page, 300, 200);
  await expect(entries.first()).toContainText('Untitled');
  await expect(entries.first()).toContainText('DFA · 1 state');
  await expect(entries.first().getByTestId('history-thumbnail')).toBeVisible();

  // The History button hides the bar, and the choice survives a reload.
  await page.getByRole('button', { name: 'History' }).click();
  await expect(bar).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('canvas')).toBeVisible();
  await expect(bar).toBeHidden();
});
