import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { FIXTURES, item, openApp } from './helpers.ts';

/**
 * Exports LaTeX the way a user does and keeps the files: CI's `latex` job compiles every one
 * with pdflatex (set LATEX_SAMPLES_DIR to choose where they go).
 */
const FEATURES = fileURLToPath(new URL('./fixtures/latex-features.json', import.meta.url));
const OUT = process.env.LATEX_SAMPLES_DIR ?? join('test-results', 'latex-samples');
const FEATURES_NAME = 'Every LaTeX feature (NFA) #1 & 100% {x}';

test('export LaTeX samples for CI to compile', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await openApp(page, { clear: true });
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  await page.getByLabel('Import file').setInputFiles(FEATURES);
  await expect(item(page, FEATURES_NAME)).toBeVisible();

  // One automaton with every feature the writer has, on its own.
  let download = page.waitForEvent('download');
  await page.getByRole('button', { name: `More actions for ${FEATURES_NAME}` }).click();
  await page.getByRole('menuitem', { name: 'Export LaTeX' }).click();
  await (await download).saveAs(join(OUT, 'features.tex'));

  // Every automaton in one document, a page each.
  download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all' }).click();
  await page.getByRole('menuitem', { name: 'Export all as LaTeX' }).click();
  await (await download).saveAs(join(OUT, 'all.tex'));
});
