import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { openApp } from './helpers.ts';

test('? opens the guide, its Lessons tab lists Basics, and the row starts the tutorial', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  await page.keyboard.press('?');
  const guide = page.getByRole('dialog', { name: 'Controls' });
  // The only way into the lessons is the tab: no header button.
  await expect(guide.getByRole('button', { name: 'Lessons' })).toHaveCount(0);
  await guide.getByRole('tab', { name: 'Lessons' }).click();
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

/** Opens the guide's Lessons tab and starts the lesson with this row id. */
async function startLesson(page: Page, id: string) {
  await page.keyboard.press('?');
  const guide = page.getByRole('dialog', { name: 'Controls' });
  await guide.getByRole('tab', { name: 'Lessons' }).click();
  await guide.getByTestId(id).click();
  const card = page.getByTestId('tutorial-card');
  await expect(card).toBeVisible();
  return { guide, card };
}

/** Finishes the lesson from its card and checks its row got a tick. */
async function finish(page: Page, guide: Locator, card: Locator, id: string) {
  await card.getByRole('button', { name: 'Finish' }).click();
  const popup = page.getByRole('dialog', { name: 'Lesson complete' });
  await popup.getByRole('button', { name: 'Back to building' }).click();
  return async () => {
    await page.keyboard.press('?');
    await guide.getByRole('tab', { name: 'Lessons' }).click();
    await expect(guide.getByTestId(id)).toContainText('✓');
  };
}

test('the card hides on a new canvas and comes back on the lesson’s automaton', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  const { card } = await startLesson(page, 'lesson-nfa');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('navigation', { name: 'History' }).getByText('Ends in 01').click();
  await expect(card).toBeVisible();
});

test('the NFAs lesson steps 001 by hand, each stop explained, and finishes', async ({ page }) => {
  await openApp(page, { clear: true });
  const { guide, card } = await startLesson(page, 'lesson-nfa');

  // The idea comes first and goes on with Next.
  await card.getByTestId('tutorial-next').click();

  const word = page.getByLabel('Word');
  await word.fill('001');
  await word.press('Enter');

  // It opens paused: nothing plays by itself.
  const counter = page.getByTestId('step-counter');
  await expect(counter).toHaveText('Step 1 / 5');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

  // Each stop's explanation shows on the card before the next press.
  await expect(card).toContainText('nothing guessed');
  for (const [n, text] of [
    [2, 'follows both'],
    [3, 'that guess died'],
    [4, 'reached'],
    [5, 'One guess reached an accepting state'],
  ] as const) {
    await page.keyboard.press('ArrowRight');
    await expect(counter).toHaveText(`Step ${n} / 5`);
    await expect(card).toContainText(text);
  }
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-accepted', 'true');

  const check = await finish(page, guide, card, 'lesson-nfa');
  await check();
});

test('the NFAs card follows the run back with ←, from the closing card too', async ({ page }) => {
  await openApp(page, { clear: true });
  const { card } = await startLesson(page, 'lesson-nfa');
  await card.getByTestId('tutorial-next').click();
  const word = page.getByLabel('Word');
  await word.fill('001');
  await word.press('Enter');

  const counter = page.getByTestId('step-counter');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('Step 5 / 5');
  await expect(card.getByRole('button', { name: 'Finish' })).toBeVisible();

  // Back three steps: the card explains where the run is, not where it was.
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
  await expect(counter).toHaveText('Step 2 / 5');
  await expect(card).toContainText('follows both');
  await expect(card).not.toContainText('reached');
  await expect(card.getByRole('button', { name: 'Finish' })).toHaveCount(0);

  // Forward again: it moves on with the run, back to the closing card.
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(card.getByRole('button', { name: 'Finish' })).toBeVisible();
});

test('the ε-moves lesson steps b by hand, then plays ba and finishes', async ({ page }) => {
  await openApp(page, { clear: true });
  const { guide, card } = await startLesson(page, 'lesson-epsilon');
  await card.getByTestId('tutorial-next').click();

  const word = page.getByLabel('Word');
  await word.fill('b');
  await word.press('Enter');
  const counter = page.getByTestId('step-counter');
  await expect(counter).toHaveText('Step 1 / 4');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

  for (const n of [2, 3, 4]) {
    await page.keyboard.press('ArrowRight');
    await expect(counter).toHaveText(`Step ${n} / 4`);
  }
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-accepted', 'true');

  await page.keyboard.press('Escape');
  await word.fill('ba');
  await word.press('Enter');
  // Not a paused word: it plays to its verdict.
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-accepted', 'false', PLAYING);

  const check = await finish(page, guide, card, 'lesson-epsilon');
  await check();
});

