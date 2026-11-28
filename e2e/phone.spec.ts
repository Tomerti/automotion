import { deflateRawSync } from 'node:zlib';
import { devices, expect, test } from '@playwright/test';

// Chromium emulating an iPhone 13 (viewport, touch, UA). defaultBrowserType can't be set per file.
const { defaultBrowserType: _browser, ...iPhone } = devices['iPhone 13'];
test.use(iPhone);

/** A share link's payload, made like `persistence/shareLink.ts` does: deflate-raw, base64url. */
function sharePayload(): string {
  const dfa = {
    name: 'Ends in a (DFA)',
    kind: 'DFA',
    alphabet: ['a', 'b'],
    states: [
      { id: 'q0', label: 'q_0', x: 100, y: 150 },
      { id: 'q1', label: 'q_1', x: 280, y: 150 },
    ],
    starts: ['q0'],
    accepting: ['q1'],
    transitions: [
      { id: 'q0->q1', from: 'q0', to: 'q1', symbols: ['a'] },
      { id: 'q0->q0', from: 'q0', to: 'q0', symbols: ['b'] },
      { id: 'q1->q1', from: 'q1', to: 'q1', symbols: ['a'] },
      { id: 'q1->q0', from: 'q1', to: 'q0', symbols: ['b'] },
    ],
  };
  const json = JSON.stringify({ format: 'automotion', version: 2, automata: [dfa] });
  return deflateRawSync(Buffer.from(json)).toString('base64url');
}

test('the phone welcome says what a phone can do, then a shared link opens and runs', async ({
  page,
}) => {
  await page.goto('./');
  const welcome = page.getByRole('dialog', { name: 'Welcome' });
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText('Drawing automata takes a mouse and keyboard');
  await expect(welcome.getByRole('listitem')).toHaveText([
    'Build one from a regex',
    'Open shared automata',
    'Run words on them',
    'Draw or edit by hand',
  ]);
  await expect(welcome.getByRole('button', { name: 'Start tutorial' })).toHaveCount(0);
  await expect(welcome.getByTestId('welcome-demo')).toBeVisible();
  // The notice is a callout above the demo, on screen without scrolling.
  const note = welcome.getByRole('note');
  await expect(note).toContainText('Best on a computer');
  const noteBox = (await note.boundingBox())!;
  const demoBox = (await welcome.getByTestId('welcome-demo').boundingBox())!;
  expect(noteBox.y + noteBox.height).toBeLessThanOrEqual(demoBox.y);
  const box = await welcome.boundingBox();
  const size = page.viewportSize()!;
  expect(noteBox.y + noteBox.height).toBeLessThanOrEqual(size.height);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
  await page.screenshot({ path: 'test-results/phone-welcome.png' });
  await welcome.getByRole('button', { name: 'Got it' }).tap();
  await expect(welcome).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('automotion:seen-help'))).not.toBeNull();

  await page.goto(`./#a=${sharePayload()}`);
  await expect(page.getByText('Opened “Ends in a (DFA)”')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Welcome' })).toHaveCount(0);
  for (const id of ['state-q_0', 'state-q_1']) {
    const b = await page.getByTestId(id).locator('.av-state-body').boundingBox();
    expect(b, id).not.toBeNull();
    expect(b!.x).toBeGreaterThanOrEqual(0);
    expect(b!.y).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(size.width);
    expect(b!.y + b!.height).toBeLessThanOrEqual(size.height);
  }
  // The toast sits under the DFA/NFA switch, not over it.
  const toastBox = (await page.getByRole('status').filter({ hasText: 'Opened' }).boundingBox())!;
  const pillBox = (await page.getByTestId('kind-pill').boundingBox())!;
  expect(toastBox.y).toBeGreaterThanOrEqual(pillBox.y + pillBox.height);
  await page.screenshot({ path: 'test-results/phone-opened.png' });

  await page.getByLabel('Word').fill('ba');
  await page.getByLabel('Word').press('Enter');
  await page.getByRole('button', { name: 'Last' }).tap();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-accepted', 'true');
  await page.screenshot({ path: 'test-results/phone-run.png' });
});

test('a phone builds a DFA from a regex on the empty canvas', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('dialog', { name: 'Welcome' }).getByRole('button', { name: 'Got it' }).tap();
  const hint = page.getByTestId('canvas-hint');
  await expect(hint).toContainText('Building by hand needs a computer');
  await expect(hint).not.toContainText('Double-click');
  const link = hint.getByRole('button', { name: 'Create a DFA from a regex' });
  // Tall enough for a finger, while its line stays one 20 px dot gap like the line under it.
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await hint.locator('p').first().boundingBox())!.height).toBe(20);
  await page.screenshot({ path: 'test-results/phone-empty.png' });
  await link.tap();
  const dialog = page.getByRole('dialog', { name: 'Create a DFA from a regex' });
  await expect(dialog).toBeVisible();
  await page.getByTestId('regex-input').fill('(a|b)*ab');
  await page.getByTestId('regex-build').tap();
  await expect(dialog).toHaveCount(0);
  const size = page.viewportSize()!;
  for (const id of ['state-q_0', 'state-q_1', 'state-q_2']) {
    const b = await page.getByTestId(id).locator('.av-state-body').boundingBox();
    expect(b, id).not.toBeNull();
    expect(b!.x).toBeGreaterThanOrEqual(0);
    expect(b!.y).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(size.width);
    expect(b!.y + b!.height).toBeLessThanOrEqual(size.height);
  }
  await page.getByLabel('Word').fill('bab');
  await page.getByLabel('Word').press('Enter');
  await page.getByRole('button', { name: 'Last' }).tap();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-accepted', 'true');
  await page.screenshot({ path: 'test-results/phone-regex.png' });
});
