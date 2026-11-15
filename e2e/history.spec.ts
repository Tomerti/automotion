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

  // Create makes a DFA; the pill at the top of the canvas switches it to an NFA.
  await bar.getByRole('button', { name: 'Create' }).click();
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText('Untitled 2');
  await expect(entries.first()).toContainText('DFA');
  await expect(entries.first()).toHaveAttribute('aria-current', 'page');
  await expect(name).toHaveText('Untitled 2');
  await page.getByRole('group', { name: 'Kind' }).getByRole('button', { name: 'NFA' }).click();
  await expect(entries.first()).toContainText('NFA · 0 states');

  // Opening the older one doesn't reorder; editing it moves it to the top with a picture.
  await entries.nth(1).click();
  await expect(name).toHaveText('Untitled');
  await expect(entries.first()).toContainText('Untitled 2');
  await addStateAt(page, 300, 200);
  await expect(entries.first()).toContainText('Untitled');
  await expect(entries.first()).toContainText('DFA · 1 state');
  await expect(entries.first().getByTestId('history-thumbnail')).toBeVisible();

  // The bar floats over the canvas, which fills the full width either way, so the run pill
  // stays centred on the window.
  const fullWidth = async (): Promise<void> => {
    const box = await page.getByTestId('canvas').boundingBox();
    expect(box?.x).toBe(0);
    expect(box?.width).toBe(page.viewportSize()?.width);
    const pill = await page.getByLabel('Word').locator('xpath=..').boundingBox();
    expect(Math.round(pill!.x + pill!.width / 2)).toBe(page.viewportSize()!.width / 2);
  };
  await fullWidth();

  // The History button hides the bar, and the choice survives a reload.
  await page.getByRole('button', { name: 'History' }).click();
  await expect(bar).toBeHidden();
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
  await bar.getByRole('button', { name: 'Create' }).click();
  await expect(entries).toHaveCount(2);
  // There is no dropdown in the top bar any more.
  await expect(page.getByRole('button', { name: 'Automata' })).toHaveCount(0);

  await bar.getByRole('button', { name: 'More actions for Untitled', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.getByRole('textbox', { name: 'Automaton name' }).fill('Mine');
  await page.keyboard.press('Enter');
  await expect(entries.first()).toContainText('Mine');
  await expect(page.locator('.av-switcher-name')).toHaveText('Mine');

  await bar.getByRole('button', { name: 'More actions for Untitled 2' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const ask = page.getByRole('alertdialog', { name: 'Delete "Untitled 2"?' });
  await ask.getByRole('button', { name: 'Delete' }).click();
  await expect(ask).toHaveCount(0);
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('Mine');
});

test('duplicate an automaton from its ⋯ menu; the copy is edited on its own', async ({ page }) => {
  await openApp(page, { clear: true });
  const bar = page.getByRole('navigation', { name: 'History' });
  const entries = bar.getByTestId('history-item');
  await addStateAt(page, 300, 200);
  await expect(entries.first()).toContainText('DFA · 1 state');

  await bar.getByRole('button', { name: 'More actions for Untitled' }).click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText('Untitled copy');
  await expect(entries.first()).toContainText('DFA · 1 state');
  await expect(entries.first()).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.av-switcher-name')).toHaveText('Untitled copy');

  // Editing the copy leaves the original as it was, and both survive a reload.
  await addStateAt(page, 300, 300);
  await expect(entries.first()).toContainText('Untitled copy');
  await expect(entries.first()).toContainText('DFA · 2 states');
  await expect(entries.nth(1)).toContainText('DFA · 1 state');
  await page.reload();
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText('Untitled copy');
  await expect(entries.nth(1)).toContainText('Untitled');
});

test('Ctrl+C on a history entry copies it and Ctrl+V adds a copy', async ({ page }) => {
  await openApp(page, { clear: true });
  const bar = page.getByRole('navigation', { name: 'History' });
  const entries = bar.getByTestId('history-item');
  await addStateAt(page, 300, 200);
  await bar.getByRole('button', { name: 'Create' }).click();
  await expect(entries).toHaveCount(2);

  await entries.nth(1).click();
  await page.keyboard.press('Control+c');
  await expect(page.getByText('Copied "Untitled": Ctrl+V adds a copy of it')).toBeVisible();
  await page.keyboard.press('Control+v');
  await expect(entries).toHaveCount(3);
  await expect(entries.first()).toContainText('Untitled copy');
  await expect(entries.first()).toContainText('DFA · 1 state');
  await expect(entries.first()).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.av-switcher-name')).toHaveText('Untitled copy');
});

test('the Delete key deletes a clicked history entry after asking', async ({ page }) => {
  await openApp(page, { clear: true });
  const bar = page.getByRole('navigation', { name: 'History' });
  const entries = bar.getByTestId('history-item');
  await bar.getByRole('button', { name: 'Create' }).click();
  await expect(entries).toHaveCount(2);

  await entries.nth(1).click();
  await page.keyboard.press('Delete');
  const ask = page.getByRole('alertdialog', { name: 'Delete "Untitled"?' });
  await expect(ask).toBeVisible();
  // Escape cancels and gives the entry its focus back.
  await page.keyboard.press('Escape');
  await expect(ask).toHaveCount(0);
  await expect(entries).toHaveCount(2);
  await expect(entries.nth(1)).toBeFocused();
  // Delete, then Enter on the focused Delete button.
  await page.keyboard.press('Delete');
  await expect(ask.getByRole('button', { name: 'Delete' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('Untitled 2');
});

test('Ctrl+click picks several history entries and Delete deletes them together', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  const bar = page.getByRole('navigation', { name: 'History' });
  const entries = bar.getByTestId('history-item');
  await bar.getByRole('button', { name: 'Create' }).click();
  await bar.getByRole('button', { name: 'Create' }).click();
  await expect(entries).toHaveCount(3);

  // The open automaton ("Untitled 3", on top) starts the selection.
  await entries.nth(2).click({ modifiers: ['ControlOrMeta'] });
  await expect(entries.nth(0)).toHaveAttribute('data-selected', 'true');
  await expect(entries.nth(1)).not.toHaveAttribute('data-selected');
  await expect(entries.nth(2)).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('.av-switcher-name')).toHaveText('Untitled 3');

  await page.keyboard.press('Delete');
  const ask = page.getByRole('alertdialog', { name: 'Delete 2 automata?' });
  await expect(ask.getByRole('listitem')).toHaveText(['Untitled 3', 'Untitled']);
  await ask.getByRole('button', { name: 'Delete' }).click();
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('Untitled 2');
  await expect(entries.first()).not.toHaveAttribute('data-selected');
  await expect(entries.first()).toHaveAttribute('aria-current', 'page');
});

test('Ctrl+A on a history entry picks every automaton and Delete deletes them all', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  const bar = page.getByRole('navigation', { name: 'History' });
  const entries = bar.getByTestId('history-item');
  await bar.getByRole('button', { name: 'Create' }).click();
  await bar.getByRole('button', { name: 'Create' }).click();
  await expect(entries).toHaveCount(3);

  await entries.nth(1).click();
  await page.keyboard.press('ControlOrMeta+a');
  for (let i = 0; i < 3; i++) await expect(entries.nth(i)).toHaveAttribute('data-selected', 'true');

  await page.keyboard.press('Delete');
  const ask = page.getByRole('alertdialog', { name: 'Delete 3 automata?' });
  await expect(ask.getByRole('listitem')).toHaveText(['Untitled 3', 'Untitled 2', 'Untitled']);
  await ask.getByRole('button', { name: 'Delete' }).click();
  // The canvas is never left empty: a fresh blank automaton takes their place.
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('Untitled');
  await expect(entries.first()).toContainText('DFA · 0 states');
});
