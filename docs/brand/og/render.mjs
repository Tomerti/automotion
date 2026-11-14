// Renders og.html to public/og.png (the 1200x630 link-preview image). Run: node docs/brand/og/render.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const pageUrl = new URL('./og.html', import.meta.url).href;
const out = fileURLToPath(new URL('../../../public/og.png', import.meta.url));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto(pageUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
} finally {
  await browser.close();
}
