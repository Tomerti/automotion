import { expect, test } from '@playwright/test';
import { FIXTURES, addStateAt, clickState, item, openApp, shiftDrag } from './helpers.ts';

test('the hint strip says what to do next, and retires what has been learned', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  const strip = page.getByTestId('hint-strip');
  // Empty: the canvas's own hint, which also offers pasting TikZ and dropping files.
  await expect(page.getByTestId('canvas-hint')).toContainText('paste a TikZ picture with Ctrl+V');
  await expect(strip).toBeHidden();

  await addStateAt(page, 150, 150);
  await addStateAt(page, 400, 150);
  await page.mouse.click(5, 400); // somewhere off the diagram's states: clear the selection
  await page.keyboard.press('Escape');
  await expect(strip).toHaveAttribute('data-hint', 'connect');
  await expect(strip).toContainText('add a transition');

  await shiftDrag(page, 'q_0', 'q_1');
  await page.getByTestId('symbol-input').fill('a');
  await page.keyboard.press('Enter');

  await clickState(page, 'q_0');
  await expect(strip).toHaveAttribute('data-hint', 'one-selected');
  await expect(strip).toContainText('start state');
  // Pressing S three times teaches it: the part gives way to the next one.
  for (let i = 0; i < 3; i++) await page.keyboard.press('s');
  await expect(strip).not.toContainText('start state');
  await expect(strip).toContainText('accepting');

  // × hides the tip for good, also after a reload.
  await page.getByRole('button', { name: 'Hide this tip' }).click();
  await expect(strip).toBeHidden();
  await page.reload();
  await clickState(page, 'q_0');
  await expect(page.getByTestId('state-q_0')).toHaveAttribute('data-selected', 'true');
  await expect(strip).toBeHidden();
});

test('the strip suggests Convert to DFA on an NFA, and the conversion leads on to Minimize', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  await item(page, 'Ends in ab (NFA)').click();
  const strip = page.getByTestId('hint-strip');
  await expect(strip).toHaveAttribute('data-hint', 'convert');
  await strip.getByRole('button', { name: 'Convert to DFA' }).click();
  await expect(page.getByTestId('subset-view')).toBeVisible();
  await expect(strip).toBeHidden();

  await page.getByRole('button', { name: 'Last' }).click();
  await page.getByRole('button', { name: 'Save and minimize' }).click();
  await expect(page.getByTestId('block-legend')).toBeVisible();
  await expect(item(page, 'Ends in ab (NFA) → DFA')).toBeVisible();
});
