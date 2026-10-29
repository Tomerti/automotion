# Brand

The logo is a start arrow into an accepting state with an orange self-loop: the smallest automaton
that still loops. It is drawn on a 64 × 64 grid.

- `mark.svg` / `mark-dark.svg`: the mark on its tile, for light and dark backgrounds.
- `lockup.svg`: the mark and the wordmark ("Automaton" in ink, "Vis" in the run's deep orange), set
  in Geist. The text is live `<text>`, so it renders in Geist only where Geist is loaded.
- `public/favicon.svg` is `mark.svg` with a `prefers-color-scheme: dark` switch to the dark colors.
- The top bar draws the same mark without its tile (`src/ui/shell/TopBar.tsx`), colored by theme
  tokens.
