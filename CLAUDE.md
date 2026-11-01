# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AutoMotion

Visualize finite automata (DFA, NFA): build them, draw them, and step through their run on a word,
NFA → DFA conversion and DFA minimization. Static site, no backend; live at
https://tomerti.github.io/automotion/.

- Stack: TypeScript (strict, `noUncheckedIndexedAccess`), React 19, Vite, custom SVG renderer, elkjs,
  Zustand + immer, zod, Vitest + fast-check + Testing Library, Playwright.
- Design spec (binding when behavior is unclear): `docs/superpowers/specs/2026-10-28-automotion-design.md`.
- Track tasks in `PROGRESS.md`: tick items off when they're done and add follow-up tasks as they come up.

## Commands

- `npm run dev`: dev server (Vite `base` is `/automotion/`, so open `http://localhost:5173/automotion/`)
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
    `x`/`y` (and an optional `startAngle`, the direction their start arrow comes from; default the
    left); at most one `Transition` per (from, to) pair, holding all its `symbols`. `EPSILON = 'ε'`
    never appears in `alphabet`; the symbol type is `Sym` (not `Symbol`). `starts` lists the start
    states: at most one on a DFA, any number on an NFA (accepting when a run from any of them does);
    `startStates(a)` ignores stale ids. Converting a multi-start NFA first adds a single start state
    `q_s` with ε-transitions to the old ones (`withSingleStart` in `subset.ts`).
  - `validate.ts` returns `Issue[]` (errors/warnings) and never throws; the UI disables actions with the
    reason instead. An incomplete DFA is an error (code `incomplete-dfa`) that blocks a run, but
    minimization (it adds a dead state) and the NFA → DFA kind switch skip it via `ignoringIncomplete`,
    so only NFA runs get stuck.
  - `edit.ts`: every edit is a pure `Automaton → Automaton` function, shared by the canvas and the table.
  - `clipboard.ts`: Ctrl+C / Ctrl+V. `copyStates` snapshots states with their arrows out (to each other
    and to outside states, never into the copy); `pasteClip` adds them with fresh ids, primed labels
    (`q_1'`), accepting but not start, dropping arrows to states the target lacks. Ctrl+C copies
    states when `selectedStates()` (store) has any, and the diagram as a picture (Toolbar) otherwise.
  - `run.ts`, `subset.ts`, `minimize.ts` compute a whole process eagerly into an immutable trace of step
    snapshots (`trace.ts`). Each has a `can*` guard returning a user-facing reason or `null`.
    `subsetConstruction` throws past `MAX_DFA_STATES` (64).
  - `testing/fixtures.ts` (`fixture()`: ids equal labels) and `testing/arbitraries.ts` (fast-check
    generators) back the property tests.
- `src/layout/layout.ts`: elkjs wrapper (imports only `core/`). It is always loaded with a dynamic
  `import()` (Tidy, subset walkthrough) so elk (~1.5 MB) stays out of the main bundle.
