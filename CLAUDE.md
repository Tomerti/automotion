# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AutoMotion

Visualize finite automata (DFA, NFA): build them, draw them, and step through their run on a word,
NFA → DFA conversion and DFA minimization. Static site, no backend; live at
https://tomerti.github.io/automotion/.

- Stack: TypeScript (strict, `noUncheckedIndexedAccess`), React 19, Vite, custom SVG renderer, elkjs,
  Zustand + immer, zod, Vitest + fast-check + Testing Library, Playwright.
- MIT licensed (`LICENSE`); the link-preview image is `public/og.png`, rendered from `docs/brand/og/og.html` by
  `node docs/brand/og/render.mjs`; `index.html` carries the Open Graph / Twitter tags.
- Design spec (binding when behavior is unclear): `docs/superpowers/specs/2026-10-28-automotion-design.md`.
- Track tasks in `PROGRESS.md`: tick items off when they're done and add follow-up tasks as they come up.

## Commands

- `npm run dev`: dev server (Vite `base` is `/automotion/`, so open `http://localhost:5173/automotion/`)
- `npm test`: all unit/component tests once; `npm run test:watch` to watch
- One test file: `npx vitest run src/core/run.test.ts`; one test by name: `npx vitest run -t "stuck run"`
- `npm run typecheck`, `npm run lint`, `npm run build`
- `npm run e2e`: Playwright (Chromium) against a production build served by `vite preview` on port 4173.
  First time: `npx playwright install chromium`. One spec: `npx playwright test e2e/convert.spec.ts`.
- CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests and e2e on every push/PR, then
  compiles the LaTeX that e2e `latex-samples.spec.ts` exported (`LATEX_SAMPLES_DIR`) with pdflatex
  (job `latex`; there is no TeX locally), and deploys to GitHub Pages from `master` only after all pass.
- Don't run `npm run format` (`prettier --write .`) on this Windows checkout: it rewrites line endings
  repo-wide. Format only the files you touch.

## Architecture

Layers, with dependencies pointing downward only:

- `src/core/`: pure TypeScript, no React. Must not import from `layout/`, `store/`, `persistence/` or `ui/`.
  - `model.ts`: one `Automaton` type for DFAs and NFAs (`kind` selects the rules). States carry their own
    `x`/`y` (and an optional `startAngle`, the direction their start arrow comes from; default the
    left); at most one `Transition` per (from, to) pair, holding all its `symbols` (and an optional
    `bend`, `loopAngle`, and `labelSide`: the side of from→to its symbols are drawn on, absent
    meaning outside the curve; `core/geometry.ts` `labelSideOf`). `EPSILON = 'ε'`
    never appears in `alphabet`; the symbol type is `Sym` (not `Symbol`). `starts` lists the start
    states: at most one on a DFA, any number on an NFA (accepting when a run from any of them does);
    `startStates(a)` ignores stale ids. Converting a multi-start NFA first adds a single start state
    `q_s` with ε-transitions to the old ones (`withSingleStart` in `subset.ts`).
  - `validate.ts` returns `Issue[]` (errors/warnings) and never throws; the UI disables actions with the
    reason instead. An incomplete DFA is an error (code `incomplete-dfa`, one per incomplete state,
    with its `stateId`) that blocks a run, but
    minimization (it adds a dead state) and the NFA → DFA kind switch skip it via `ignoringIncomplete`,
    so only NFA runs get stuck.
  - `edit.ts`: every edit is a pure `Automaton → Automaton` function, shared by the canvas and the table.
  - `clipboard.ts`: Ctrl+C / Ctrl+V. `copyStates` snapshots states with their arrows out (to each other
    and to outside states, never into the copy); `pasteClip` adds them with fresh ids, primed labels
    (`q_1'`), accepting but not start, dropping arrows to states the target lacks. Ctrl+C copies
    states when `selectedStates()` (store) has any, and the diagram as a picture (Toolbar) otherwise;
    on a focused history entry it copies that automaton (handled there, `preventDefault` so the
    window listeners skip it).
  - `run.ts`, `subset.ts`, `minimize.ts` compute a whole process eagerly into an immutable trace of step
    snapshots (`trace.ts`). Each has a `can*` guard returning a user-facing reason or `null`.
    `subsetConstruction` throws past `MAX_DFA_STATES` (64).
  - `geometry.ts`: how the diagram is drawn, as pure math (state radius, edge curves with their
    automatic bends, self-loops and their automatic direction, start arrows, label spots).
    `transitionPolyline` samples an arrow's drawn curve; the layout scores layouts with it.
  - `testing/fixtures.ts` (`fixture()`: ids equal labels) and `testing/arbitraries.ts` (fast-check
    generators) back the property tests.
