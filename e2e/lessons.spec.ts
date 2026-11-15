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

test('the NFAs lesson runs aab step by step, plays it, runs aba and finishes', async ({ page }) => {
  await openApp(page, { clear: true });
  await page.keyboard.press('?');
  const guide = page.getByRole('dialog', { name: 'Controls' });
  await guide.getByRole('tab', { name: 'Lessons' }).click();
  await guide.getByTestId('lesson-nfa').click();
  const card = page.getByTestId('tutorial-card');
  await expect(card).toBeVisible();
  const at = (n: number) => expect(card).toHaveAttribute('data-step', String(n));
  await at(1);

  const word = page.getByLabel('Word');
  await word.fill('aab');
  await word.press('Enter');
  await at(2);

  // Opened paused: step with → until the first branch is crossed out.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await at(3);

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-accepted', 'true');
  await at(4);

  await page.keyboard.press('Escape');
  await word.fill('aba');
  await word.press('Enter');
  await page.getByRole('button', { name: 'Last' }).click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-accepted', 'false');
  await at(5);

  await card.getByRole('button', { name: 'Finish' }).click();
  const popup = page.getByRole('dialog', { name: 'Lesson complete' });
  await popup.getByRole('button', { name: 'Back to building' }).click();
  await page.keyboard.press('?');
  await guide.getByRole('tab', { name: 'Lessons' }).click();
  await expect(guide.getByTestId('lesson-nfa')).toContainText('✓');
});

test('the Convert lesson steps through the subset construction, saves the DFA and finishes', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  await page.keyboard.press('?');
  const guide = page.getByRole('dialog', { name: 'Controls' });
  await guide.getByRole('tab', { name: 'Lessons' }).click();
  await guide.getByTestId('lesson-convert').click();
  const card = page.getByTestId('tutorial-card');
  await expect(card).toBeVisible();
  await expect(card.getByTestId('tutorial-goal-picture')).toHaveCount(1);
  const at = (n: number) => expect(card).toHaveAttribute('data-step', String(n));
  await at(1);

  await page.getByRole('button', { name: 'Convert to DFA' }).click();
  await at(2);

  // Opened paused on the first DFA state: one press moves on, two more reach the pair's turn.
  await page.keyboard.press('ArrowRight');
  await at(3);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await at(4);

  await page.getByRole('button', { name: 'Last' }).click();
  await at(5);

  await page.getByRole('button', { name: 'Save as new automaton' }).click();
  await at(6);

  await card.getByRole('button', { name: 'Finish' }).click();
  const popup = page.getByRole('dialog', { name: 'Lesson complete' });
  await popup.getByRole('button', { name: 'Back to building' }).click();
  const history = page.getByRole('navigation', { name: 'History' });
  await expect(history).toContainText('Contains 01 → DFA');
  await page.keyboard.press('?');
  await guide.getByRole('tab', { name: 'Lessons' }).click();
  await expect(guide.getByTestId('lesson-convert')).toContainText('✓');
});

test('the Minimize lesson splits a block, merges the states, saves the DFA and finishes', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  await page.keyboard.press('?');
  const guide = page.getByRole('dialog', { name: 'Controls' });
  await guide.getByRole('tab', { name: 'Lessons' }).click();
  await guide.getByTestId('lesson-minimize').click();
  const card = page.getByTestId('tutorial-card');
  await expect(card).toBeVisible();
  await expect(card.getByTestId('tutorial-goal-picture')).toHaveCount(1);
  const at = (n: number) => expect(card).toHaveAttribute('data-step', String(n));
  await at(1);

  await page.getByRole('button', { name: 'Minimize' }).click();
  await at(2);

  // Opened paused: step with the arrow until the block splits.
  for (let i = 0; i < 12; i++) {
    if ((await card.getAttribute('data-step')) !== '2') break;
    await page.keyboard.press('ArrowRight');
  }
  await at(3);

  await page.getByRole('button', { name: 'Last' }).click();
  await at(4);

  await page.getByRole('button', { name: 'Save as new automaton' }).click();
  await at(5);

  await card.getByRole('button', { name: 'Finish' }).click();
  const popup = page.getByRole('dialog', { name: 'Lesson complete' });
  await popup.getByRole('button', { name: 'Back to building' }).click();
  await page.keyboard.press('?');
  await guide.getByRole('tab', { name: 'Lessons' }).click();
  await expect(guide.getByTestId('lesson-minimize')).toContainText('✓');
});

test('the Share lesson shares a link, copies the picture, exports LaTeX and finishes', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  await page.keyboard.press('?');
  const guide = page.getByRole('dialog', { name: 'Controls' });
  await guide.getByRole('tab', { name: 'Lessons' }).click();
  await guide.getByTestId('lesson-share').click();
  const card = page.getByTestId('tutorial-card');
  await expect(card).toBeVisible();
  // No examples to list.
  await expect(card.getByRole('list', { name: 'For example' })).toHaveCount(0);
  const at = (n: number) => expect(card).toHaveAttribute('data-step', String(n));
  await at(1);

  // The clipboard is not granted: a failure toast may show, the step still completes.
  await page.getByRole('button', { name: 'Share, copy or export' }).click();
  await page.getByRole('menuitem', { name: 'Share link' }).click();
  await at(2);

  await page.keyboard.press('Control+c');
  await at(3);

  await page.getByRole('button', { name: 'Share, copy or export' }).click();
  await page.getByRole('menuitem', { name: 'Export LaTeX' }).click();
  await at(4);

  await card.getByRole('button', { name: 'Finish' }).click();
  const popup = page.getByRole('dialog', { name: 'Lesson complete' });
  await popup.getByRole('button', { name: 'Back to building' }).click();
  await page.keyboard.press('?');
  await guide.getByRole('tab', { name: 'Lessons' }).click();
  await expect(guide.getByTestId('lesson-share')).toContainText('✓');
});