- `src/store/`: one Zustand store (`store.ts`) holding the automata, active id, selection, per-automaton
  viewports, the open trace, per-automaton undo/redo (capped at 100) and the clipboard
  (`copySelection` / `paste`; in memory only, never saved). `automata` is kept most
  recently edited first: edits, undo/redo, creating and adding move one to the front (switching doesn't),
  and that order is what gets saved, so the app reopens on the last edited automaton. The editing lock lives here:
  `edit`, `checkpoint` and undo/redo do nothing while a trace is open. Selecting, creating or adding an
  automaton closes the trace. `useAppStore` selectors must return stable references (see its doc comment)
  or React 19 loops. `traceActions.ts` opens traces (`startRun`, `startSubset`, `startMinimize`).
- `src/persistence/`: localStorage autosave (key `automotion:v1`, 500 ms debounce, flush on `pagehide`),
  and the versioned JSON file format
  (`{ format: "automotion", version, automata }`, version 2; `migrate()` turns v1's single `start`
  into `starts`). Every load goes through `migrate()` and the zod schema; corrupt stored data is copied to a backup key and a blank automaton loads instead. There are no
  built-in examples; e2e specs import `e2e/fixtures/automata.json`. The first release seeded three:
  the first load in a browser (flag `automotion:old-examples-checked`) removes the ones never
  changed (`oldExamples.ts`) and saves the result. The project was called Automaton Vis until
  2026-10-29: files tagged `"automaton-vis"` still import (`LEGACY_FORMAT`), and `migrateLegacyKeys()`
  (first thing in `main.tsx`) moves old `automaton-vis:*` localStorage keys to `automotion:*`.
- `src/ui/`:
  - `canvas/`: `Diagram.tsx` renders an automaton as SVG from props (`highlight` drives active/taken
    states, tints, visibility). Its `data-testid`s and `data-*` attributes are a contract used by tests,
    e2e and export. `useCanvasEditing.ts` holds all editing gestures; pointer capture starts only once a
    drag crosses 3 px, so double-clicks keep their real target. Pure math is in `geometry.ts` / `viewport.ts`.
  - `player/`: the generic `TracePlayer` plus one view per trace kind (`TraceView` switches on `kind`);
    `traceExtraActions.tsx` adds the "Save as new automaton" button.
  - `shell/`: top bar (history toggle, the open automaton's name to rename it, toolbar, issues chip,
    theme menu (System / Light / Dark: `theme.ts` resolves it to `<html data-theme>`), Controls popup), the left history bar (`HistoryBar.tsx`, floating over the full-width canvas so everything stays
    centred on the window; fits keep `--av-history-inset` clear on both sides: every automaton with a
    `canvas/Thumbnail.tsx` picture, newest edit first, a ⋯ menu per entry for rename / duplicate /
    export / delete (`store.duplicateAutomaton`), Delete/Backspace on a focused entry deletes it (after a confirm), Create (a blank DFA
    named "Untitled", "Untitled 2", …) on top and Import / Export all below; open/closed remembered in
    `historyPrefs.ts`), the DFA/NFA switch floating at the top of the canvas (`KindPill.tsx`, hidden
    while a trace is open), the bottom dock (run pill / trace player), toasts, error boundary,
    import/export plumbing. Thumbnails are their own
    small SVG, not `Diagram`, so the canvas's `data-testid`s stay unique. There is no table or
    alphabet editor: `store.edit` keeps `alphabet` in sync with the transitions.
  - `tutorial/`: the interactive tutorial. `steps.ts` is a pure step table (each step's `done`,
    `hint`, pointer `target`) over the tutorial automaton and the open trace, with `advance()`
    (moves on, falls back within a part, latches runs at their verdict), and `PART_GOALS`: what
    each part builds (a sentence, example words, the finished automaton), shown above the
    checklist with `GoalPicture.tsx` (its own SVG, no `Diagram` test ids). The states are named
    `even` / `odd` in part 1 and `any` in part 2. Its texts mark keys as
    `[Shift]` (rendered as `<kbd>`), states as `«even»` (a small state), and words/symbols to
    type in backticks (`<code>`, in the dotted-zero `--av-font-symbol`, since Geist's 0 reads as
    O); prose says "zeros", not "`0`s". `tutorialStore.ts`
    subscribes to `appStore` while a tutorial runs. `TutorialCard` floats in the canvas corner as
    the part's goal over a checklist (the current part's finished steps ticked, the step to do last); its X asks, then
    `quitTutorial()` removes the tutorial automaton (Finish keeps it). `TutorialPointer` frames
    the target with orange corner brackets (portal, follows it each frame; not a ring, which would
    read as accepting), and `WelcomeCard` is the first-visit dialog (key `automotion:seen-help`, set when it is answered,
    not when it opens, so a reload before answering shows it again);
    the Controls popup no longer opens by itself. Its `WelcomeDemo` plays random words on the
    "ends in 01" NFA forever (`demoRun.ts`) through `RunTraceView` with `ambient` (silent, 1×, no
    verdict banner), inert and `aria-hidden`; while the welcome is open its `data-testid`s
    (`diagram`, `run-token`, …) exist twice. Finish fits the view and opens `FinishedCard`
    (a random joke from `cheers.ts`, confetti, a fanfare from `player/sound.ts`); ticked steps
    stay silent. `.av-go` (theme.css) is the orange pill of Run, Start tutorial and Finish.
  - `LabelText.tsx` renders `q_1` / `q_{12}` subscripts in HTML text (`core/label.ts` parses them;
    the canvas uses `<tspan>`s).
  - Theme tokens are in `ui/theme.css`. Diagram colors must go through CSS custom properties with plain
    fallbacks: SVG/PNG export resolves `var()` against a hidden `.av-theme-light` probe, so exports always
    use the light palette.
  - Exported pictures (SVG, PNG, Copy image / Ctrl+C) come from one standalone SVG
    (`canvas/exportDiagram.ts`): the whole automaton, ignoring zoom and pan, PNGs at a fixed
    `PNG_SCALE`. `canvas/embedFont.ts` embeds Geist 500, cut down to the characters drawn, fetched from
    Google Fonts at export time. If the diagram's label font or weight changes, change it there too.

Tests are colocated as `*.test.ts(x)`; Playwright specs live in `e2e/`. Interactive elements have stable
`data-testid`s and accessible names that the e2e specs rely on, so keep them when restyling.
