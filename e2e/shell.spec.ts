import { expect, test } from '@playwright/test';
import { openApp } from './helpers.ts';

test('the controls popup opens on the first visit only', async ({ page }) => {
  await page.goto('./');
  const dialog = page.getByRole('dialog', { name: 'Controls' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('canvas')).toBeVisible();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Controls' }).click();
  await expect(dialog).toBeVisible();
});

test('the theme toggle switches to light and dark', async ({ page }) => {
  await openApp(page, { clear: true });
  const html = page.locator('html');
  const toggle = page.getByRole('button', { name: /^Theme:/ });
  for (let i = 0; i < 3 && (await html.getAttribute('data-theme')) !== 'light'; i++) {
    await toggle.click();
  }
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
  for (let i = 0; i < 3 && (await html.getAttribute('data-theme')) !== 'dark'; i++) {
    await toggle.click();
  }
  await expect(html).toHaveAttribute('data-theme', 'dark');
});
