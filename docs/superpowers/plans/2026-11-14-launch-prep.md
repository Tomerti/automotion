# Launch Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AutoMotion ready to share publicly: license and link preview, share links, tutorial part 3, pan/zoom in walkthroughs, a phone welcome, and the review hardening items.

**Architecture:** Each part is independent. Share links are a pure `persistence/shareLink.ts` module plus a UI hook; tutorial part 3 extends the pure step table (`steps.ts`) with latching trace steps and the store with a "derived DFA" id; pan/zoom replaces `useFittedViewport` with a movable viewport.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), React 19, Zustand + immer, zod, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-14-launch-prep-design.md`

## Global Constraints

- Layering: `src/core/` imports nothing from `layout/`, `store/`, `persistence/`, `ui/`; `persistence/` must not import `ui/`.
- No new runtime dependencies (compression uses the browser's `CompressionStream`).
- Keep every existing `data-testid` and accessible name; new interactive elements get stable `data-testid`s.
- `useAppStore` / `useTutorial` selectors return stable references.
- Don't run `npm run format`; format only touched files (`npx prettier --write <files>`).
- Tutorial texts use the step markup (`[Key]`, `«label»`, backticks) and pass the existing length-cap test in `steps.test.ts`.
- Diagram colors through CSS custom properties with fallbacks.
- Every task ends with `npm run typecheck`, `npm run lint` and the relevant `npx vitest run <files>` green; commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tick the matching item in `PROGRESS.md` under a new `### Launch prep (2026-11-14)` heading in Done as each task lands.

## Review Focus

1. A share link copied from a large automaton (64 states, long labels) still decodes; the URL is not mangled by `+`, `/`, `=` (base64url, no padding). → Task 4 test `round-trips a 64-state automaton`.
2. A share link opened while a trace is open or the tutorial is running opens the automaton and doesn't crash the tutorial (card shows "elsewhere"). → Task 6 test `opens a link while a trace is open`.
3. A user who closes the conversion walkthrough before its end in tutorial part 3 is told to reopen it, not stuck. → Task 7 test `asks to convert again when the walkthrough is closed early`.
4. Wheel over a walkthrough pane zooms that pane only and doesn't scroll the page; resizing the window after panning re-fits. → Task 9 tests `wheel prevents default` and `re-fits when the size changes`.
5. On a phone, opening a shared link shows the automaton fitted and a word runs to its verdict (no overlapping top bar / dock). → Task 10 e2e.

---

### Task 1: License, version and link-preview tags

**Files:**
- Create: `LICENSE`
- Modify: `package.json` (`version`, add `license`), `index.html` (head), `README.md` (one line under Development: "MIT licensed, see LICENSE")

- [ ] **Step 1:** Write `LICENSE`: the standard MIT text, first line after the title `Copyright (c) 2026 Tomer Titinger`.
- [ ] **Step 2:** `package.json`: `"version": "1.0.0"`, `"license": "MIT"` (after `version`).
- [ ] **Step 3:** `index.html`, after the description meta:

```html
<meta property="og:type" content="website" />
<meta property="og:site_name" content="AutoMotion" />
<meta property="og:title" content="AutoMotion · Watch automata come to life" />
<meta property="og:description" content="Build finite automata (DFAs and NFAs), draw them, and watch them run, step by step." />
<meta property="og:url" content="https://tomerti.github.io/automotion/" />
<meta property="og:image" content="https://tomerti.github.io/automotion/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="AutoMotion running a word on an NFA, step by step" />
<meta name="twitter:card" content="summary_large_image" />
```

- [ ] **Step 4:** `npm run build`; expect success and `dist/index.html` containing `og:image`.
- [ ] **Step 5:** Commit `chore: MIT license, v1.0.0 and link-preview tags`.

### Task 2: Link-preview image

**Files:**
- Create: `docs/brand/og/og.html`, `docs/brand/og/render.mjs`, `public/og.png`
- Modify: `docs/brand/README.md` (how to regenerate)

