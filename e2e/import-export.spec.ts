import { expect, test } from '@playwright/test';
import { FIXTURES, item, openApp } from './helpers.ts';

const NAMES = ['Ends in ab (NFA)', 'Even number of 0s (DFA)'];

test('export all, then import into a fresh browser', async ({ page, browser }) => {
  await openApp(page, { clear: true });
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  for (const n of NAMES) await expect(item(page, n)).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all' }).click();
  await page.getByRole('menuitem', { name: 'Export all as JSON' }).click();
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

test('export all as LaTeX, then import the one .tex into a fresh browser', async ({
  page,
  browser,
}) => {
  await openApp(page, { clear: true });
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  for (const n of NAMES) await expect(item(page, n)).toBeVisible();
  const count = await page.getByTestId('history-item').count();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all' }).click();
  await page.getByRole('menuitem', { name: 'Export all as LaTeX' }).click();
  const tex = await download;
  expect(tex.suggestedFilename()).toBe('automata.tex');
  const file = await tex.path();

  const context = await browser.newContext();
  const fresh = await context.newPage();
  await openApp(fresh);
  await fresh.getByLabel('Import file').setInputFiles(file);
  for (const n of NAMES) await expect(item(fresh, n)).toBeVisible();
  // Every automaton but the blank one each browser starts with (nothing to draw) comes back.
  await expect(fresh.getByTestId('history-item')).toHaveCount(count);
  await context.close();
});

test('export LaTeX, then import the .tex into a fresh browser', async ({ page, browser }) => {
  await openApp(page, { clear: true });
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  const name = 'Ends in ab (NFA)';
  await expect(item(page, name)).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: `More actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Export LaTeX' }).click();
  const tex = await download;
  expect(tex.suggestedFilename()).toBe('ends-in-ab-nfa.tex');
  const file = await tex.path();

  const context = await browser.newContext();
  const fresh = await context.newPage();
  await openApp(fresh);
  await fresh.getByLabel('Import file').setInputFiles(file);
  await expect(item(fresh, name)).toBeVisible();
  await expect(item(fresh, name)).toContainText('NFA · 4 states');
  await expect(fresh.getByText('Imported 1 automaton')).toBeVisible();
  // It opens on import, drawn with the same states.
  for (const label of ['q_0', 'q_1', 'q_2', 'q_3']) {
    await expect(fresh.getByTestId(`state-${label}`)).toBeVisible();
  }
  await context.close();
});
