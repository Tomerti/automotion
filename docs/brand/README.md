# Brand

The logo is a start arrow into an accepting state with an orange self-loop: the smallest automaton
that still loops. It is drawn on a 64 × 64 grid.

## Colors

The orange is `#f76707`, the app's run highlighter, in both themes: the loop and its arrowhead, and
"Motion" in the wordmark. The ink is `#1c2333` on light backgrounds and `#e6e9ef` on dark ones.

## Files

- `mark.svg` / `mark-dark.svg`: the mark on its tile, for light and dark backgrounds.
- `lockup.svg` / `lockup-dark.svg`: the mark and the wordmark ("Auto" in ink, "Motion" in orange),
  set in Geist. The text is live `<text>`, so it renders in Geist only where Geist is loaded.
- `lockup.png` / `lockup-dark.png`: the lockups rendered at 3× in Geist, on a transparent
  background. The repo README uses these, since GitHub shows SVGs without web fonts.
- `public/favicon.svg`: `mark.svg` with a `prefers-color-scheme: dark` switch to the dark tile and
  ink.
- `public/og.png`: the 1200 × 630 link-preview image (`og:image`), made from `og/og.html` (the
  lockup and `docs/screenshots/run.png`).
- The top bar draws the same mark without its tile (`src/ui/shell/TopBar.tsx`), colored by theme
  tokens.

## Regenerating

All of these need Playwright Chromium (`npx playwright install chromium`) and network for Geist.

1. `node docs/brand/render.mjs`: the lockup PNGs, after changing a lockup SVG.
2. `node docs/screenshots/take.mjs`: the README screenshots, `run.png` included, and
   `node docs/screenshots/take-gif.mjs`: the README's animated hero, `run.gif` (see either script
   for the preview server it needs).
3. `node docs/brand/og/render.mjs`: the link-preview image, after either of the above.