- [ ] **Step 1:** `og.html`: a fixed 1200×630 page, light background `#fbfaf7`-ish matching theme.css's light paper, left column with `../lockup.svg` (~420 px wide) and the tagline "Watch automata come to life" (Geist 600 from Google Fonts, ~44 px) plus a one-line subtitle "Build DFAs and NFAs, run words, convert and minimize, step by step."; right side `../../screenshots/run.png` with rounded corners and a soft shadow, cropped to fit. No external images other than these and the font.
- [ ] **Step 2:** `render.mjs`: `import { chromium } from '@playwright/test'`; open `og.html` via `file://` URL (resolved from `import.meta.url`), viewport 1200×630, `deviceScaleFactor: 1`, wait for `document.fonts.ready`, screenshot to `public/og.png`. Run: `node docs/brand/og/render.mjs`.
- [ ] **Step 3:** Open `public/og.png` (Read tool) and check: 1200×630, lockup and screenshot visible, nothing clipped. Iterate on `og.html` until it looks clean.
- [ ] **Step 4:** `npm run build` and confirm `dist/og.png` exists.
- [ ] **Step 5:** Commit `feat: link-preview image`.

### Task 3: Review hardening

**Files:**
- Modify: `src/persistence/schema.ts`, `src/ui/canvas/exportDiagram.ts` (`svgToPng`), `e2e/multi-start.spec.ts:27`
- Test: `src/persistence/persistence.test.ts`, `src/ui/canvas/exportDiagram.test.ts`

- [ ] **Step 1: Failing tests.** In `persistence.test.ts`: `it('rejects an accepting state that is not a state')`: `parseFile` of a v2 file whose automaton has `accepting: ['ghost']` → `{ ok: false, error: 'Accepting state ghost is not a state' }`. In `exportDiagram.test.ts`: `it('rejects an SVG without a size')`: `await expect(svgToPng('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).rejects.toThrow('Nothing to draw')`.
- [ ] **Step 2:** Run `npx vitest run src/persistence/persistence.test.ts src/ui/canvas/exportDiagram.test.ts`; both new tests fail.
- [ ] **Step 3:** In `automatonSchema.superRefine`, after the starts loop, the same loop over `a.accepting` with message `` `Accepting state ${s} is not a state` ``. In `svgToPng`, before creating the image: `if (!(w > 0 && h > 0)) { reject(new Error('Nothing to draw')); return; }` (covers NaN).
- [ ] **Step 4:** Rerun; pass. Check no other test relied on dangling accepting ids (`npm test`).
- [ ] **Step 5:** `e2e/multi-start.spec.ts:27`: replace the `isEnabled()` branch with a deterministic wait: read the surrounding test, decide the state the button must be in, and use `await expect(first).toBeEnabled()` then click (or `toBeDisabled()` if it must not be clicked). Run `npx playwright test e2e/multi-start.spec.ts`; pass.
- [ ] **Step 6:** Commit `fix: reject dangling accepting states, guard empty PNG export, wait in e2e`.

### Task 4: Share-link encoding

**Files:**
- Create: `src/persistence/shareLink.ts`, `src/persistence/shareLink.test.ts`

**Interfaces:**
- Consumes: `parseFile(text, existingIds): ParseResult` and `ParseResult` from `fileFormat.ts`; `CURRENT_VERSION` from `migrate.ts`; `FORMAT` from `schema.ts`; `newId` from `core/id`.
- Produces:
  - `encodeShare(a: Automaton): Promise<string>`: payload (base64url, no padding).
  - `shareUrl(a: Automaton, base: string): Promise<string>`: `` `${base}#a=${payload}` ``.
  - `readShareHash(hash: string): string | null`: payload of `#a=<payload>` (non-empty), else `null`.
  - `decodeShare(payload: string, existingIds: Set<string>): Promise<ParseResult>`: never rejects.
  - `sameAutomaton(a: Automaton, b: Automaton): boolean`: deep-equal ignoring `id`.

