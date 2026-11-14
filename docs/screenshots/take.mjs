// Retakes the README screenshots (at 2×) from a production build.
// First: npm run build && npx vite preview --port 4173
// Then:  node docs/screenshots/take.mjs [baseUrl]
// Then:  node docs/brand/og/render.mjs (the link-preview image shows run.png)
//
// run.png is the whole app (the README's hero). The others close the history bar and leave out
// the top bar, so the feature fills the picture; convert.png and minimize.png are narrow, since
// the README shows them side by side.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://localhost:4173/automotion/';
const SCENES = fileURLToPath(new URL('./scenes.json', import.meta.url));
const out = (name) => fileURLToPath(new URL(`./${name}.png`, import.meta.url));

const WIDE = { width: 1280, height: 760 };
const MEDIUM = { width: 1100, height: 720 };
const NARROW = { width: 820, height: 780 };

const browser = await chromium.launch();

/** A fresh browser with the app open; a return visitor unless `firstVisit`. */
async function open({ viewport = WIDE, firstVisit = false } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  if (!firstVisit) {
    await page.addInitScript(() => localStorage.setItem('automotion:seen-help', '1'));
  }
  await page.goto(BASE);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

/** Import the scenes and delete the blank "Untitled" a fresh browser starts with. */
async function importScenes(page) {
  await page.getByLabel('Import file').setInputFiles(SCENES);
  page.once('dialog', (d) => d.accept());
  await entry(page, 'Untitled').click();
  await page.keyboard.press('Delete');
  await entry(page, 'Untitled').waitFor({ state: 'detached' });
  await page
    .locator('.av-toast')
    .first()
    .waitFor({ state: 'detached', timeout: 15_000 })
    .catch(() => {});
}

function entry(page, name) {
  return page
    .getByRole('navigation', { name: 'History' })
    .getByTestId('history-item')
    .filter({ hasText: name });
}

async function openAutomaton(page, name) {
  await entry(page, name).click();
  await page.getByRole('button', { name: 'Fit' }).click();
}

async function hideHistory(page) {
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('navigation', { name: 'History' }).waitFor({ state: 'hidden' });
}

async function center(page, label) {
  const box = await page.getByTestId(`state-${label}`).locator('.av-state-body').boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Screenshot the page, or only what is under the top bar when `noTopBar`. */
async function shot(page, name, { noTopBar = false } = {}) {
  await page.mouse.move(0, 400);
  await page.waitForTimeout(700);
  const view = page.viewportSize();
  const top = noTopBar ? (await page.locator('.av-topbar').boundingBox()).height : 0;
  await page.screenshot({
    path: out(name),
    clip: { x: 0, y: top, width: view.width, height: view.height - top },
  });
  console.log(`wrote ${name}.png`);
}

/** Pause a walkthrough (they play on opening) and step it to `step` (0-based). */
async function stepTo(page, step) {
  await page
    .getByRole('button', { name: 'Pause' })
    .click({ timeout: 3000 })
    .catch(() => {});
  const first = page.getByRole('button', { name: 'First' });
  if (await first.isEnabled()) await first.click();
  for (let i = 0; i < step; i++) await page.getByRole('button', { name: 'Next' }).click();
}

try {
  // Run a word: the NFA accepts aab. The whole app, history bar open.
  {
    const page = await open();
    await importScenes(page);
    await openAutomaton(page, 'Ends in ab (NFA)');
    await page.getByLabel('Word').fill('aab');
    await page.getByLabel('Word').press('Enter');
    await page.getByRole('button', { name: 'Last' }).click();
    await shot(page, 'run');
    await page.context().close();
  }

  // Convert to DFA, partway through the subset construction.
  {
    const page = await open({ viewport: NARROW });
    await importScenes(page);
    await openAutomaton(page, 'Ends in ab (NFA)');
    await hideHistory(page);
    await page.getByRole('button', { name: 'Convert to DFA' }).click();
    await stepTo(page, 5);
    await shot(page, 'convert', { noTopBar: true });
    await page.context().close();
  }

  // Minimize, partway through partition refinement.
  {
    const page = await open({ viewport: NARROW });
    await importScenes(page);
    await openAutomaton(page, 'Ends in abb (DFA)');
    await hideHistory(page);
    await page.getByRole('button', { name: 'Minimize' }).click();
    await page.getByTestId('block-legend').waitFor();
    await stepTo(page, 2);
    await shot(page, 'minimize', { noTopBar: true });
    await page.context().close();
  }

  // The tutorial, partway through part 1.
  {
    const page = await open({ viewport: MEDIUM, firstVisit: true });
    await page.getByRole('dialog', { name: 'Welcome' }).waitFor();
    await page.getByRole('button', { name: 'Start tutorial' }).click();
    await hideHistory(page);
    const card = page.getByTestId('tutorial-card');
    const at = (n) => card.and(page.locator(`[data-step="${n}"]`)).waitFor();
    const svg = await page.getByTestId('diagram').boundingBox();
    const cx = svg.x + svg.width / 2;
    const rename = async (from, to) => {
      const p = await center(page, from);
      await page.mouse.dblclick(p.x, p.y);
      await page.getByTestId('rename-input').fill(to);
      await page.keyboard.press('Enter');
    };
    const edge = async (from, to, symbols) => {
      const a = await center(page, from);
      const b = await center(page, to);
      await page.keyboard.down('Shift');
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 12 });
      await page.mouse.up();
      await page.keyboard.up('Shift');
      await page.getByTestId('symbol-input').fill(symbols);
      await page.keyboard.press('Enter');
    };
    await page.mouse.dblclick(cx - 170, svg.y + 470);
    await at(2);
    await rename('q_0', 'even');
    await at(3);
    const e = await center(page, 'even');
    await page.mouse.click(e.x, e.y);
    await page.keyboard.press('s');
    await page.keyboard.press('a');
    await at(5);
    await page.mouse.dblclick(cx + 170, svg.y + 470);
    await rename('q_0', 'odd');
    await at(6);
    await edge('even', 'odd', '0');
    await at(7);
    await shot(page, 'tutorial', { noTopBar: true });
    await page.context().close();
  }
} finally {
  await browser.close();
}
