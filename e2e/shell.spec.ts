import { expect, test } from '@playwright/test';
import { addStateAt, openApp } from './helpers.ts';

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

test('switching the theme recolours everything at once, with no fade from the old theme', async ({
  page,
}) => {
  // Buttons, tape cells and states fade their colours on hover and during a run; a theme switch
  // must not reuse that fade, or white buttons linger for a moment on a page gone dark.
  await page.emulateMedia({ colorScheme: 'light' });
  await openApp(page, { clear: true });
  await addStateAt(page, 200, 150);
  await expect(page.getByTestId('state-q_0')).toBeVisible();
  for (const name of ['Dark', 'Light']) {
    await page.getByRole('button', { name: /^Theme:/ }).click();
    // Inside the page: click, read the colours two frames later (before any fade could finish),
    // then again once every fade would have finished.
    const { soon, settled } = await page
      .getByRole('menuitemradio', { name })
      .evaluate(async (item) => {
        const colours = (): string[] =>
          ['button[title^="Create a new automaton"]', '[data-testid="state-q_0"] .av-state-body']
            .map((sel) => getComputedStyle(document.querySelector(sel)!))
            .map((style) => `${style.backgroundColor} ${style.fill}`);
        (item as HTMLElement).click();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const soon = colours();
        await new Promise((r) => setTimeout(r, 500));
        return { soon, settled: colours() };
      });
    expect(soon).toEqual(settled);
  }
  // Only the switch itself skips the fades; hover and runs keep theirs.
  await expect(page.locator('html')).not.toHaveClass(/av-theme-switching/);
});
