// Retakes the README screenshots (1280 × 760 at 2×) from a production build.
// First: npm run build && npx vite preview --port 4173
// Then:  node docs/screenshots/take.mjs [baseUrl]
// Then:  node docs/brand/og/render.mjs (the link-preview image shows run.png)
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://localhost:4173/automotion/';
const SCENES = fileURLToPath(new URL('./scenes.json', import.meta.url));
const out = (name) => fileURLToPath(new URL(`./${name}.png`, import.meta.url));

const browser = await chromium.launch();

/** A fresh browser with the app open; a return visitor unless `firstVisit`. */
async function open({ dark = false, firstVisit = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 760 },
    deviceScaleFactor: 2,
    colorScheme: dark ? 'dark' : 'light',
  });
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
  await page.locator('.av-toast').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});
}

function entry(page, name) {
  return page
    .getByRole('navigation', { name: 'History' })
    .getByTestId('history-item')
    .filter({ hasText: name });
}

async function openAutomaton(page, name, { tidy = false } = {}) {
  await entry(page, name).click();
  if (tidy) {
    await page.getByRole('button', { name: 'Tidy' }).click();
    await page.waitForTimeout(800);
  }
  await page.getByRole('button', { name: 'Fit' }).click();
}

async function center(page, label) {
  const box = await page.getByTestId(`state-${label}`).locator('.av-state-body').boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function shot(page, name) {
  await page.mouse.move(0, 400);
  await page.waitForTimeout(700);
  await page.screenshot({ path: out(name) });
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
  // Run a word: the NFA accepts aab.
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
    const page = await open();
    await importScenes(page);
    await openAutomaton(page, 'Ends in ab (NFA)');
    await page.getByRole('button', { name: 'Convert to DFA' }).click();
    await stepTo(page, 5);
    await shot(page, 'convert');
    await page.context().close();
  }

  // Minimize, partway through partition refinement.
  {
    const page = await open();
    await importScenes(page);
    await openAutomaton(page, 'Ends in abb (DFA)', { tidy: true });
    await page.getByRole('button', { name: 'Minimize' }).click();
    await page.getByTestId('block-legend').waitFor();
    await stepTo(page, 2);
    await shot(page, 'minimize');
    await page.context().close();
  }

  // Editing in the dark theme, a state selected.
  {
    const page = await open({ dark: true });
    await importScenes(page);
    await openAutomaton(page, 'Binary multiples of 3', { tidy: true });
    const c = await center(page, 'r_1');
    await page.mouse.click(c.x, c.y);
    await shot(page, 'edit-dark');
    await page.context().close();
  }

  // The tutorial, partway through part 1.
  {
    const page = await open({ firstVisit: true });
    await page.getByRole('dialog', { name: 'Welcome' }).waitFor();
    await page.getByRole('button', { name: 'Start tutorial' }).click();
    const card = page.getByTestId('tutorial-card');
    const at = (n) => card.and(page.locator(`[data-step="${n}"]`)).waitFor();
    const svg = await page.getByTestId('diagram').boundingBox();
    const bar = await page.getByRole('navigation', { name: 'History' }).boundingBox();
    const left = Math.max(svg.x, bar ? bar.x + bar.width : 0);
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
    await page.mouse.dblclick(left + 300, svg.y + 450);
    await at(2);
    await rename('q_0', 'even');
    await at(3);
    const e = await center(page, 'even');
    await page.mouse.click(e.x, e.y);
    await page.keyboard.press('s');
    await page.keyboard.press('a');
    await at(5);
    await page.mouse.dblclick(left + 600, svg.y + 450);
    await rename('q_0', 'odd');
    await at(6);
    await edge('even', 'odd', '0');
    await at(7);
    await shot(page, 'tutorial');
    await page.context().close();
  }
} finally {
  await browser.close();
}
