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
- The link-preview image `public/og.png` is rendered from `docs/brand/og/og.html` by `node docs/brand/og/render.mjs`.

## Commands

- `npm run dev`: dev server (Vite `base` is `/automotion/`, so open `http://localhost:5173/automotion/`)
- `npm test`: all unit/component tests once; `npm run test:watch` to watch
- One test file: `npx vitest run src/core/run.test.ts`; one test by name: `npx vitest run -t "stuck run"`
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run format` (CI runs `npm run format:check`)
- `npm run e2e`: Playwright (Chromium) against a production build served by `vite preview` on port 4173.
  First time: `npx playwright install chromium`. One spec: `npx playwright test e2e/convert.spec.ts`.
- CI runs typecheck, lint, the Prettier check, unit tests and e2e on every push/PR, then compiles the LaTeX
  that `e2e/latex-samples.spec.ts` exports with pdflatex (there is no TeX locally, so LaTeX output is
  only checked there), and deploys to GitHub Pages from `master` once all pass.

## Architecture

`core/` is pure TypeScript with no React and imports none of the other folders; `layout/` imports only
`core/`. Nothing outside `ui/` imports `ui/`.

### `src/core/`

- `model.ts`: one `Automaton` type for DFAs and NFAs (`kind` selects the rules). States carry their own
  `x`/`y`. At most one `Transition` per (from, to) pair, holding all its `symbols`. `EPSILON = 'ε'` never
  appears in `alphabet`; the symbol type is `Sym` (not `Symbol`). `starts`: at most one on a DFA, any
  number on an NFA; `startStates(a)` ignores stale ids.
- `validate.ts` returns `Issue[]` and never throws; the UI disables actions with the reason instead.
  An incomplete DFA is an error (`incomplete-dfa`) that blocks a run, but minimization and the
  NFA → DFA kind switch skip it via `ignoringIncomplete`.
- `edit.ts`: every edit is a pure `Automaton → Automaton` function. There is no alphabet editor:
  `store.edit` keeps `alphabet` in sync with the transitions.
- `run.ts`, `subset.ts`, `minimize.ts` compute a whole process eagerly into an immutable trace of step
  snapshots (`trace.ts`); each has a `can*` guard returning a user-facing reason or `null`.
  `subsetConstruction` throws past `MAX_DFA_STATES` (64).
- `regex.ts`: parser (never throws) and minimal-parentheses printer. A symbol is one code point other
  than `| + * ( ) , \`, ε, ∅ and whitespace (ignored); `\eps`/`\emptyset` normalise to ε/∅. Parse-error
  offsets are UTF-16 offsets into the normalised text.
- `thompson.ts` only exports `thompsonNfa` (regex → ε-NFA). `regexToDfa.ts`: regex → Thompson NFA →
  bitset subset construction → Hopcroft minimization → relabel (`q_0`… breadth-first); input past
  `MAX_REGEX_INPUT` (1000 chars) or a minimal DFA past `MAX_DFA_STATES` is refused. It makes no trace;
  `store/regexActions.ts` (`createFromRegex`) lays the result out and adds it.
- `geometry.ts`: how the diagram is drawn, as pure math (radius, curves and automatic bends, loops,
  start arrows, label spots). The canvas, exports and the layout's scoring all use it, so change it here.
- `testing/fixtures.ts` (`fixture()`: ids equal labels) and `testing/arbitraries.ts` (fast-check
  generators) back the property tests; `testing/language.ts` compares languages on all short words.

### `src/layout/`

`layoutAutomaton` (Tidy, subset walkthrough results) builds several candidate layouts per connected part
and keeps the cheapest by `layoutCost`, measured on the curves the canvas draws. The cost weights were tuned
on `samples.ts` and `layout.test.ts` guards them: rerun it after touching costs or candidates.
It runs in a Web Worker (`layoutClient.ts`) loaded by dynamic `import()`, so elk (~1.5 MB) stays out of
the main bundle; `layout.worker.ts` must assign `self.onmessage` after its imports, because
`elk.bundled.js` claims it inside a worker. Without workers (jsdom tests) it runs on the page.

### `src/store/`

- One Zustand store (`store.ts`). `useAppStore` selectors must return stable references (see its doc
  comment) or React 19 loops.
- The editing lock lives here: `edit`, `checkpoint` and undo/redo do nothing while a trace is open.
- `automata` is kept most recently edited first and saved in that order (the app reopens on the last
  edited one): edits, undo/redo, creating and adding move one to the front; switching doesn't.
- The clipboard is in memory only, never saved. `traceActions.ts` opens traces. `openTrace` bumps `traceKey`, which `App` keys the player on (one player per opened trace).
- Read-only automata: ids in `readOnly` (set by lessons, never saved) refuse `edit`, undo/redo into other
  structure, cut and paste unless `sameStructure` (`core/edit.ts`) holds, so layout moves, Tidy and runs
  still work. Each refusal bumps `blockedEdits`, which the tutorial card reads to say it's read-only.

### `src/persistence/`

- localStorage autosave (key `automotion:v1`) and the JSON file format
  `{ format: "automotion", version, automata }` (version 2). Every load goes through `migrate()` and the
  zod schema; only the autosave load repairs dangling start/accepting ids, imports and share links stay
  strict. Bump the version and extend `migrate()` for any format change.
- Keep the legacy paths: files tagged `"automaton-vis"` (`LEGACY_FORMAT`) and `migrateLegacyKeys()`
  (old `automaton-vis:*` keys), from before the 2026-10-29 rename.
- `shareLink.ts`: one automaton in the URL hash (`#a=`), deflate-raw via `CompressionStream` + base64url;
  `decodeShare` caps inflation at `MAX_SHARE_BYTES` against crafted links.
