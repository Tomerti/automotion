import { expect, test, type Page } from '@playwright/test';
import { FIXTURES, item } from './helpers.ts';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

async function copyLink(page: Page): Promise<string> {
  await page.evaluate(() => navigator.clipboard.writeText(''));
  await page.getByRole('button', { name: 'Copy or export' }).click();
  await page.getByRole('menuitem', { name: 'Copy link' }).click();
  await expect(page.getByText('Link copied')).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
}

const historyCount = (page: Page): Promise<number> =>
  page.getByRole('navigation', { name: 'History' }).getByTestId('history-item').count();

test('a share link opens its automaton in a fresh browser, once', async ({ page, browser }) => {
  await page.addInitScript(() => localStorage.setItem('automotion:seen-help', '1'));
  await page.goto('./');
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  await item(page, 'Ends in ab (NFA)').click();
  await expect(page.getByTestId('state-q_3')).toBeVisible();
  const link = await copyLink(page);
  expect(link).toContain('#a=');

  // A new context has fresh storage: a first visit, which the link replaces the welcome of.
  const context = await browser.newContext();
  const fresh = await context.newPage();
  await fresh.goto(link);
  await expect(fresh.getByText('Opened “Ends in ab (NFA)”')).toBeVisible();
  await expect(fresh.getByTestId('state-q_3')).toBeVisible();
  await expect(fresh.getByRole('dialog', { name: 'Welcome' })).toHaveCount(0);
  await expect(item(fresh, 'Ends in ab (NFA)')).toHaveCount(1);
  const count = await historyCount(fresh);
  expect(fresh.url()).not.toContain('#');

  // Reloading doesn't add it again, and the same link opens the saved copy.
  await fresh.reload();
  await expect(fresh.getByTestId('state-q_3')).toBeVisible();
  expect(await historyCount(fresh)).toBe(count);
  await fresh.goto(link);
  await expect(fresh.getByText('Opened “Ends in ab (NFA)”').first()).toBeVisible();
  expect(await historyCount(fresh)).toBe(count);
  expect(fresh.url()).not.toContain('#');

  // A broken link is reported, and its hash cleared too.
  await fresh.goto(new URL('./#a=broken', fresh.url()).href);
  await expect(fresh.getByText("This link's automaton couldn't be read")).toBeVisible();
  expect(fresh.url()).not.toContain('#');
  expect(await historyCount(fresh)).toBe(count);
  await context.close();
});
