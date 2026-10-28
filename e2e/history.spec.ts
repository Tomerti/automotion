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
  // The canvas takes the bar's place: it fills the full width.
  const fullWidth = async (): Promise<void> => {
    const box = await page.getByTestId('canvas').boundingBox();
    expect(box?.x).toBe(0);
    expect(box?.width).toBe(page.viewportSize()?.width);
  };
  await fullWidth();
  await page.reload();
  await expect(page.getByTestId('canvas')).toBeVisible();
  await expect(bar).toBeHidden();
  await fullWidth();
});

test('rename and delete an automaton from its ⋯ menu in the history bar', async ({ page }) => {
  await openApp(page, { clear: true });
  const bar = page.getByRole('navigation', { name: 'History' });
  const entries = bar.getByTestId('history-item');
  await bar.getByRole('button', { name: 'New NFA' }).click();
  await expect(entries).toHaveCount(2);
  // There is no dropdown in the top bar any more.
  await expect(page.getByRole('button', { name: 'Automata' })).toHaveCount(0);

  await bar.getByRole('button', { name: 'More actions for Untitled', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.getByRole('textbox', { name: 'Automaton name' }).fill('Mine');
  await page.keyboard.press('Enter');
  await expect(entries.first()).toContainText('Mine');
  await expect(page.locator('.av-switcher-name')).toHaveText('Mine');

  page.once('dialog', (d) => void d.accept());
  await bar.getByRole('button', { name: 'More actions for Untitled NFA' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('Mine');
});
