/// <reference lib="dom" />
// (The evaluate callbacks run in the page.)
import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';

// Windows' 150% display scaling, where a transform animation on SVG text (the taken edge label's
// pop) made Chrome redraw the whole diagram soft and shifted until it ended: the state labels
// stuttered on every step.
test.use({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1.5 });

test('the welcome demo keeps its state labels steady while it runs', async ({ page }) => {
  await page.goto('./'); // a first visit: the welcome opens
  const demo = page.getByTestId('welcome-demo');
  await expect(demo).toBeVisible();
  // The states' colour fades would change the label pixels too: take them out of the picture.
  // So would the token, whose glow passes the corner of q0's label on its way round the loop.
  await page.addStyleTag({
    content: `.av-welcome-demo .av-state-body, .av-welcome-demo .av-state-label,
      .av-welcome-demo .av-state-ring { transition: none !important; }
      .av-welcome-demo .av-run-token { visibility: hidden !important; }`,
  });
  await page.waitForTimeout(400); // past the dialog's pop-in

  const states = demo.locator('.av-state');
  // Each label's box, kept inside the accepting ring (whose colour changes with the run): the
  // label's em box is taller than its letters and reaches the ring's corners.
  const boxes = await demo.locator('.av-state').evaluateAll((gs) =>
    gs.map((g) => {
      const r = g.querySelector('.av-state-label')!.getBoundingClientRect();
      const c = g.querySelector('.av-state-body')!.getBoundingClientRect();
      const cx = c.x + c.width / 2;
      const cy = c.y + c.height / 2;
      const half = (c.width / 2) * 0.5;
      const x = Math.max(r.x - 1, cx - half);
      const y = Math.max(r.y - 1, cy - half);
      const right = Math.min(r.right + 1, cx + half);
      const bottom = Math.min(r.bottom + 1, cy + half);
      return { x, y, width: right - x, height: bottom - y };
    }),
  );
  const lit = (): Promise<(string | null)[]> =>
    states.evaluateAll((gs) => gs.map((g) => g.getAttribute('data-active')));

  // Every distinct picture of each label, lit and unlit, over a few steps.
  const pictures = boxes.map(() => new Map<string, Set<string>>());
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    for (const [i, clip] of boxes.entries()) {
      const before = (await lit())[i] ?? '';
      const png = await page.screenshot({ clip });
      if ((await lit())[i] !== before) continue; // it lit up or went out mid-shot
      const seen = pictures[i]!.get(before) ?? new Set<string>();
      seen.add(createHash('md5').update(png).digest('hex'));
      pictures[i]!.set(before, seen);
    }
  }
  const counts = pictures.map((m) => Object.fromEntries([...m].map(([k, v]) => [k, v.size])));
  for (const c of counts) {
    for (const n of Object.values(c)) expect(n, JSON.stringify(counts)).toBe(1);
  }
});
