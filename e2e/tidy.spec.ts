import { expect, test } from '@playwright/test';
import { clickState, FIXTURES, item, openApp, stateCenter } from './helpers.ts';

test('Tidy lays the automaton out in a web worker', async ({ page }) => {
  // The on-page fallback chunk (layout-*.js) is only fetched when the worker can't run.
  const fallback: string[] = [];
  page.on('request', (r) => {
    if (/\/layout-[^/]*\.js$/.test(r.url())) fallback.push(r.url());
  });
  await openApp(page, { clear: true });
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  await item(page, 'Ends in ab (NFA)').click();

  // Drag q_1 well below the others, so Tidy has something to put back.
  const from = await stateCenter(page, 'q_1');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 160, { steps: 10 });
  await page.mouse.up();
  const dy = async () => (await stateCenter(page, 'q_1')).y - (await stateCenter(page, 'q_0')).y;
  const dragged = await dy();

  const worker = page.waitForEvent('worker');
  await page.getByRole('button', { name: 'Tidy' }).click();
  await worker;
  await expect.poll(dy).not.toBeCloseTo(dragged, 0);
  await expect(page.getByText('Could not lay out the automaton')).toHaveCount(0);
  expect(fallback).toEqual([]);
});

test('T on the canvas tidies, but not while typing a word', async ({ page }) => {
  await openApp(page, { clear: true });
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  await item(page, 'Ends in ab (NFA)').click();

  // Typed into the word box, T is a letter of the word.
  const word = page.getByLabel('Word');
  await word.click();
  await page.keyboard.press('t');
  await expect(word).toHaveValue('t');
  await word.fill('');

  // A drag leaves the keyboard on the canvas, where T tidies.
  const from = await stateCenter(page, 'q_1');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 160, { steps: 10 });
  await page.mouse.up();
  const dy = async () => (await stateCenter(page, 'q_1')).y - (await stateCenter(page, 'q_0')).y;
  const dragged = await dy();
  await page.keyboard.press('t');
  await expect.poll(dy).not.toBeCloseTo(dragged, 0);
});

test('F on the canvas fits the view, like the Fit button', async ({ page }) => {
  await openApp(page, { clear: true });
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  await item(page, 'Ends in ab (NFA)').click();

  await page.getByRole('button', { name: 'Fit' }).click();
  const fitted = await stateCenter(page, 'q_1');

  // Click a state (the canvas takes the keyboard) and zoom in; F puts the view back.
  await clickState(page, 'q_1');
  await page.mouse.move(fitted.x + 120, fitted.y + 80);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => (await stateCenter(page, 'q_1')).x).not.toBeCloseTo(fitted.x, 0);
  await page.keyboard.press('f');
  await expect.poll(async () => (await stateCenter(page, 'q_1')).x).toBeCloseTo(fitted.x, 0);
  expect((await stateCenter(page, 'q_1')).y).toBeCloseTo(fitted.y, 0);
});