- LaTeX: `latexImport.ts` reads TikZ leniently; `latexText.ts` holds the conventions shared with the
  writer (`ui/canvas/exportLatex.ts`, which needs the canvas geometry), including the `% AutoMotion …`
  comments that round-trip kind, name and `mergedFrom`. Change both sides together.
- There are no built-in examples; e2e specs import `e2e/fixtures/automata.json`.

### `src/ui/`

- `canvas/Diagram.tsx` renders an automaton as SVG from props. Its `data-testid`s and `data-*`
  attributes are a contract used by tests, e2e and export. Thumbnails and the tutorial's
  `GoalPicture` are their own SVGs so those ids stay unique (the welcome demo does duplicate them
  while the welcome is open).
- `canvas/useCanvasEditing.ts` holds all editing gestures; pointer capture starts only once a drag
  crosses 3 px, so double-clicks keep their real target.
- `player/`: the generic `TracePlayer` plus one view per trace kind (`TraceView` switches on `kind`).
- `shell/`: top bar, history bar, dock, dialogs, import/export. Confirmations use `askConfirm()`
  (`confirmStore.ts`), never `window.confirm`. `regexDialogStore.ts` opens the From regex dialog.
- Every letter shortcut goes through `shell/shortcut.ts` (`isCtrlLetter`, `shortcutLetter`), which handles
  non-Latin layouts (Hebrew Ctrl+A is `ש`).
- Hover styles go inside `@media (hover: hover)`, so taps don't leave them stuck.
- `tutorial/engine.ts` holds the `Lesson`/`StepSpec` types, `lessonSteps` and `advance`: a step completes by
  a check on the automaton, a run reaching its verdict, a latch, or a reported action. `tutorial/lessons/`
  has `basics.ts` (the original tutorial), `nfa`, `epsilon`, `convert`, `minimize` and `share`; `index.ts`
  lists them in order. Lessons open a read-only copy of a ready-made automaton; automata saved from their walkthroughs
  belong to the lesson (Quit removes them, Finish keeps them); a lesson's walkthrough offers only Save as new
  automaton, not Save and minimize (`player/traceExtraActions.tsx`). A step with `idea: true` is
  read, not done, and goes on with Next (`tutorial-next`). A step's `explain` shows first on the card, then
  its instruction. `pausedRuns` lists words whose runs open paused, stepped by hand with → (NFAs on `001`,
  ε-moves on `b`; `lessons/handStep.ts`); `pausedConvert` opens Convert to DFA walkthroughs paused too
  (Convert waits on «{q_0}» for →; Minimize walkthroughs always open paused). A step's `pauseAt`
  pauses the player (`stopAt`, via `lessonStopAt`) at the moment the card explains while the run is before it, else at the next one
  (every hand-stepped, Convert and Minimize step). During an idea step the pacing step is the one
  Next would land on (`pacingStep`), so a run opened early is paced too. A step done on reaching a
  point of a run or walkthrough has `steppedBack`: stepped back (←) before that point, it shows again,
  so the card follows the trace back. While another automaton is open the card hides (it comes back on
  the lesson's own). Finishing Basics removes its automaton and its popup offers Start building or See
  the lessons (Controls on the Lessons tab); a lesson's Finish keeps its automata and offers Next
  (`nextLesson`: never Basics; See the lessons once none is left).
  Only Basics has goal pictures and frames the word box and dock.
- Lesson texts mark keys `[Shift]`, states `«even»` and words to type in backticks. `lessons/index.test.ts`
  caps them: instructions 100 chars (idea steps 240), why lines 110 (70 for Basics, so its wording
  stays as it was), `explain` 140.
- `TutorialPointer.tsx` draws over the top bar for toolbar buttons, with a tight frame on buttons. Finished
  lessons are saved under `automotion:lessons-done` (`lessonsDone.ts`); the Controls Lessons tab shows ✓.

Interactive elements have stable `data-testid`s and accessible names that e2e relies on: keep them when
restyling. Tests are colocated as `*.test.ts(x)`; Playwright specs live in `e2e/`.

### Theme, fonts and export

- Theme tokens are in `ui/theme.css`. Diagram colors must go through CSS custom properties with plain
  fallbacks: SVG/PNG export resolves `var()` against a hidden `.av-theme-light` probe, so exports always
  use the light palette.
- Names and prose are Geist; input symbols (tape, typed word, edge labels, tutorial words) are IBM Plex
  Mono (`--av-font-symbol`), whose dotted 0 reads neither as O nor ∅. It has no Greek, so ε falls back to Geist.
- Exports (`canvas/exportDiagram.ts`) embed subsetted fonts from Google Fonts (`canvas/embedFont.ts`).
  If a diagram font or weight changes, update `embedFont.ts`, `EDGE_LABEL_CHAR_WIDTH` (`core/geometry.ts`)
  and the glyph ink table in `core/label.ts`.
- State labels sit on the alphabetic baseline at `labelBaselineOffset` (`core/label.ts`), not
  `dominant-baseline: central` (which left `q₀` ~3 px low); edge labels do use `central`.
