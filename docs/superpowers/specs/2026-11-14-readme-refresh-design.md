# README refresh (design)

## Intent

The repo is public (v1.0.0). The README is its front page and strangers will read it, so it must
match the app as it is now and be easy to scan: what AutoMotion is, what it looks like, how to use
it, and (last) how to develop it.

## Goals

- Current logo and screenshots: the dark logo files still used the old dark orange `#ff922b`;
  the app draws the loop `#f76707` (and "Motion" in `#d9480f`) in both themes. The screenshots
  were from 2026-10-29 (blue selection, old sidebar, no tutorial or theme menu).
- A tidy, organized page: short sections, each led by a screenshot and 3–5 crisp bullets.
- Lead with people using the tool (students, TAs); developer material last.

## Non-goals

- No change to the app itself. Exhaustive detail stays in the in-app Controls (**?**).

## Approaches

1. Restructure around a hero image and short feature sections (picked, approved).
2. Keep the current long feature list and only swap images: accurate, but a wall of text.

## Design (approved)

```
[logo lockup] · one-line pitch · Open the app → · badges (CI, MIT, live)
[hero: run.png]
What it is (2–3 sentences)
Features: Learn (tutorial) · Build & arrange (dark edit) · Run a word ·
          Convert & minimize · Save, share & LaTeX
Keyboard cheat sheet (small table)
Development (commands, stack, architecture pointer) · License
```

- Screenshots are reproducible: `docs/screenshots/take.mjs` with `scenes.json` (1280 × 760 at 2×).
- `public/og.png` is re-rendered, since it embeds `run.png`.
- Dark logo files and the favicon's dark mode use the app's oranges; lockup PNGs are re-rendered
  by a committed script.
