import { expect, test } from '@playwright/test';
import { addStateAt, item, openApp } from './helpers.ts';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const TIKZ = String.raw`\begin{tikzpicture}[->, auto]
  \node[state, initial] (p) {$p$};
  \node[state, accepting] (r) [right=of p] {$r$};
  \path (p) edge node {$a$} (r) (r) edge [loop above] node {$b$} ();
\end{tikzpicture}`;

test('Ctrl+V with TikZ on the clipboard adds the automaton it draws', async ({ page }) => {
  await openApp(page, { clear: true });
  await page.evaluate((text) => navigator.clipboard.writeText(text), TIKZ);
  await page.keyboard.press('Control+V');
  await expect(page.getByText('Pasted 1 automaton from LaTeX')).toBeVisible();
  await expect(item(page, 'Pasted')).toContainText('DFA · 2 states');
  for (const label of ['p', 'r']) await expect(page.getByTestId(`state-${label}`)).toBeVisible();
});

test('states copied in the app paste until the window loses the focus', async ({ page }) => {
  await openApp(page, { clear: true });
  await addStateAt(page, 0, 0);
  await page.evaluate((text) => navigator.clipboard.writeText(text), TIKZ);
  await page.getByTestId('state-q_0').click();
  await page.keyboard.press('Control+C');
  await page.keyboard.press('Control+V');
  // The app's copy is the newer one: a second state, and no import.
  await expect(page.locator('[data-testid^="state-"]')).toHaveCount(2);
  await expect(page.getByTestId('history-item')).toHaveCount(1);

  // Away from the window (where the TikZ could have been copied), then back: it pastes.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.press('Control+V');
  await expect(page.getByText('Pasted 1 automaton from LaTeX')).toBeVisible();
  await expect(page.getByTestId('history-item')).toHaveCount(2);
});
