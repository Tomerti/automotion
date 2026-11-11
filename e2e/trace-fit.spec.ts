/// <reference lib="dom" />
// (The evaluate callbacks run in the page.)
import { expect, test, type Page } from '@playwright/test';
import { FIXTURES, item, openApp } from './helpers.ts';

declare global {
  interface Window {
    __fits?: string[];
  }
}

/**
 * Records the trace diagram's viewport transform on every animation frame (what gets painted),
 * from before the trace opens until it is stopped.
 */
async function recordTraceFits(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__fits = [];
    const sample = (): void => {
      const g = document.querySelector('.av-trace-diagram [data-testid="diagram"] > g');
      const t = g?.getAttribute('transform');
      if (t && window.__fits?.at(-1) !== t) window.__fits?.push(t);
      if (window.__fits) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function paintedFits(page: Page): Promise<string[]> {
  // Let a few more frames paint before reading.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  return page.evaluate(() => window.__fits ?? []);
}

test.use({ viewport: { width: 1600, height: 900 } });

test('the run view paints the diagram fitted to its real size from the first frame', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  await item(page, 'Even number of 0s (DFA)').click();
  await page.getByLabel('Word').fill('0');

  await recordTraceFits(page);
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByTestId('read-head')).toBeVisible();

  // One fit only: no frame drawn against a placeholder size before the real one.
  expect(await paintedFits(page)).toHaveLength(1);
});

test('the subset walkthrough paints its diagrams fitted from the first frame', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  await item(page, 'Ends in ab (NFA)').click();

  await recordTraceFits(page);
  await page.getByRole('toolbar', { name: 'Automaton tools' }).getByRole('button', { name: 'Convert to DFA' }).click();
  await expect(page.getByRole('button', { name: 'Last' })).toBeVisible();

  expect(await paintedFits(page)).toHaveLength(1);
});
