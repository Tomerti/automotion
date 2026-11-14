# Launch prep: design

Date: 2026-11-14. Status: approved in conversation, pending written review.

## Goal

Get AutoMotion ready to be shared publicly (a LinkedIn post, written later and out of scope here):
a good link preview, a license, no rough first impression on phones, a way to share an automaton
as a link, the tutorial reaching the walkthroughs, and walkthroughs that stay readable on larger
results. Then make the GitHub repo public once nothing sensitive is visible.

Decided with the user:

- Tutorial part 3 uses a ready-made NFA (not built by hand).
- Opening a shared link adds the automaton and opens it.
- No built-in examples (unchanged decision).
- The repo goes public only after a check that no secrets or sensitive data are visible, and the
  user signs off on what that check finds (including the personal email in commit metadata).

Out of scope: the post itself, touch editing, Regex → NFA, the other `PROGRESS.md` items
(Prettier/line endings, Web Worker layout, Ctrl+X/A, Shift + click, dotted zero).

## 1. Packaging

- `LICENSE`: MIT, "Copyright (c) 2026 Tomer Titinger". `package.json`: `"license": "MIT"`,
  `"version": "1.0.0"`.
- `index.html`: `og:type` (website), `og:site_name`, `og:title`, `og:description`, `og:url`
  (`https://tomerti.github.io/automotion/`), `og:image` (absolute:
  `https://tomerti.github.io/automotion/og.png`, with `og:image:width` 1200, `og:image:height`
  630, `og:image:alt`), `twitter:card` = `summary_large_image`. Title and description reuse the
  existing ones.
- `public/og.png` (1200×630): rendered from `docs/brand/og/og.html` (light theme: the lockup, the
  tagline "Watch automata come to life", and `docs/screenshots/run.png`) by
  `docs/brand/og/render.mjs`, which uses the Playwright already in devDependencies. Both are
  committed so the picture can be regenerated; `docs/brand/README.md` says how.
- Hardening:
  - `automatonSchema` rejects an accepting state id that is not a state ("Accepting state X is
    not a state"), like start states. Tested in `persistence.test.ts`.
  - PNG export (`exportDiagram.ts`): a 0×0 (or non-finite) size never reaches the canvas; an
    empty automaton still exports a small blank picture instead of throwing.
  - e2e: loops that poll `isEnabled()` use Playwright's waiting assertions instead.

## 2. Shareable links

### Format

`https://tomerti.github.io/automotion/#a=<payload>`, where `payload` is base64url (no padding)
of `deflate-raw` of the compact JSON of the file format holding one automaton:
`{ "format": "automotion", "version": 2, "automata": [a] }`, with `a.id` dropped (a fresh id is
given on load) and `x`, `y` rounded to integers. Compression is the browser's
`CompressionStream` / `DecompressionStream`, so no dependency is added. The link is built from
`location.origin + location.pathname`, so it works on the dev server and in preview too.

### Module

`src/persistence/shareLink.ts` (no React):

- `encodeShare(a: Automaton): Promise<string>`: the payload.
- `shareUrl(a, base: string): Promise<string>`: `${base}#a=${payload}`.
- `readShareHash(hash: string): string | null`: the payload of a `#a=` hash, else `null`.
- `decodeShare(payload, existingIds): Promise<ParseResult>`: inflate, then the same path as a
  file (`parseFile`: JSON, format check, `migrate()`, zod schema). Bad base64, bad deflate,
  bad JSON and schema errors all come back as `{ ok: false, error }`, never thrown. A missing id
  gets one before the schema runs.
- `sameAutomaton(a, b)`: equal content ignoring `id` (used to open an existing copy instead of
  adding a duplicate).

### UI

- **Copy link**: in the toolbar's "Copy or export" menu (after Copy LaTeX, copy icon) and in a
  history entry's ⋯ menu. Writes the URL with `navigator.clipboard.writeText`; toast
  "Link copied". Clipboard failure: error toast.
- **Opening**: `src/ui/shell/useSharedLink.ts`, used once in `App`. On mount (after the store
  has loaded saved work) and on `hashchange`, if `readShareHash(location.hash)` gives a payload:
  decode; on success, if a saved automaton is `sameAutomaton`, select it, otherwise add it (the
  store's add: front of history, opened, trace closed); fit it; toast "Opened «name»". On
  failure: error toast "This link's automaton couldn't be read". Either way the hash is removed
  with `history.replaceState` (keeping path and query), so a reload doesn't add it again.
- A visit that opens a shared link doesn't show the welcome dialog, and doesn't mark it seen,
  so the next plain visit still shows it. (`useWelcome` takes the "arrived by link" flag, read
  synchronously from `location.hash` at startup.)
- An active tutorial is left alone: the shared automaton opens, and the tutorial card shows its
  usual "elsewhere" state.

### Tests

Unit (`shareLink.test.ts`): round trip (DFA, NFA with ε and several starts, bends, loop angles,
label sides, subscripts, non-ASCII labels), id dropped and positions rounded, corrupt payloads
(not base64, not deflate, not JSON, wrong format, schema error) → `ok: false`,
`readShareHash`. Component: Copy link writes a URL that decodes back to the automaton. e2e
(`share-link.spec.ts`): copy a link (clipboard permission), open it in a fresh context: the
automaton is open, no welcome dialog, the URL has no hash; reload adds nothing; opening the same
link again in that context opens the existing one; a broken link shows the error toast.

## 3. Tutorial part 3: Convert and minimize

- Part 2's last run (`run-10-again`) ends on the green hand-over panel ("Part 2 complete!",
  naming part 3), like part 1's; Esc starts part 3.
- Starting part 3 replaces the tutorial automaton's content with a ready-made NFA (one
  checkpoint, so undo works) and fits the view: **contains `01`**: states `q_0` (start), `q_1`,
  `q_2` (accepting); `q_0` loops on `0, 1`, `q_0 –0→ q_1`, `q_1 –1→ q_2`, `q_2` loops on `0, 1`;
  laid out in a row. Its subset construction gives 4 DFA states, minimization 3 (the two
  accepting subsets merge), so both walkthroughs show something. "Ends in 01" was rejected: its
  DFA is already minimal.
