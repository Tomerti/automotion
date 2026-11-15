import { expect, test, type Page } from '@playwright/test';
import { addStateAt, openApp, stateCenter } from './helpers.ts';

test.use({ deviceScaleFactor: 4 });

/**
 * The top and bottom of the dark (text) ink in a box centred on a point, in CSS px from that
 * point. The box is kept inside the state's circle.
 */
async function inkRows(page: Page, cx: number, cy: number, halfH: number, halfW: number) {
  const png = await page.screenshot({
    clip: { x: cx - halfW, y: cy - halfH, width: 2 * halfW, height: 2 * halfH },
  });
  return page.evaluate(
    async ({ b64, halfH }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, img.width, img.height).data;
      const rows: number[] = [];
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const i = (y * img.width + x) * 4;
          if (d[i]! + d[i + 1]! + d[i + 2]! < 300) {
            rows.push(y);
            break;
          }
        }
      }
      const scale = img.height / (2 * halfH);
      return { top: rows[0]! / scale - halfH, bottom: rows[rows.length - 1]! / scale - halfH };
    },
    { b64: png.toString('base64'), halfH },
  );
}

// `even` has no tall letter, so the drawn label sets it lower than a centred line box would.
for (const name of ['even', 'Any']) {
  test(`renaming «${name}» keeps its text where the drawn label is`, async ({ page }) => {
    await openApp(page, { clear: true });
    await addStateAt(page, 250, 200);
    const c0 = await stateCenter(page, 'q_0');
    await page.mouse.dblclick(c0.x, c0.y);
    await page.getByTestId('rename-input').fill(name);
    await page.keyboard.press('Enter');
    // Deselect, so the state looks the same as while it is renamed.
    await page.mouse.click(c0.x + 200, c0.y + 150);

    const c = await stateCenter(page, name);
    const box = await page.getByTestId(`state-${name}`).locator('.av-state-body').boundingBox();
    const r = box!.height / 2;
    const drawn = await inkRows(page, c.x, c.y, r * 0.5, r * 0.6);
    await page.mouse.dblclick(c.x, c.y);
    await expect(page.getByTestId('rename-input')).toBeFocused();
    const editing = await inkRows(page, c.x, c.y, r * 0.5, r * 0.6);
    expect(Math.abs(editing.top - drawn.top)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(editing.bottom - drawn.bottom)).toBeLessThanOrEqual(0.5);
  });
}
