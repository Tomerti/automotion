# README refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A README that matches AutoMotion v1 (current logo colors, fresh screenshots) and is easy to scan.

**Architecture:** Docs and image assets only; no app code changes. Images are produced by committed
Playwright scripts so they can be regenerated.

**Tech Stack:** Markdown (GitHub-flavored), SVG, Playwright (`@playwright/test` chromium), Node ESM scripts.

**Spec:** `docs/superpowers/specs/2026-11-14-readme-refresh-design.md`

## Global Constraints

- Logo oranges in both themes: loop and its head `#f76707`, "Motion" wordmark `#d9480f`. No `#ff922b` left in `docs/brand` or `public`.
- Lockup PNGs: 3× (924 × 240), transparent background, set in Geist.
- Screenshots: 1280 × 760 at 2× from a production build (`vite preview`, port 4173).
- Format only touched files with Prettier (never `npm run format` on this checkout).
- Keep the README's image paths relative (`docs/...`), so they render on GitHub.

## Review Focus

- GitHub dark mode: the README must show `lockup-dark.png` through `<picture>`, readable on `#0d1117`.
- Broken image links: every `docs/...` path in the README exists in the commit.
- Phone-width GitHub view: no wide tables beyond 3 columns; images scale.
- Facts in the README match the app (Controls popup keys, `\eps`, Ctrl+V LaTeX paste, share links, phone support).
- `public/og.png` still 1200 × 630 after re-render.

---

### Task 1: Logo colors and lockup renderer

**Files:**
- Modify: `docs/brand/mark-dark.svg`, `docs/brand/lockup-dark.svg`, `public/favicon.svg` (dark media block)
- Create: `docs/brand/render.mjs` (renders `lockup.svg` / `lockup-dark.svg` to the PNGs at 3× with Geist from Google Fonts, `omitBackground`)
- Modify: `docs/brand/lockup.png`, `docs/brand/lockup-dark.png`, `docs/brand/README.md` (dark colors, how to re-render)

- [ ] Replace `#ff922b` with `#f76707` (loop) and the dark "Motion" fill with `#d9480f`
- [ ] Run `node docs/brand/render.mjs`; expect both PNGs 924 × 240
- [ ] Verify: `grep -rn ff922b docs/brand public` prints nothing; view both PNGs
- [ ] Commit `docs(brand): dark logo uses the app's oranges; lockup render script`

### Task 2: Screenshots and link preview

**Files:**
- Create: `docs/screenshots/take.mjs`, `docs/screenshots/scenes.json`
- Modify: `docs/screenshots/{run,convert,edit-dark}.png`; Create: `docs/screenshots/{minimize,tutorial}.png`
- Modify: `public/og.png`

- [ ] Run `node docs/screenshots/take.mjs` against `vite preview`; view each PNG (convert at step 6/8, minimize at 3/4, both paused)
- [ ] Run `node docs/brand/og/render.mjs`; view `public/og.png`
- [ ] Commit `docs: retake the README screenshots and the link preview`

### Task 3: README

**Files:**
- Modify: `README.md` (structure per spec), `docs/brand/README.md` (screenshot script pointer), `PROGRESS.md` (Done entry)

- [ ] Write the README to the approved outline
- [ ] Verify: every `docs/...` and `public/...` path in it exists; `npx prettier --check README.md PROGRESS.md`
- [ ] Commit `docs: rewrite the README for the public v1 repo`