- [ ] **Step 1: Failing tests** (`shareLink.test.ts`, using `fixture()` from `core/testing/fixtures`):
  - `round-trips a DFA`: `decodeShare(await encodeShare(a), new Set())` → `ok`, one automaton, `sameAutomaton(result, a)` (with integer positions in the fixture).
  - `round-trips an NFA with ε, several starts, bends, loop angles, label sides and subscripts`: same, NFA fixture with `starts: ['q_0','q_1']`, an `ε` symbol, `bend: 30`, `loopAngle: 1.2`, `labelSide: 'right'`, labels `q_{12}` and `ünï`.
  - `round-trips a 64-state automaton`: generated states `s0..s63` with 64 transitions; also `expect(payload).toMatch(/^[A-Za-z0-9_-]+$/)`.
  - `drops the id and rounds positions`: `x: 10.6` → decoded `x: 11`; decoded id differs from the original id when the original is in `existingIds`.
  - `rejects corrupt payloads`: each of `'!!!'`, `'aGVsbG8'` (base64 of "hello", not deflate), a valid deflate of `'not json'`, of `'{"format":"other"}'`, and of a file whose transition points at an unknown state → `ok: false` with a non-empty `error`.
  - `reads the hash`: `readShareHash('#a=abc')` → `'abc'`; `'#a='`, `'#b=abc'`, `''` → `null`.
  - `sameAutomaton ignores ids only`: same content different id → true; different label → false.
- [ ] **Step 2:** `npx vitest run src/persistence/shareLink.test.ts`; fails (module missing). If jsdom lacks `CompressionStream`, add to `src/test/setup` (or the existing vitest setup file) a polyfill assignment from `node:stream/web` (`CompressionStream`, `DecompressionStream`); Node 18+ has both.
- [ ] **Step 3:** Implement. Encode: `JSON.stringify({ format: FORMAT, version: CURRENT_VERSION, automata: [rest] })` where `rest` is `a` without `id`, states with `Math.round` x/y (startAngle kept); bytes through `new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))`, read with `new Response(stream).arrayBuffer()`; base64url via `btoa` over bytes then `+`→`-`, `/`→`_`, strip `=`. Decode reverses it inside one `try`; before `parseFile`, give the decoded automaton `id: newId()` when it has none. `catch` → `{ ok: false, error: 'This link is damaged or incomplete' }`. `sameAutomaton`: `JSON.stringify` of both with `id` removed.
- [ ] **Step 4:** Rerun; pass.
- [ ] **Step 5:** Commit `feat: encode an automaton into a share link`.

### Task 5: Copy link

**Files:**
- Create: `src/ui/shell/copyLink.ts`
- Modify: `src/ui/shell/Toolbar.tsx` (ExportMenu, after Copy LaTeX), `src/ui/shell/HistoryBar.tsx` (entry ⋯ menu, after Duplicate)
- Test: `src/ui/shell/Toolbar.test.tsx`, `src/ui/shell/HistoryBar.test.tsx`

**Interfaces:**
- Consumes: `shareUrl` (Task 4), `toast` from `toastStore.ts`.
- Produces: `copyLink(a: Automaton): Promise<void>`: writes `await shareUrl(a, location.origin + location.pathname)` with `navigator.clipboard.writeText`, then `toast('Link copied')`; on failure `toast('Could not copy the link', 'error')`.

- [ ] **Step 1: Failing tests.** Toolbar: `it('Copy link puts a link to the automaton on the clipboard')`: mock `navigator.clipboard.writeText`, open "Copy or export", click menuitem "Copy link"; the written text starts with `location.origin + location.pathname + '#a='` and `decodeShare` of its payload gives an automaton `sameAutomaton` to the active one. HistoryBar: `it('an entry menu copies its link')`: same through the entry's ⋯ menu, for a non-active entry.
- [ ] **Step 2:** Run both test files; the new tests fail.
- [ ] **Step 3:** Implement `copyLink`; add `item('Copy link', 'copy', () => void copyLink(automaton))` to ExportMenu after Copy LaTeX (guard `automaton` as the other items do), and `item('Copy link', () => void copyLink(automaton))` to the history menu after Duplicate.
- [ ] **Step 4:** Rerun; pass.
- [ ] **Step 5:** Commit `feat: Copy link in the export and history menus`.