- `src/layout/` (imports only `core/`): `layoutAutomaton` (Tidy, subset walkthrough results). Each
  connected part gets several candidate layouts (`candidates.ts`: a row and a circle in reading
  order (`order.ts`, BFS / DFS from the start), ELK layered variants, a stress layout of its own),
  each with its arrows bent clear of states and its start arrows pointed into free space
  (`aesthetics.ts` `assignBends` / `assignStartAngles`), and the cheapest by `layoutCost` wins:
  crossings, arrows through states, labels on states / labels / arrows, bunched arrows, arrows
  forward in reading order not pointing right, skewed angles, length, bends and area, all on the
  curves the canvas draws. The weights were tuned on `samples.ts` (typical course automata;
  `layout.test.ts` checks them). Tidy replaces positions, bends, loop and start arrow directions
  and label sides. It is always loaded with a dynamic `import()` so elk (~1.5 MB) stays out of the
  main bundle.
- `src/store/`: one Zustand store (`store.ts`) holding the automata, active id, selection, per-automaton
  viewports, the open trace, per-automaton undo/redo (capped at 100) and the clipboard
  (`copySelection` / `paste` for states, `copyAutomaton` / `pasteAutomaton` for a whole automaton:
  whichever was copied last is what Ctrl+V pastes; in memory only, never saved). `automata` is kept most
  recently edited first: edits, undo/redo, creating and adding move one to the front (switching doesn't),
  and that order is what gets saved, so the app reopens on the last edited automaton. The editing lock lives here:
  `edit`, `checkpoint` and undo/redo do nothing while a trace is open. Selecting, creating or adding an
  automaton closes the trace. `useAppStore` selectors must return stable references (see its doc comment)
  or React 19 loops. `traceActions.ts` opens traces (`startRun`, `startSubset`, `startMinimize`).
- `src/persistence/`: localStorage autosave (key `automotion:v1`, 500 ms debounce, flush on `pagehide`),
  and the versioned JSON file format
  (`{ format: "automotion", version, automata }`, version 2 (the schema rejects start/accepting ids that are not states); `migrate()` turns v1's single `start`
  into `starts`). Every load goes through `migrate()` and the zod schema; the autosave load alone first drops dangling
  start/accepting ids (`parseFile(…, { repair: true })`: older builds could save them), while imports and share links stay
  strict; corrupt stored data is copied to a backup key and a blank automaton loads instead. There are no
  built-in examples; e2e specs import `e2e/fixtures/automata.json`. The first release seeded three:
  the first load in a browser (flag `automotion:old-examples-checked`) removes the ones never
  changed (`oldExamples.ts`) and saves the result. The project was called Automaton Vis until
  2026-10-29: files tagged `"automaton-vis"` still import (`LEGACY_FORMAT`), and `migrateLegacyKeys()`
  (first thing in `main.tsx`) moves old `automaton-vis:*` localStorage keys to `automotion:*`.
  `shareLink.ts`: one automaton in the URL hash (`#a=`, `shareUrl(a, base)`): `encodeShare` drops the id and
  rounds x/y, deflate-raw through the browser's `CompressionStream` (no dependency) and base64url; `decodeShare` validates
  with the schema and gives a fresh id; `readShareHash`; `sameAutomaton` compares by normalized content, not key order.
  LaTeX: `latexImport.ts` (`parseLatex`) reads every `tikzpicture` of a `.tex` file as an automaton,
  leniently (positioning, `edge`/`to`/`--`, loops, bends, label sides from `swap`/`'`/`auto=right`
  or `node[below]`, `initial` or a drawn start arrow) and
  validates it with the zod schema; `latexText.ts` holds the shared conventions (`PX_PER_CM` = 50,
  label/symbol escaping both ways, the `% AutoMotion NFA: name` comment that round-trips kind and
  name). The writer is `ui/canvas/exportLatex.ts` (it needs the canvas geometry: automatic bends and
  loop directions; `latexDocumentAll` is Export all, a page per automaton); `importFile.ts` picks
  LaTeX by the `.tex` extension or a `\begin{tikzpicture}`. Ctrl+V with TikZ on the system clipboard
  imports it too (`ui/shell/pasteLatex.ts`, the window's `paste` event): the canvas's Ctrl+V pastes
  the app's own clipboard at once while the window kept the focus since the app's last copy, and
  otherwise defers to the paste event (`deferPaste`) in case something was copied elsewhere.
- `src/ui/`:
  - `canvas/`: `Diagram.tsx` renders an automaton as SVG from props (`highlight` drives active/taken
    states, tints, visibility). Its `data-testid`s and `data-*` attributes are a contract used by tests,
    e2e and export. `useCanvasEditing.ts` holds all editing gestures; pointer capture starts only once a
    drag crosses 3 px, so double-clicks keep their real target. Pure math is in `core/geometry.ts` / `viewport.ts`;
    `snap.ts` snaps a dragged state (alignment guides and equal-gap markers, both kept out of exports).
  - `player/`: the generic `TracePlayer` plus one view per trace kind (`TraceView` switches on `kind`);
    `traceExtraActions.tsx` adds the "Save as new automaton" button. The views are movable:
    `useFittedViewport` fits the diagram and, unless `interactive: false` (`RunTraceView`'s `ambient`: the welcome
    demo stays inert), the wheel zooms around the pointer (non-passive listener, every step compounds), dragging pans
    and `FitButton.tsx` (`trace-fit`) appears once moved. The user's view is fitted again when the states' extent or the
    pane's width changes; a height-only change (the dock's explanation wrapping, the minimize legend, the tutorial
    card) keeps it, shifted by half the difference. `ZOOM_STEP` and `DRAG_THRESHOLD` are shared with the canvas through `canvas/viewport.ts`.
  - `shell/`: top bar (history toggle, the open automaton's name to rename it, toolbar, issues chip (while its popover is open, `canvas/issueMarks.ts` rings
    the states the issues are about; the canvas paints only non-incomplete errors red all the time),
    theme menu (System / Light / Dark: `theme.ts` resolves it to `<html data-theme>`; the welcome's
    `ThemeSwitch` picks it too, and both follow `saveTheme` through `useThemePref` in `themeChoices.ts`), Controls popup), the left history bar (`HistoryBar.tsx`, floating over the full-width canvas so everything stays
    centred on the window; fits keep `--av-history-inset` clear on both sides: every automaton with a
    `canvas/Thumbnail.tsx` picture, newest edit first, a ⋯ menu per entry for rename / duplicate /
    export / delete (`store.duplicateAutomaton`), Delete/Backspace on a focused entry deletes it (after a confirm), Create (a blank DFA
    named "Untitled", "Untitled 2", …) on top and Import / Export all below; open/closed remembered in
    `historyPrefs.ts`), the DFA/NFA switch floating at the top of the canvas (`KindPill.tsx`, hidden
    while a trace is open), the bottom dock (run pill / trace player), toasts, error boundary,
    import/export plumbing (Import is a menu: a file, or `PasteLatexDialog.tsx`; "Copy link" in the export menu and each
    history entry's ⋯ menu is `copyLink.ts`; `useSharedLink.ts` opens a `#a=` share link on load and on `hashchange`:
    opens the saved copy (`sameAutomaton`) or adds the automaton (replacing a lone blank automaton, a fresh visitor's
    "Untitled"), fits it, toasts and clears the hash, and the welcome stays away on such a visit; `touch.ts`
    `isTouchOnly()`: coarse main pointer and no fine one, a plain media query check (not reactive), makes the welcome the
    phone variant; on phones (≤ 480 px, `App.css`) toasts sit under the top bar). Thumbnails are their own
    small SVG, not `Diagram`, so the canvas's `data-testid`s stay unique. There is no table or
    alphabet editor: `store.edit` keeps `alphabet` in sync with the transitions.
  - `tutorial/`: the interactive tutorial. `steps.ts` is a pure step table (each step's `done`,
    `hint`, pointer `target`) over the tutorial automaton and the open trace, with `advance()`
    (moves on, falls back within a part, latches runs at their verdict), and `PART_GOALS`: what
    each part builds (a few words, example words, the finished automaton), shown at the top of
    the card with `GoalPicture.tsx` (its own SVG, no `Diagram` test ids). Each step is one short
    `instruction` plus an optional few-word `why` (lengths capped by a test); the states are named
    `even` / `odd`, and `any` at the end of part 2; part 3's NFA has `q_0`…`q_2`. Its texts mark keys as
    `[Shift]` (rendered as `<kbd>`), states as `«even»` (a small state), and words/symbols to
    type in backticks (`<code>`, in the dotted-zero `--av-font-symbol`, since Geist's 0 reads as
    O); prose says "zeros", not "`0`s". `tutorialStore.ts`
    subscribes to `appStore` while a tutorial runs. Part 3 (convert and minimize) loads `PART3_NFA` into the tutorial
    automaton once part 2's last run closes (`nfaLoaded`, one undo step, fitted below the card by `fitActive`, which keeps
    `--av-tutorial-pad` clear); its steps `latch` on the open walkthrough (`latch`, `isPart3Trace`) instead of
    checking the automaton, `derivedId` remembers the saved converted DFA so its minimization counts, and hints ask for
    a redo (Ctrl+Y) when the NFA load was undone or to press Convert / Minimize again. The closing card is part 4.
    `TutorialCard` floats at the top centre under the
    DFA/NFA switch: the part's goal (a green "Part N complete!" panel at the hand-over, `PART_DONE`), a
    progress bar ("of 3") and the one step to do now. It sets
    `--av-tutorial-pad` on the canvas area so trace views start below it; its X asks, then
    `quitTutorial()` removes the tutorial automaton (Finish keeps it). `TutorialPointer` frames
    the target with orange corner brackets (portal, follows it each frame; not a ring, which would
    read as accepting), and `WelcomeCard` is the first-visit dialog (on a touch-only device the demo, theme switch and one **Got it** button, no "Press ?" note) (key `automotion:seen-help`, set when it is answered,
    not when it opens, so a reload before answering shows it again);
    the Controls popup no longer opens by itself. Its `WelcomeDemo` plays random words on the
    "ends in 01" NFA forever (`demoRun.ts`) through `RunTraceView` with `ambient` (silent, 1×, no
    verdict banner), inert and `aria-hidden`; while the welcome is open its `data-testid`s
    (`diagram`, `run-token`, …) exist twice. Finish fits the view and opens `FinishedCard`
    (a random joke from `cheers.ts`, confetti, a fanfare from `player/sound.ts`); ticked steps
    stay silent. `.av-go` (theme.css) is the orange pill of Run, Start tutorial and Finish; its `--av-run`, like the run's highlighter, is the same orange in both themes (dark mode only darkens the tints).
  - `LabelText.tsx` renders `q_1` / `q_{12}` subscripts in HTML text (`core/label.ts` parses them;
    the canvas uses `<tspan>`s; `StateNode.tsx` `LabelSpans`, also used by `GoalPicture`). Canvas and goal-picture state labels sit on the alphabetic baseline
    at `labelBaselineOffset` (`core/label.ts`), which centres the body of the main letters (tallest
    top down to the baseline) from per-glyph Geist 500 ink metrics; descenders (`y`'s tail) and
    subscripts hang below, so every label's letters sit at the same height.
    `dominant-baseline: central` centred the em box and left `q₀` ~3 px low. Edge labels still use
    `central` (digits come out centred that way).
  - Theme tokens are in `ui/theme.css`. Diagram colors must go through CSS custom properties with plain
    fallbacks: SVG/PNG export resolves `var()` against a hidden `.av-theme-light` probe, so exports always
    use the light palette.
  - Exported pictures (SVG, PNG, Copy image / Ctrl+C) come from one standalone SVG
    (`canvas/exportDiagram.ts`): the whole automaton, ignoring zoom and pan, PNGs at a fixed
    `PNG_SCALE`. `canvas/embedFont.ts` embeds Geist 500, cut down to the characters drawn, fetched from
    Google Fonts at export time. If the diagram's label font or weight changes, change it there too,
    and re-measure the ink table in `core/label.ts`.

Tests are colocated as `*.test.ts(x)`; Playwright specs live in `e2e/`. Interactive elements have stable
`data-testid`s and accessible names that the e2e specs rely on, so keep them when restyling.
