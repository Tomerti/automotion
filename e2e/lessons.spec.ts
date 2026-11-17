import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { openApp, stateCenter } from './helpers.ts';

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
  // The Done card fits its text, run open or not: no empty space under Finish.
  await expect(card.getByRole('button', { name: 'Finish' })).toBeVisible();
  const done = (await card.boundingBox())!;
  const finishButton = (await card.getByRole('button', { name: 'Finish' }).boundingBox())!;
  expect(done.y + done.height - (finishButton.y + finishButton.height)).toBeLessThan(24);

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

test('the Convert lesson opens paused on {q_0}, steps to the accepting pair by hand, saves the DFA and finishes', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  const { guide, card } = await startLesson(page, 'lesson-convert');
  // Only Basics has a goal picture.
  await expect(card.getByTestId('tutorial-goal-picture')).toHaveCount(0);
  await card.getByTestId('tutorial-next').click();

  const convert = page.getByRole('button', { name: 'Convert to DFA' });
  await convert.click();
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
  // The toolbar button let go of the focus, so → doesn't light up its focus ring.
  await expect(convert).not.toBeFocused();
  const atPair = await top();
  expect(atPair).toBeCloseTo(atStart, 0);

  // Stepped by hand to the next stop, then on to the end.
  await expect(card).toContainText('Press → to go on.');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('Step 5 / 10');
  await expect(card).toContainText('accepts too');
  await expect(card).toContainText('Press → until the last step.');
  expect(await top()).toBeCloseTo(atPair, 0);
  await expect(card).not.toContainText('Play');

  // Space plays too (Convert to DFA no longer has the focus to be pressed again).
  await page.keyboard.press(' ');
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

test('the Minimize lesson opens paused, steps to the split and the merge, saves the DFA and finishes', async ({
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

  // Each moment is one step on: stepped by hand with →.
  await expect(card).toContainText('Press → to see which group splits.');
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('Step 2 / 3');
  await expect(card).toContainText('so they split');
  await expect(card).toContainText('Press → to see what merges.');

  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('Step 3 / 3');
  // The card fits its text: no empty space under it while the walkthrough is open.
  await expect(card).toContainText('so they merge');
  expect((await card.boundingBox())!.height).toBeLessThan(170);

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

test('the Arrange lesson walks Tidy and every arranging gesture, and finishes', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  const { guide, card } = await startLesson(page, 'lesson-arrange');
  const at = (n: number) => expect(card).toHaveAttribute('data-step', String(n));
  await at(1);

  /** Presses at `from`, drags to `to` in `steps` moves, and releases. */
  const drag = async (
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps: number,
  ) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps });
    await page.mouse.up();
  };

  /** Waits until the states' CSS transitions end (the fit itself is not animated). */
  const settle = () =>
    page.waitForFunction(() =>
      document.getAnimations().every((a) => !(a instanceof CSSTransition) || a.playState !== 'running'),
    );

  // Read every position after the step before it: Tidy refits the view.
  await page.getByRole('button', { name: 'Tidy' }).click();
  await at(2);
  // The states may still be gliding to their new spots: read nothing until they stop.
  await settle();

  const body = (await page.getByTestId('state-q_0').locator('.av-state-body').boundingBox())!;
  const d = body.width;
  const q0 = await stateCenter(page, 'q_0');
  const q2 = await stateCenter(page, 'q_2');
  await page.keyboard.down('Control');
  await page.mouse.move(q0.x - d, q0.y - d);
  await page.mouse.down();
  await page.mouse.move(q2.x + d, q2.y + d, { steps: 10 });
  await expect(page.getByTestId('select-box')).toBeVisible();
  await page.mouse.up();
  await page.keyboard.up('Control');
  await at(3);

  const q3 = await stateCenter(page, 'q_3');
  await page.keyboard.down('Control');
  await page.mouse.click(q3.x, q3.y);
  await page.keyboard.up('Control');
  await at(4);

  const m0 = await stateCenter(page, 'q_0');
  await drag(m0, { x: m0.x, y: m0.y - 80 } /* up, off the row */, 10);
  await at(5);

  const q1 = await stateCenter(page, 'q_1');
  const q4 = await stateCenter(page, 'q_4');
  await drag(q1, { x: q1.x + 70, y: q4.y + 3 } /* near q_4's row: the snap does the rest */, 12);
  await at(6);

  const a = await stateCenter(page, 'q_3');
  const b = await stateCenter(page, 'q_2');
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const perp = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  // 40 px sideways bends the arrow clearly. P is the apex the label mirrors across.
  const P = { x: mid.x + perp.x * 40, y: mid.y + perp.y * 40 };
  await drag(mid, P, 10);
  await at(7);

  const labelBox = (await page
    .getByTestId('edge-q_3-q_2')
    .getByTestId('edge-label')
    .boundingBox())!;
  const L = { x: labelBox.x + labelBox.width / 2, y: labelBox.y + labelBox.height / 2 };
  await drag(L, { x: 2 * P.x - L.x, y: 2 * P.y - L.y }, 10);
  await at(8);

  const arrow = (await page.getByTestId('start-arrow').boundingBox())!;
  const c0 = await stateCenter(page, 'q_0');
  await drag(
    { x: arrow.x + arrow.width / 2, y: arrow.y + arrow.height / 2 },
    { x: c0.x, y: c0.y + 80 }, // 80 px below q_0: well clear of its circle
    10,
  );
  await at(9);

  await page.keyboard.press('Control+a');
  await at(10);

  const ticked = await finish(page, guide, card, 'lesson-arrange');
  await ticked();
});