### Task 6: Open a shared link

**Files:**
- Create: `src/ui/shell/useSharedLink.ts`, `src/ui/shell/useSharedLink.test.tsx`, `e2e/share-link.spec.ts`
- Modify: `src/ui/shell/help.ts` (`useWelcome`), `src/ui/shell/App.tsx`

**Interfaces:**
- Consumes: `readShareHash`, `decodeShare`, `sameAutomaton` (Task 4); `appStore` (`automata`, `addAutomaton`, `setActive`); `fitActive` from `canvas/useCanvasEditing`; `toast`.
- Produces:
  - `arrivedByLink(): boolean` (in `useSharedLink.ts`): `readShareHash(location.hash) !== null`, read once at module load into a constant so later hash clearing doesn't change it.
  - `openSharedLink(hash: string): Promise<void>`: the whole open flow (exported for tests).
  - `useSharedLink(): void`: calls `openSharedLink(location.hash)` on mount and on `hashchange`.
  - `useWelcome(suppress?: boolean)`: when `suppress` is true, starts closed and does not mark seen.

- [ ] **Step 1: Failing tests** (`useSharedLink.test.tsx`, store reset per test as other store tests do):
  - `adds and opens the shared automaton`: `openSharedLink('#a=' + payload)` → store's first automaton is it, `activeId` its id, an info toast `` `Opened “${a.name}”` ``, and `history.replaceState` called with a URL without the hash.
  - `opens the saved copy instead of adding a duplicate`: store already holds `sameAutomaton` content → automata count unchanged, `activeId` is the saved one.
  - `opens a link while a trace is open`: a run trace open → after opening, `trace` is null and the shared automaton is active.
  - `reports a broken link`: `'#a=!!!'` → error toast `This link's automaton couldn't be read`, automata unchanged, hash cleared.
  - `ignores other hashes`: `'#foo'` → nothing happens, `replaceState` not called.
  - In a `help` test: `useWelcome(true)` starts closed and leaves `automotion:seen-help` unset.
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Implement. Clear the hash with `history.replaceState(null, '', location.pathname + location.search)` whenever a payload was found (success or failure). After adding/selecting, fit on the next animation frame (as `finishTutorial` does) so the canvas has its size. `App`: `useSharedLink()` next to `usePasteLatex()`, `useWelcome(arrivedByLink())`.
- [ ] **Step 4:** Rerun; pass. `npm test` green.
- [ ] **Step 5: e2e** `share-link.spec.ts` (follow `copy-image.spec.ts` for clipboard permissions, `helpers.ts` for setup): build an automaton or import `e2e/fixtures/automata.json`; Copy link from the export menu; read the clipboard; in a new browser context (fresh storage) `goto(link)`: expect the automaton's name in the top bar, the diagram's states (`data-state-id`) present, no `Welcome` dialog, `page.url()` without `#`. Reload: history entry count unchanged. `goto(link)` again in the same context: count unchanged. `goto(base + '#a=broken')`: error toast visible.
- [ ] **Step 6:** `npx playwright test e2e/share-link.spec.ts`; pass.
- [ ] **Step 7:** Commit `feat: open an automaton from a share link`.

### Task 7: Tutorial part 3 steps

**Files:**
- Modify: `src/ui/tutorial/steps.ts`
- Test: `src/ui/tutorial/steps.test.ts`