- Goal (`PART_GOALS[3]`): "Turn an NFA into a DFA, then make it as small as possible"; examples
  `1011` ✓, `0010` ✓, `110` ✗, `0` ✗; the NFA as the goal picture.
- Steps (texts follow the existing markup and length caps):
  1. `convert`: press Convert to DFA (pointer: the toolbar button). Done when a subset trace of
     the tutorial automaton is open.
  2. `convert-end`: play or step to the end (pointer: the player). Latched when that trace
     reaches its last step.
  3. `save-minimize`: press Save and minimize (pointer: that button). Done when a minimize trace
     is open whose source came from the tutorial's conversion.
  4. `minimize-end`: play to the end. Latched at the minimize trace's last step.
  5. `done`: the closing card (Finish), as today.
- Save and minimize opens a new automaton (the DFA). Part 3's steps therefore look at the open
  trace rather than requiring the tutorial automaton to be active: the "elsewhere" hint is not
  shown for those steps while a subset/minimize trace that belongs to the tutorial is open.
  `tutorialStore` records the id of the DFA saved during part 3 to recognise its minimize trace.
  Closing a walkthrough early falls back to the right step, as other steps do.
- `Step.part` becomes `1 | 2 | 3 | 4` (4 is the closing card), `PART_TITLES[3]` = "Convert and
  minimize", `COUNTED_STEPS` grows by 4, the header reads "Part 3 of 3 · Step n of 4".
- The welcome's plan gets a third row ("Convert an NFA to a DFA and shrink it"), replacing
  nothing; the README's Learn section mentions part 3.
- Tests: `steps.test.ts` (each step's `done`, fallbacks, latching, hand-over), `tutorialStore`
  (loading the NFA, recognising the saved DFA), and the existing tutorial e2e extended to the end.

## 4. Pan and zoom in walkthroughs

- `useFittedViewport(states)` becomes a viewport that starts fitted and can be moved: wheel
  zooms around the pointer and dragging the empty diagram pans, with the canvas's math from
  `viewport.ts` (same zoom limits). It returns `{ ref, viewport, moved, fit, handlers }`.
- It goes back to fitted when the fitted target changes (other states or another pane size),
  and the user's view is kept as long as it doesn't.
- Each walkthrough pane (Convert's two, Minimize's, Run's diagram) shows a small **Fit** button
  in its corner once `moved`; it resets the view. Not shown in the welcome demo (`ambient`).
- Tests: hook tests (wheel zooms around the pointer, drag pans, Fit resets, a new fitted target
  resets), and the views render the button only after moving.

## 5. Phones

- `isTouchOnly()` (`matchMedia('(pointer: coarse)')` and not `(any-pointer: fine)`).
- On a touch-only device the welcome keeps the demo and theme switch, replaces the tutorial plan
  with one line: AutoMotion is made for a computer with a mouse and keyboard; on a phone you can
  open shared automata and run words on them. Its one button is **Got it**. It is marked seen the
  same way.
- Checked in Playwright's iPhone emulation (an e2e spec using a mobile project or
  `devices['iPhone 13']` for that spec): the welcome's phone variant, a shared link opens, a word
  runs to its verdict. Layout breakage found there (top bar, run pill, player) is fixed as part
  of this work.

## 6. Go public

1. Scan the whole history for secrets: key and token patterns, `.env`-like files, private keys,
   absolute local paths, and read the committed docs, plans, specs and screenshots for anything
   personal.
2. Report to the user, including that 166 commits carry the personal Gmail address as author
   email (visible in a public repo; changing it would rewrite pushed history, which only the
   user can decide).
3. Only after the user's sign-off: `gh repo edit --visibility public` and topics (automata, dfa,
   nfa, finite-automata, education, tikz, react, typescript). The `v1.0.0` tag and release come
   after the PR is merged.

## Delivery

One branch, `worktree-launch-prep`, one draft PR to `master`. `PROGRESS.md` gets each item
ticked under a "Launch prep" heading, and follow-ups added under Next.
