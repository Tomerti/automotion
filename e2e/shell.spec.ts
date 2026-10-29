import { expect, test } from '@playwright/test';
import { openApp } from './helpers.ts';

test('the welcome dialog opens on the first visit only; Controls opens on demand', async ({
  page,
}) => {
  await page.goto('./');
  const welcome = page.getByRole('dialog', { name: 'Welcome' });
  const controls = page.getByRole('dialog', { name: 'Controls' });
  await expect(welcome).toBeVisible();
  await expect(controls).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(welcome).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('canvas')).toBeVisible();
  await expect(welcome).toBeHidden();
  await expect(controls).toBeHidden();
  await page.getByRole('button', { name: 'Controls' }).click();
  await expect(controls).toBeVisible();
});

test('the theme starts light even on a dark system, and toggles light ↔ dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openApp(page, { clear: true });
  const html = page.locator('html');
  const toggle = page.getByRole('button', { name: /^Theme:/ });
  await expect(html).toHaveAttribute('data-theme', 'light');
  await toggle.click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await toggle.click();
  await expect(html).toHaveAttribute('data-theme', 'light');
});
