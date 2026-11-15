import { expect, test } from '@playwright/test';
import { openApp } from './helpers.ts';

test('? opens the guide, Lessons lists Basics, and its row starts the tutorial', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  await page.keyboard.press('?');
  const guide = page.getByRole('dialog', { name: 'Controls' });
  await guide.getByRole('button', { name: 'Lessons' }).click();
  await expect(guide.getByRole('tab', { name: 'Lessons' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await guide.getByTestId('lesson-basics').click();
  await expect(guide).toBeHidden();
  await expect(page.getByTestId('tutorial-card')).toBeVisible();

  // While it runs, its row offers a restart.
  await page.keyboard.press('?');
  await guide.getByRole('tab', { name: 'Lessons' }).click();
  await expect(guide.getByTestId('lesson-basics')).toContainText('Restart');
});
