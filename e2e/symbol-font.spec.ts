import { expect, test, type Locator } from '@playwright/test';
import { FIXTURES, item, openApp } from './helpers.ts';

/** The font family an element (or its pseudo-element) is set in, as computed. */
const family = (el: Locator, pseudo?: string): Promise<string> =>
  el.evaluate((e, p) => getComputedStyle(e, p).fontFamily, pseudo ?? null);
/** Input symbols: IBM Plex Mono's dotted 0 reads neither as O (Geist's) nor as ∅ (a slashed one). */
const SYMBOLS = /^"?IBM Plex Mono"?,/;
const NAMES = /^"?Geist"?,/;

test('symbols are set in IBM Plex Mono, with its dotted 0; names stay in Geist', async ({ page }) => {
  await openApp(page, { clear: true });
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  await item(page, 'Even number of 0s (DFA)').click();

  const edgeLabel = page.getByTestId('edge-even-odd').getByTestId('edge-label');
  expect(await family(edgeLabel)).toMatch(SYMBOLS);
  expect(await family(page.getByTestId('state-even').locator('.av-state-label'))).toMatch(NAMES);

  await edgeLabel.dblclick();
  expect(await family(page.getByTestId('symbol-input'))).toMatch(SYMBOLS);
  await page.keyboard.press('Escape');

  // The word typed in "Test a word…" is symbols; the hint itself is not.
  const word = page.getByLabel('Word');
  expect(await family(word, '::placeholder')).toMatch(NAMES);
  await word.fill('0010');
  expect(await family(word)).toMatch(SYMBOLS);

  await page.getByRole('button', { name: 'Run' }).click();
  expect(await family(page.getByTestId('word-char').first())).toMatch(SYMBOLS);
});
