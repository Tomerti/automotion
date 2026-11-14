import { expect, test } from '@playwright/test';
import { clickState, FIXTURES, item, openApp } from './helpers.ts';

test('two start states on an NFA: a run from the second, then the q_s step of Convert to DFA', async ({
  page,
}) => {
  await openApp(page, { clear: true });
  // The fixture file is version 1, so this also runs the migration.
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  await item(page, 'Ends in ab (NFA)').click();
  await expect(page.getByTestId('start-arrow')).toHaveCount(1);

  // q_2 --b--> q_3 (accepting): "b" is accepted only from q_2.
  await clickState(page, 'q_2');
  await page.keyboard.press('s');
  await expect(page.getByTestId('start-arrow')).toHaveCount(2);

  await page.getByLabel('Word').fill('b');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-accepted', 'true');
  await page.getByTestId('trace-player').getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Convert to DFA' }).click();
  // The conversion plays at once: stop it and go back to its first step.
  await page.getByRole('button', { name: 'Pause' }).click();
  // Paused wherever playback got to (maybe step 1, where First is disabled): jump to the end,
  // where First is always enabled, then back.
  const last = page.getByRole('button', { name: 'Last' });
  await expect(last).toBeEnabled();
  await last.click();
  const first = page.getByRole('button', { name: 'First' });
  await expect(first).toBeEnabled();
  await first.click();
  await expect(page.getByTestId('step-counter')).toHaveText(/^Step 1 \//);
  await expect(page.getByTestId('trace-player')).toContainText(
    'Several start states: add a new start state',
  );
});
