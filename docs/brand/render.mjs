// Renders lockup.svg and lockup-dark.svg to PNGs at 3× in Geist, on a transparent background
// (GitHub shows SVGs without web fonts). Run: node docs/brand/render.mjs (needs Playwright
// Chromium and network for the Geist font).
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const here = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));
const FONT = 'https://fonts.googleapis.com/css2?family=Geist:wght@500;700&display=block';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 3 });
  for (const name of ['lockup', 'lockup-dark']) {
    const svg = await readFile(here(`${name}.svg`), 'utf8');
    await page.setContent(
      `<!doctype html><link rel="stylesheet" href="${FONT}">` +
        `<style>html,body{margin:0;background:transparent}svg{display:block;width:308px;height:80px}</style>` +
        svg,
      { waitUntil: 'networkidle' },
    );
    await page.evaluate(async () => {
      await document.fonts.load('700 35px Geist');
      await document.fonts.load('500 35px Geist');
      await document.fonts.ready;
    });
    await page.locator('svg').screenshot({ path: here(`${name}.png`), omitBackground: true });
    console.log(`wrote ${name}.png`);
  }
} finally {
  await browser.close();
}