test('the Convert lesson opens paused on {q_0}, stops at the accepting pair, saves the DFA and finishes', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  const { guide, card } = await startLesson(page, 'lesson-convert');
  // Only Basics has a goal picture.
  await expect(card.getByTestId('tutorial-goal-picture')).toHaveCount(0);
  await card.getByTestId('tutorial-next').click();

  await page.getByRole('button', { name: 'Convert to DFA' }).click();
  const counter = page.getByTestId('step-counter');
  // It opens paused on {q_0}, and waits there for →.
  await expect(counter).toHaveText('Step 1 / 10');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(card).toContainText('The DFA starts in');
  await expect(card).toContainText('to follow 0 from');
  await page.waitForTimeout(1200);
  await expect(counter).toHaveText('Step 1 / 10');

  // The diagram stays put as the card's text changes from stop to stop.
  const nfaState = page.locator('[data-state-id="q_0"] .av-state-body').first();
  const top = async () => (await nfaState.boundingBox())!.y;
  const atStart = await top();
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('Step 2 / 10');
  await expect(card).toContainText('Below, it follows 0');
  const atPair = await top();
  expect(atPair).toBeCloseTo(atStart, 0);

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(counter).toHaveText('Step 5 / 10', PLAYING);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(card).toContainText('accepts too');
  expect(await top()).toBeCloseTo(atPair, 0);

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(counter).toHaveText('Step 10 / 10', PLAYING);

  await page.getByRole('button', { name: 'Save as new automaton' }).click();
  await expect(card.getByRole('button', { name: 'Finish' })).toBeVisible();

  const check = await finish(page, guide, card, 'lesson-convert');
  await expect(page.getByRole('navigation', { name: 'History' })).toContainText(
    'Contains 01 → DFA',
  );
  await check();
});

test('the Convert lesson stops the same way when Convert is pressed before Next', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  const { card } = await startLesson(page, 'lesson-convert');

  await page.getByRole('button', { name: 'Convert to DFA' }).click();
  await expect(page.getByTestId('step-counter')).toHaveText('Step 1 / 10');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

  await card.getByTestId('tutorial-next').click();
  await expect(card).toContainText('The DFA starts in');
  await page.keyboard.press('ArrowRight');
  await expect(card).toContainText('Below, it follows 0');
});

test('the Minimize lesson opens paused, splits, merges, saves the DFA and finishes', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  const { guide, card } = await startLesson(page, 'lesson-minimize');
  await expect(card.getByTestId('tutorial-goal-picture')).toHaveCount(0);
  await card.getByTestId('tutorial-next').click();

  await page.getByRole('button', { name: 'Minimize' }).click();
  const counter = page.getByTestId('step-counter');
  await expect(counter).toHaveText('Step 1 / 3');
  await expect(card).toContainText('two groups');

  // Stepped by hand, as the card says.
  await expect(card).toContainText('Press → to try the letters');
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('Step 2 / 3');
  await expect(card).toContainText('so they split');
  await expect(card).toContainText('Press → to finish');

  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('Step 3 / 3');

  await page.getByRole('button', { name: 'Save as new automaton' }).click();
  await expect(card.getByRole('button', { name: 'Finish' })).toBeVisible();

  const check = await finish(page, guide, card, 'lesson-minimize');
  await check();
});

test('the Share lesson shares a link, copies the picture, copies LaTeX and finishes', async ({
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

  // The menu is found: no frame on it from here on.
  await expect(page.getByTestId('tutorial-pointer')).toHaveCount(0);

  await page.keyboard.press('Control+c');
  await at(3);
  await expect(card).toContainText('you get a picture of the automaton');

  await page.getByRole('button', { name: 'Share, copy or export' }).click();
  await page.getByRole('menuitem', { name: 'Copy LaTeX' }).click();
  await at(4);

  await card.getByRole('button', { name: 'Finish' }).click();
  const popup = page.getByRole('dialog', { name: 'Lesson complete' });
  await popup.getByRole('button', { name: 'Back to building' }).click();
  await page.keyboard.press('?');
  await guide.getByRole('tab', { name: 'Lessons' }).click();
  await expect(guide.getByTestId('lesson-share')).toContainText('✓');
});
