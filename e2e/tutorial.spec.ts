import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addStateAt, clickState, shiftDrag, stateCenter } from './helpers.ts';

/** Shift + drag from a state out and back onto itself, then type the loop's symbols. */
async function selfLoop(page: Page, label: string, symbols: string): Promise<void> {
  const c = await stateCenter(page, label);
  await page.keyboard.down('Shift');
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 60, c.y - 60, { steps: 6 });
  await page.mouse.move(c.x, c.y, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.getByTestId('symbol-input').fill(symbols);
  await page.keyboard.press('Enter');
}

async function edge(page: Page, from: string, to: string, symbols: string): Promise<void> {
  await shiftDrag(page, from, to);
  await page.getByTestId('symbol-input').fill(symbols);
  await page.keyboard.press('Enter');
}

/** Double-click a state and give it a name. */
async function rename(page: Page, label: string, name: string): Promise<void> {
  const c = await stateCenter(page, label);
  await page.mouse.dblclick(c.x, c.y);
  await page.getByTestId('rename-input').fill(name);
  await page.keyboard.press('Enter');
}

/** The history entry named exactly `name`, not just one whose name contains it. */
const entry = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: 'History' })
    .locator('.av-history-name')
    .filter({ hasText: new RegExp(`^${name}$`) });

/** Run a word and jump to its verdict. */
async function run(page: Page, word: string, accepted: boolean): Promise<void> {
  await page.getByLabel('Word').fill(word);
  await page.getByLabel('Word').press('Enter');
  await page.getByRole('button', { name: 'Last' }).click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-accepted', String(accepted));
}

test('the first visit offers the tutorial, which walks through building and changing a DFA', async ({
  page,
}) => {
  // A fresh browser context: a first visit.
  await page.goto('./');
  const welcome = page.getByRole('dialog', { name: 'Welcome' });
  await expect(welcome).toBeVisible();
  await welcome.getByRole('button', { name: 'Start tutorial' }).click();

  const card = page.getByTestId('tutorial-card');
  const at = (n: number) => expect(card).toHaveAttribute('data-step', String(n));
  await at(1);
  await expect(card).toContainText('Part 1 of 2 · Step 1 of 11');
  // What part 1 builds is on show from the start: a picture, the goal and example words.
  const goal = card.getByTestId('tutorial-goal');
  await expect(goal).toContainText('Part 1 goal: Accept the words with an even number of zeros');
  await expect(goal.getByTestId('tutorial-goal-picture')).toBeVisible();
  // The card sits centred under the DFA/NFA switch.
  const pill = (await page.getByTestId('kind-pill').boundingBox())!;
  const box = (await card.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - (pill.x + pill.width / 2))).toBeLessThan(2);
  expect(box.y).toBeGreaterThan(pill.y + pill.height);
  expect(box.y - (pill.y + pill.height)).toBeLessThan(20);

  // Part 1: an even number of 0s. States go below the card.
  await addStateAt(page, 150, 400);
  await at(2);
  await expect(page.getByTestId('tutorial-pointer')).toBeVisible();
  await rename(page, 'q_0', 'even');
  await at(3);
  await clickState(page, 'even');
  await page.keyboard.press('s');
  await at(4);
  // S made it the start state; A, its own step, makes it accepting.
  await page.keyboard.press('a');
  await at(5);
  await addStateAt(page, 450, 400);
  // q_0 is free again, so the new state takes it.
  await rename(page, 'q_0', 'odd');
  await at(6);
  await edge(page, 'even', 'odd', '0');
  await at(7);
  await edge(page, 'odd', 'even', '0');
  await at(8);
  await selfLoop(page, 'even', '1');
  await at(9);
  await selfLoop(page, 'odd', '1');
  await at(10);
  await run(page, '1010', true);
  // The run's tape starts below the card, not under it.
  const tape = (await page.locator('.av-tape').boundingBox())!;
  expect(tape.y).toBeGreaterThanOrEqual(box.y + (await card.boundingBox())!.height);
  await at(11);
  await page.keyboard.press('Escape');
  await run(page, '10', false);
  await at(12);
  // The card says part 1 is done, and what part 2 is, until Esc closes the run.
  await expect(card.getByTestId('tutorial-part-done')).toContainText('Part 1 complete!');
  await expect(card).toContainText('Next: Part 2 · Accept every word');

  // Part 2: accept every word.
  await page.keyboard.press('Escape');
  await expect(goal).toContainText('Part 2 goal: Accept every word');
  await expect(card).toContainText('Part 2 of 2 · Step 1 of 4');
  await clickState(page, 'odd');
  await page.keyboard.press('Delete');
  await at(13);
  await expect(page.getByTestId('state-odd')).toHaveCount(0);
  await page.getByTestId('edge-even-even').getByTestId('edge-label').dblclick();
  await page.getByTestId('symbol-input').fill('0,1');
  await page.keyboard.press('Enter');
  await at(14);
  await rename(page, 'even', 'any');
  await at(15);
  await run(page, '10', true);
  await at(16);
  await expect(card).toContainText('Tutorial · Done');
  await card.getByRole('button', { name: 'Finish' }).click();
  await expect(card).toHaveCount(0);
  const popup = page.getByRole('dialog', { name: 'Tutorial complete' });
  await expect(popup).toBeVisible();
  // No lesson is started for you: Start building, or See the lessons.
  await expect(popup.getByRole('button', { name: 'See the lessons' })).toBeVisible();
  await popup.getByRole('button', { name: 'Start building' }).click();
  await expect(popup).toHaveCount(0);

  // Finish also closes the last run, back to editing, and removes the practice automaton: a
  // blank Untitled is left to start building on.
  await expect(page.getByTestId('verdict')).toHaveCount(0);
  await expect(page.getByLabel('Word')).toBeVisible();
  await expect(entry(page, 'Tutorial')).toHaveCount(0);
  await expect(entry(page, 'Untitled')).toHaveCount(1);
  await expect(page.getByTestId('canvas').locator('.av-state-body')).toHaveCount(0);
});

test('quitting the tutorial midway asks first, then removes it from the history', async ({
  page,
}) => {
  await page.goto('./');
  const welcome = page.getByRole('dialog', { name: 'Welcome' });
  await welcome.getByRole('button', { name: 'Start tutorial' }).click();
  const card = page.getByTestId('tutorial-card');
  const history = page.getByRole('navigation', { name: 'History' });
  await addStateAt(page, 150, 400);
  await expect(card).toHaveAttribute('data-step', '2');
  await expect(entry(page, 'Tutorial')).toHaveCount(1);

  await card.getByRole('button', { name: 'End tutorial' }).click();
  await card.getByRole('button', { name: 'Keep going' }).click();
  await expect(card).toHaveAttribute('data-step', '2');

  await card.getByRole('button', { name: 'End tutorial' }).click();
  await card.getByRole('button', { name: 'Quit' }).click();
  await expect(card).toHaveCount(0);
  await expect(history).not.toContainText('Tutorial');
});
