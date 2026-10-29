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
  await expect(card).toContainText('Tutorial · 1 of 12');

  // Part 1: an even number of 0s.
  await addStateAt(page, 150, 220);
  await at(2);
  await expect(page.getByTestId('tutorial-pointer')).toBeVisible();
  await clickState(page, 'q_0');
  await page.keyboard.press('s');
  await at(3);
  await page.keyboard.press('a');
  await at(4);
  await addStateAt(page, 450, 220);
  await at(5);
  await edge(page, 'q_0', 'q_1', '0');
  await at(6);
  await edge(page, 'q_1', 'q_0', '0');
  await at(7);
  await selfLoop(page, 'q_0', '1');
  await selfLoop(page, 'q_1', '1');
  await at(8);
  await run(page, '1010', true);
  await at(9);
  await page.keyboard.press('Escape');
  await run(page, '10', false);
  await at(10);

  // Part 2: accept every word.
  await page.keyboard.press('Escape');
  await clickState(page, 'q_1');
  await page.keyboard.press('Delete');
  await at(11);
  await expect(page.getByTestId('state-q_1')).toHaveCount(0);
  await page.getByTestId('edge-q_0-q_0').getByTestId('edge-label').dblclick();
  await page.getByTestId('symbol-input').fill('0,1');
  await page.keyboard.press('Enter');
  await at(12);
  await run(page, '10', true);
  await at(13);
  await expect(card).toContainText('Tutorial · Done');
  await card.getByRole('button', { name: 'Finish' }).click();
  await expect(card).toHaveCount(0);

  // The automaton stays: one state looping on 0 and 1.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('edge-q_0-q_0').getByTestId('edge-label')).toHaveText('0,1');
  await expect(page.getByRole('navigation', { name: 'History' })).toContainText('Tutorial');
});
