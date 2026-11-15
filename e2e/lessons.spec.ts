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

/** Playing to a pause or to the end takes a few 800 ms steps. */
const PLAYING = { timeout: 15_000 };

test('the NFAs lesson pauses aab where a branch dies, plays on, runs aba and finishes', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  await page.keyboard.press('?');
  const guide = page.getByRole('dialog', { name: 'Controls' });
  await guide.getByRole('tab', { name: 'Lessons' }).click();
  await guide.getByTestId('lesson-nfa').click();
  const card = page.getByTestId('tutorial-card');
  await expect(card).toBeVisible();
  const at = (n: number) => expect(card).toHaveAttribute('data-step', String(n), PLAYING);
  await at(1);

  const word = page.getByLabel('Word');
  await word.fill('aab');
  await word.press('Enter');

  // It plays by itself and pauses where the q_1 branch dies, the card explaining why.
  await at(3);
  const counter = page.getByTestId('step-counter');
  await expect(counter).toHaveText('Step 3 / 8');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(card).toContainText('has no arrow on');

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-accepted', 'true', PLAYING);
  await at(4);

  await page.keyboard.press('Escape');
  await word.fill('aba');
  await word.press('Enter');
  // Nothing to explain on the way: it plays to its verdict.
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-accepted', 'false', PLAYING);
  await at(5);

  await card.getByRole('button', { name: 'Finish' }).click();
  const popup = page.getByRole('dialog', { name: 'Lesson complete' });
  await popup.getByRole('button', { name: 'Back to building' }).click();
  await page.keyboard.press('?');
  await guide.getByRole('tab', { name: 'Lessons' }).click();
  await expect(guide.getByTestId('lesson-nfa')).toContainText('✓');
});

test('the Convert lesson pauses as {q_0,q_1} appears, plays on, saves the DFA and finishes', async ({
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
  const at = (n: number) => expect(card).toHaveAttribute('data-step', String(n), PLAYING);
  await at(1);

  await page.getByRole('button', { name: 'Convert to DFA' }).click();

  // It plays by itself and pauses as {q_0,q_1} appears, the card explaining why.
  await at(3);
  await expect(page.getByTestId('step-counter')).toHaveText('Step 2 / 10');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(card).toContainText('After a 0');

  await page.getByRole('button', { name: 'Play' }).click();
  await at(4);
  await expect(page.getByTestId('step-counter')).toHaveText('Step 10 / 10');

  await page.getByRole('button', { name: 'Save as new automaton' }).click();
  await at(5);

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

  // Opened paused, as everywhere: Play runs it to the split and pauses there.
  const counter = page.getByTestId('step-counter');
  await expect(counter).toHaveText('Step 1 / 3');
  await page.getByRole('button', { name: 'Play' }).click();
  await at(3);
  await expect(counter).toHaveText('Step 2 / 3');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(card).toContainText('stays put');

  await page.getByRole('button', { name: 'Play' }).click();
  await at(4);
  await expect(counter).toHaveText('Step 3 / 3');

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
