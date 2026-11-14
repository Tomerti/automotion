# Brand

The logo is a start arrow into an accepting state with an orange self-loop: the smallest automaton
that still loops. It is drawn on a 64 × 64 grid.

- `mark.svg` / `mark-dark.svg`: the mark on its tile, for light and dark backgrounds. The oranges
  are the same in both, like the app's run colors: the loop is `#f76707`, "Motion" is `#d9480f`.
- `lockup.svg` / `lockup-dark.svg`: the mark and the wordmark ("Auto" in ink, "Motion" in the
  run's orange), set in Geist. The text is live `<text>`, so it renders in Geist only where Geist is
  loaded.
- `lockup.png` / `lockup-dark.png`: the lockups rendered at 3× with Geist, on a transparent
  background. The repo README uses these, since GitHub shows SVGs without web fonts. Regenerate
  them with `node docs/brand/render.mjs` (needs Playwright Chromium and network for Geist).
- `public/favicon.svg` is `mark.svg` with a `prefers-color-scheme: dark` switch to the dark colors.
- The top bar draws the same mark without its tile (`src/ui/shell/TopBar.tsx`), colored by theme
  tokens.
- `public/og.png`: the 1200 × 630 link-preview image (`og:image`). Its source is `og/og.html` (the lockup and `docs/screenshots/run.png`); regenerate it with `node docs/brand/og/render.mjs` (needs Playwright Chromium and network for the Geist font).
