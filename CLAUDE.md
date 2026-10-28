# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Automaton Vis

Visualize finite automata (DFA, NFA): build them, draw them, and step through their run on a word,
NFA → DFA conversion and DFA minimization. Static site, no backend; live at
https://tomerti.github.io/automaton-vis/.

- Stack: TypeScript (strict, `noUncheckedIndexedAccess`), React 19, Vite, custom SVG renderer, elkjs,
  Zustand + immer, zod, Vitest + fast-check + Testing Library, Playwright.
- Design spec (binding when behavior is unclear): `docs/superpowers/specs/2026-10-28-automaton-vis-design.md`.
- Track tasks in `PROGRESS.md`: tick items off when they're done and add follow-up tasks as they come up.

## Commands

- `npm run dev`: dev server (Vite `base` is `/automaton-vis/`, so open `http://localhost:5173/automaton-vis/`)
- `npm test`: all unit/component tests once; `npm run test:watch` to watch
- One test file: `npx vitest run src/core/run.test.ts`; one test by name: `npx vitest run -t "stuck run"`
- `npm run typecheck`, `npm run lint`, `npm run build`
- `npm run e2e`: Playwright (Chromium) against a production build served by `vite preview` on port 4173.
  First time: `npx playwright install chromium`. One spec: `npx playwright test e2e/convert.spec.ts`.
- CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests and e2e on every push/PR, and deploys
  to GitHub Pages from `master` only after those pass.
- Don't run `npm run format` (`prettier --write .`) on this Windows checkout: it rewrites line endings
  repo-wide. Format only the files you touch.

## Architecture

Layers, with dependencies pointing downward only:

- `src/core/`: pure TypeScript, no React. Must not import from `layout/`, `store/`, `persistence/` or `ui/`.
  - `model.ts`: one `Automaton` type for DFAs and NFAs (`kind` selects the rules). States carry their own
    `x`/`y`; at most one `Transition` per (from, to) pair, holding all its `symbols`. `EPSILON = 'ε'`
    never appears in `alphabet`; the symbol type is `Sym` (not `Symbol`).
  - `validate.ts` returns `Issue[]` (errors/warnings) and never throws; the UI disables actions with the
    reason instead. DFAs may be partial (a missing transition rejects).
  - `edit.ts`: every edit is a pure `Automaton → Automaton` function, shared by the canvas and the table.
  - `run.ts`, `subset.ts`, `minimize.ts` compute a whole process eagerly into an immutable trace of step
    snapshots (`trace.ts`). Each has a `can*` guard returning a user-facing reason or `null`.
    `subsetConstruction` throws past `MAX_DFA_STATES` (64).
  - `testing/fixtures.ts` (`fixture()`: ids equal labels) and `testing/arbitraries.ts` (fast-check
    generators) back the property tests.
- `src/layout/layout.ts`: elkjs wrapper (imports only `core/`). It is always loaded with a dynamic
  `import()` (Tidy, subset walkthrough) so elk (~1.5 MB) stays out of the main bundle.
- `src/store/`: one Zustand store (`store.ts`) holding the automata, active id, selection, per-automaton
  viewports, the open trace and per-automaton undo/redo (capped at 100). The editing lock lives here:
  `edit`, `checkpoint` and undo/redo do nothing while a trace is open. Selecting, creating or adding an
  automaton closes the trace. `useAppStore` selectors must return stable references (see its doc comment)
  or React 19 loops. `traceActions.ts` opens traces (`startRun`, `startSubset`, `startMinimize`).
- `src/persistence/`: localStorage autosave (key `automaton-vis:v1`, 500 ms debounce, flush on `pagehide`),
  and the versioned JSON file format
  (`{ format: "automaton-vis", version, automata }`). Every load goes through `migrate()` and the zod
  schema; corrupt stored data is copied to a backup key and a blank automaton loads instead. There are no
  built-in examples; e2e specs import `e2e/fixtures/automata.json`.
- `src/ui/`:
  - `canvas/`: `Diagram.tsx` renders an automaton as SVG from props (`highlight` drives active/taken
    states, tints, visibility). Its `data-testid`s and `data-*` attributes are a contract used by tests,
    e2e and export. `useCanvasEditing.ts` holds all editing gestures; pointer capture starts only once a
    drag crosses 3 px, so double-clicks keep their real target. Pure math is in `geometry.ts` / `viewport.ts`.
  - `player/`: the generic `TracePlayer` plus one view per trace kind (`TraceView` switches on `kind`);
    `traceExtraActions.tsx` adds the "Save as new automaton" button.
  - `shell/`: top bar (automaton switcher, toolbar, issues chip, theme toggle, Controls popup), the
    bottom dock (run pill / trace player), toasts, error boundary, import/export plumbing. There is
    no table or alphabet editor: `store.edit` keeps `alphabet` in sync with the transitions.
  - `LabelText.tsx` renders `q_1` / `q_{12}` subscripts in HTML text (`core/label.ts` parses them;
    the canvas uses `<tspan>`s).
  - Theme tokens are in `ui/theme.css`. Diagram colors must go through CSS custom properties with plain
    fallbacks: SVG/PNG export resolves `var()` against a hidden `.av-theme-light` probe, so exports always
    use the light palette.

Tests are colocated as `*.test.ts(x)`; Playwright specs live in `e2e/`. Interactive elements have stable
`data-testid`s and accessible names that the e2e specs rely on, so keep them when restyling.
