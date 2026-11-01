import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { FIXTURES, item, openApp } from './helpers.ts';

/** A decoded picture: its size and a hash of its pixels (PNG bytes differ once re-encoded). */
interface Picture {
  width: number;
  height: number;
  hash: number;
}

async function decode(page: Page, source: { base64: string } | 'clipboard'): Promise<Picture> {
  return page.evaluate(async (src) => {
    const blob =
      src === 'clipboard'
        ? await (await navigator.clipboard.read())[0]!.getType('image/png')
        : await (await fetch(`data:image/png;base64,${src.base64}`)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let hash = 2166136261;
    for (const byte of data) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
    return { width: bitmap.width, height: bitmap.height, hash };
  }, source);
}

async function exportMenu(page: Page, entry: string): Promise<void> {
  await page.getByRole('button', { name: 'Export image' }).click();
  await page.getByRole('menuitem', { name: entry }).click();
}

async function downloadedPng(page: Page): Promise<Picture> {
  const download = page.waitForEvent('download');
  await exportMenu(page, 'Export PNG');
  const path = await (await download).path();
  return decode(page, { base64: readFileSync(path).toString('base64') });
}

async function copiedPng(page: Page, how: 'menu' | 'keys'): Promise<Picture> {
  // Clear first, so a copy that fails can't pass on the previous one.
  await page.evaluate(() => navigator.clipboard.writeText(''));
  if (how === 'menu') await exportMenu(page, 'Copy image');
  else await page.keyboard.press('ControlOrMeta+c');
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await navigator.clipboard.read()).some((i) => i.types.includes('image/png')),
      ),
    )
    .toBe(true);
  return decode(page, 'clipboard');
}

async function openNfa(page: Page): Promise<void> {
  await openApp(page, { clear: true });
  await page.getByLabel('Import file').setInputFiles(FIXTURES);
  await item(page, 'Ends in ab (NFA)').click();
  await expect(page.getByTestId('state-q_3')).toBeVisible();
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('the copied picture is the downloaded PNG, at any zoom or display scaling', async ({
  page,
  browser,
}) => {
  await openNfa(page);
  const fitted = await downloadedPng(page);
  expect(fitted.width).toBeGreaterThan(0);
  expect(await copiedPng(page, 'menu')).toEqual(fitted);

  // Zoom far in around one state and pan: most of the automaton is off screen now.
  const box = (await page.getByTestId('diagram').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -200);
  const grab = { x: box.x + box.width - 60, y: box.y + box.height - 160 };
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x - 150, grab.y - 100, { steps: 5 });
  await page.mouse.up();

  expect(await downloadedPng(page)).toEqual(fitted);
  expect(await copiedPng(page, 'keys')).toEqual(fitted);

  // Browser zoom / display scaling.
  const context = await browser.newContext({
    deviceScaleFactor: 1.5,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const scaled = await context.newPage();
  await openNfa(scaled);
  expect(await downloadedPng(scaled)).toEqual(fitted);
  expect(await copiedPng(scaled, 'keys')).toEqual(fitted);
  await context.close();
});

test('exported pictures carry Geist, cut down to the characters drawn', async ({ page }) => {
  await openNfa(page);
  const download = page.waitForEvent('download');
  await exportMenu(page, 'Export SVG');
  const svg = readFileSync(await (await download).path(), 'utf8');
  const face = /@font-face \{ font-family: 'Geist';[^}]*base64,([^)]+)\) format\('woff2'\); \}/.exec(
    svg,
  );
  expect(face).not.toBeNull();
  // A subset, not the whole font.
  expect(face![1]!.length).toBeLessThan(20_000);

  // Drawn as an image (as for the PNG), the embedded font is used: without it, other pixels.
  const draw = (text: string): Promise<string> =>
    page.evaluate(async (t) => {
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(t)}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      return canvas.toDataURL();
    }, text);
  const withFont = await draw(svg);
  expect(withFont).toBe(await draw(svg)); // drawing is deterministic
  expect(await draw(svg.replace(face![0], ''))).not.toBe(withFont);
});
