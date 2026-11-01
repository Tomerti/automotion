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

test('the theme follows the system until light or dark is chosen', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openApp(page, { clear: true });
  const html = page.locator('html');
  const button = page.getByRole('button', { name: /^Theme:/ });
  const choose = async (name: string): Promise<void> => {
    await button.click();
    await page.getByRole('menuitemradio', { name }).click();
  };
  await expect(button).toHaveAccessibleName('Theme: system');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(html).toHaveAttribute('data-theme', 'light');

  await choose('Dark');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(button).toHaveAccessibleName('Theme: dark');

  await choose('System');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(button).toHaveAccessibleName('Theme: system');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(html).toHaveAttribute('data-theme', 'dark');
});