**Interfaces:**
- Produces (used by Task 8):
  - `TutorialContext` gains `derivedId: string | null` (the DFA saved from the tutorial's conversion).
  - `StepId` gains `'convert' | 'convert-end' | 'save-minimize' | 'minimize-end'`.
  - `Step.part: 1 | 2 | 3 | 4` (4 = closing card); `Step.latch?: (ctx) => boolean`.
  - `PART_TITLES: Record<1 | 2 | 3, string>` with `3: 'Convert and minimize'`; `PART_GOALS: Record<1 | 2 | 3, Goal>`; `PART_DONE: Record<1 | 2, string>` replacing `PART1_DONE` (1: the existing text; 2: `'Your DFA accepts every word.'`).
  - `COUNTED_STEPS = 19`.
  - `PART3_NFA: Automaton`: the "contains 01" NFA (id `'tutorial-nfa'`, name unused): states `q_0` (x 0), `q_1` (x 150), `q_2` (x 300), all y 0; `starts: ['q_0']`, `accepting: ['q_2']`; transitions `q_0→q_0 [0,1]` and `q_2→q_2 [0,1]` with `loopAngle: -Math.PI / 2`, `q_0→q_1 [0]`, `q_1→q_2 [1]`; `alphabet: ['0','1']`, `kind: 'NFA'`. Ids: state ids equal labels.
  - `isPart3Trace(ctx): boolean`: a subset trace with `source.id === ctx.automaton?.id`, or a minimize trace with `source.id === ctx.derivedId`.

- [ ] **Step 1: Failing tests** (`steps.test.ts`, with a helper building contexts with an NFA-content tutorial automaton and synthetic traces built by `subsetConstruction(PART3_NFA-with-tutorial-id)` / `minimize(result)` from core):
  - `part 3 starts after part 2 with a hand-over`: progress at `run-10-again` latched, run trace still open → current step is `convert`, its hint `{ kind: 'part-done', part: 2 }`.
  - `convert latches when the tutorial's conversion opens`: subset trace of the tutorial automaton at step 0 → `advance` latches `convert`, current `convert-end`.
  - `convert-end latches at the last step`: same trace at its last index → current `save-minimize`.
  - `save-minimize latches on the minimization of the saved DFA`: `derivedId` = subset result id, active = derived id, minimize trace of it open → latched, current `minimize-end`; then at its last step → current `done` (part 4).
  - `part 3 never says elsewhere while its walkthrough is open`: active automaton is the derived DFA with its minimize trace open → `hint(ctx)` of `minimize-end` is not `elsewhere`; `advance` still moves.
  - `asks to convert again when the walkthrough is closed early`: `convert` latched, no trace open, current `convert-end` → hint `{ kind: 'first', text: 'First, press Convert to DFA again.' }`; for `minimize-end` with no trace → `'First, press Minimize again.'` when the derived DFA is active (Toolbar's Minimize label).
  - `the NFA's subset DFA has 4 states and minimizes to 3`: on `PART3_NFA`.
  - The existing length-cap and markup tests cover the new texts (extend their loops if they iterate over a fixed list).
- [ ] **Step 2:** Run `npx vitest run src/ui/tutorial/steps.test.ts`; fail.
- [ ] **Step 3:** Implement:
  - Part-3 specs (between `run-10-again` and `done`), texts:
    - `convert`: instruction `'Press Convert to DFA at the top.'`, why `'It builds a DFA that accepts the same words.'`, latch: subset trace with `source.id === automaton.id`, target `'button[aria-label="Convert to DFA"]'` (check the Toolbar's real accessible name and use it).
    - `convert-end`: `'Press Play, or step with [→], to the end.'`, why `'Each DFA state is a set of NFA states.'`, latch: that subset trace at `stepIndex === steps.length - 1`, target the player (`'[data-testid="dock"]'`).
    - `save-minimize`: `'Press Save and minimize.'`, why `'Two of its states do the same job.'`, latch: minimize trace with `source.id === ctx.derivedId`, target `'[data-testid="save-and-minimize"]'` (Task 8 adds that test id to the button).
    - `minimize-end`: `'Play the minimization to the end.'`, why `'It merges states that accept the same words.'`, latch: that minimize trace at its last step, target the dock.
  - `done` becomes part 4, instruction `'You built DFAs, ran them, and converted and minimized an NFA. Press [?] any time for all the controls.'` (check the length cap; shorten if needed).
  - `toStep`: `structural` excludes steps with `latch` and part 4; `hint` returns `elsewhere` only when `!ctx.isActive && !isPart3Trace(ctx)`; latch steps skip the "First, press [Esc]" branch; the "first" fallback for `convert-end` when no part-3 trace is open is `'First, press Convert to DFA again.'`, for `minimize-end` `'First, press Minimize again.'`; `nfaHint` applies to parts 1 and 2 only; `endsPart` / `part-done` works for prev part 1 or 2.
  - `advance`: the early return becomes `if ((!ctx.isActive && !isPart3Trace(ctx)) || !ctx.automaton)`; `isDone` treats `s.run || s.latch` as `held.has(s.id)`; an undone step latches when `runSucceeded(s, ctx) || s.latch?.(ctx)`.
  - `PART_GOALS[3]`: text `'Turn an NFA into a DFA, then make it as small as possible'`, examples `1011` ✓, `0010` ✓, `110` ✗, `0` ✗, automaton `PART3_NFA`, description `'The goal: an NFA with three states, q_0 (start), q_1 and q_2 (accepting), for the words that contain 01.'`. Generalise `picture()` only if reused; `PART3_NFA` can be a literal.
- [ ] **Step 4:** Rerun; pass. Then `npx vitest run src/ui/tutorial`; fix type fallout in `TutorialCard.tsx` minimally (part 3 → 4 comparisons) so it compiles; visual changes belong to Task 8.
- [ ] **Step 5:** Commit `feat(tutorial): part 3 steps: convert an NFA and minimize it`.

### Task 8: Tutorial part 3 in the store, card, welcome and e2e

**Files:**
- Modify: `src/ui/tutorial/tutorialStore.ts`, `src/ui/tutorial/TutorialCard.tsx`, `src/ui/tutorial/GoalPicture.tsx` (if it assumes a DFA or two states), `src/ui/tutorial/WelcomeCard.tsx` (PLAN row), `src/ui/player/traceExtraActions.tsx` (`data-testid="save-and-minimize"`), `e2e/tutorial.spec.ts`, `README.md` (Learn section)
- Test: `src/ui/tutorial/tutorialStore.test.ts`, `src/ui/tutorial/TutorialCard.test.tsx`

**Interfaces:**
- Consumes: Task 7's `PART3_NFA`, `TutorialContext.derivedId`, `PART_DONE`, `PART_TITLES[3]`, `PART_GOALS[3]`, part 4.
- Produces: `TutorialState.derivedId: string | null`, `TutorialState.nfaLoaded: boolean`.

- [ ] **Step 1: Failing tests.** `tutorialStore.test.ts`:
  - `loads the NFA when part 3 starts`: drive the store to `run-10-again` latched, close the trace → the tutorial automaton has `PART3_NFA`'s states/transitions/starts/accepting/kind (its own id and name kept), `nfaLoaded` true, and one undo step brings back the part-2 automaton.
  - `remembers the converted DFA`: open a subset trace of the tutorial automaton → `derivedId` equals the trace's `result.id`.
  - `finish closes the walkthrough`: at part 4 with the minimize trace open, `finishTutorial()` → trace null.
  - `TutorialCard.test.tsx`: `shows Part 2 complete! and names part 3` (hint part-done 2 → text `Part 2 complete!`, `Next: Part 3 · Convert and minimize`); `numbers part 3 steps` (`Part 3 of 3 · Step 1 of 4`).
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Implement:
  - `tutorialContext(app, automatonId, derivedId)` fills `derivedId`; `isActive` stays "the tutorial automaton is active".
  - `follow`: when a subset trace with `source.id === automatonId` is open, set `derivedId = trace.result.id`. When the current step is `convert`, `!nfaLoaded` and `app.trace === null` and the tutorial automaton is active: `appStore.getState().edit((a) => ({ ...PART3_NFA, id: a.id, name: a.name }))` (records one undo step), set `nfaLoaded`, then `requestAnimationFrame(fitActive)`.
  - `startTutorial` / closing-card checks: `part === 3` → `part === 4`. `finishTutorial`: close any open trace whose source is the tutorial automaton or `derivedId`.
  - `TutorialCard`: hand-over panel generic over part 1 | 2 (`Part {n} complete!`, `PART_DONE[n]`, `Next: Part {n+1} · {PART_TITLES[n+1]}`); "Part N of 3"; `GoalRow` accepts part 3. Keep test ids (`tutorial-part-done`, `tutorial-goal`).
  - `GoalPicture`: draw `PART3_NFA` correctly (three states, accepting ring on `q_2`, two loops); adjust its sizing if it assumed two states.
  - `WelcomeCard` PLAN: third row `{ what: 'Convert', how: 'an NFA to a DFA and shrink it' }`; old third row stays as is.
  - `README.md` Learn bullet: mention the third part.
- [ ] **Step 4:** Rerun; pass. `npm test` green.
- [ ] **Step 5: e2e.** Extend `e2e/tutorial.spec.ts` past part 2: press Esc at the hand-over, expect the goal `data-part="3"`, click Convert to DFA, wait for the subset view, jump to the last step (player's last-step button), click `save-and-minimize`, jump to the end, expect the closing card, click Finish, expect the FinishedCard. Run `npx playwright test e2e/tutorial.spec.ts`; pass.
- [ ] **Step 6:** Run `npm run dev` and walk part 3 by hand in the browser (Playwright screenshot script under `$CLAUDE_JOB_DIR/tmp` is fine): the card, pointer and goal picture look right in light and dark.
- [ ] **Step 7:** Commit `feat(tutorial): part 3 loads an NFA and walks through convert and minimize`.

### Task 9: Pan and zoom in walkthroughs

**Files:**
- Modify: `src/ui/player/useFittedViewport.ts`, `src/ui/player/SubsetTraceView.tsx`, `src/ui/player/MinimizeTraceView.tsx`, `src/ui/player/RunTraceView.tsx`, `src/ui/player/player.css`
- Create: `src/ui/player/useFittedViewport.test.tsx`, `src/ui/player/FitButton.tsx`
- Test: the three views' existing test files

**Interfaces:**
- Consumes: `zoomAt`, `fitToView` from `canvas/viewport.ts`; `FitIcon` from `shell/icons`.
- Produces: `useFittedViewport(states, opts?: { interactive?: boolean })` returns `{ ref, viewport, moved: boolean, fit: () => void, onPointerDown: (e: React.PointerEvent) => void }`; it registers its own non-passive `wheel` listener on `ref`; both do nothing when `interactive === false`; `FitButton({ onClick }: { onClick: () => void })` rendering `<button data-testid="trace-fit" aria-label="Fit" title="Fit to view">`.

- [ ] **Step 1: Failing tests** (`useFittedViewport.test.tsx`, a small test component putting `ref` and `onPointerDown` on a div):
  - `starts fitted`: viewport equals `fitToView(points, FALLBACK_SIZE)`; `moved` false.
  - `wheel zooms around the pointer and prevents default`: wheel `deltaY: -100` at (100, 50) → viewport equals `zoomAt(fitted, {x:100,y:50}, factor)` with the canvas's wheel factor (reuse the Canvas wheel factor constant; export it from where it lives if needed); `moved` true; the event's `defaultPrevented` true.
  - `drag pans`: pointerdown at (10,10), pointermove to (40,30), pointerup → x/y shifted by (30,20).
  - `Fit resets`: after a wheel, `fit()` → fitted again, `moved` false.
  - `re-fits when the states or size change`: rerender with other states → fitted to them, `moved` false.
  - View tests: `SubsetTraceView` shows no `trace-fit` initially and shows one after a wheel on a pane; clicking it hides it.
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Implement: keep the measured size and computed fitted viewport; store a user viewport plus the fitted target it was based on (`key = JSON of rounded fitted viewport`); when the target changes, drop the user viewport. Wheel must be a non-passive native listener (`addEventListener('wheel', h, { passive: false })` in an effect on `ref`) so `preventDefault` works (tests dispatch native wheel events). Pan uses pointer capture after 3 px, like the canvas. Views: render `<FitButton onClick={fit} />` in each pane when `moved`; `RunTraceView` passes `interactive: !ambient` so the welcome demo stays inert. CSS: `.av-trace-fit` absolutely positioned top-right of its pane, `cursor: grab` on `.av-trace-diagram` while interactive.
- [ ] **Step 4:** Rerun; pass. `npx playwright test e2e/trace-fit.spec.ts e2e/convert.spec.ts e2e/welcome-demo.spec.ts`; pass.
- [ ] **Step 5:** Commit `feat(player): pan and zoom in walkthrough views, with Fit`.

### Task 10: Phone welcome and mobile check

**Files:**
- Create: `src/ui/shell/touch.ts`, `e2e/phone.spec.ts`
- Modify: `src/ui/tutorial/WelcomeCard.tsx`, `src/ui/tutorial/tutorial.css`, plus whatever layout CSS the mobile check shows broken
- Test: `src/ui/tutorial/WelcomeCard.test.tsx`

**Interfaces:**
- Produces: `isTouchOnly(): boolean` = `matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches` (false when `matchMedia` is missing).

- [ ] **Step 1: Failing test.** `WelcomeCard.test.tsx`: `it('on a touch-only device offers Got it instead of the tutorial')`: mock `matchMedia` (coarse true, any-pointer fine false) → text contains `made for a computer with a mouse and keyboard`, a `Got it` button that calls `onClose`, no `Start tutorial` button, the demo (`welcome-demo` / existing test id) still present. And the desktop case unchanged.
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Implement: when `isTouchOnly()`, replace the "A short tutorial:" text, plan list and actions with `<p className="av-welcome-text">AutoMotion is made for a computer with a mouse and keyboard. On a phone you can open shared automata and run words on them.</p>` and one `av-go` button `Got it` (`onClose`). Note line stays.
- [ ] **Step 4:** Rerun; pass.
- [ ] **Step 5: e2e** `phone.spec.ts` with `test.use({ ...devices['iPhone 13'] })` (Chromium engine is fine: set `defaultBrowserType` not needed; `devices['iPhone 13']` sets viewport, touch and UA): first visit shows the phone welcome; Got it closes it. Then open a share link built in the test (encode via `page.evaluate` importing nothing: build the link in a desktop context first, as in Task 6's spec, or reuse a fixture payload generated in `beforeAll` with Node's `zlib.deflateRawSync`), expect the diagram visible within the viewport (state bounding boxes inside `page.viewportSize()`), type a word in the run box, press Enter, expect the verdict banner. Take a screenshot to `test-results/` and inspect it (Read tool) for overlapping top bar, run pill and player.
- [ ] **Step 6:** Fix any overlap or overflow the screenshot shows (CSS only, under a `max-width` media query already used by the app, or a new one at 480 px). Rerun the spec and the desktop e2e suite.
- [ ] **Step 7:** Commit `feat: phone welcome, and the app works for viewing and running on phones`.

### Task 11: Docs, full verification, PR

**Files:**
- Modify: `PROGRESS.md`, `CLAUDE.md` (architecture notes: `shareLink.ts` and `useSharedLink.ts` under persistence/shell, tutorial part 3 and latching steps, movable trace viewports, `isTouchOnly`), `README.md` (Keep your work: Copy link; Convert and minimize: pan/zoom)

- [ ] **Step 1:** Update the three docs. `PROGRESS.md`: all launch-prep items ticked under `### Launch prep (2026-11-14)`; remove the now-done Next items (tutorial part 3, subset walkthrough size, hardening); add follow-ups found during the work under Next.
- [ ] **Step 2:** Run `npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`; all green. `npx prettier --check` on every file touched in this branch.
- [ ] **Step 3:** Commit `docs: launch prep in PROGRESS, README and CLAUDE.md`; push the branch; open a draft PR to `master` summarising the parts, ending with the Claude Code attribution line.
