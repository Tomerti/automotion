# Progress

Legend: `[ ]` to do · `[~]` in progress · `[x]` done

## Current

Nothing in progress: pick the next task from the list below.

## Next

- [ ] Lesson: Arrange (box select, Ctrl+click, move together, copy and paste, Tidy)
- [ ] Space doesn't play or pause right after Convert to DFA or Minimize is clicked: focus stays on that toolbar button, so Space presses it again (the player leaves Space on a focused button alone). Move focus off it when a walkthrough opens, then the lessons can say "Press Play, or [Space]" again

## Ideas (later)

- [ ] Regex → NFA
- [ ] Lessons for regex → NFA, TMs, and checking an automaton against a language, as those features land

## Done

### Convert lesson waits on {q_0} (2026-11-16)

- [x] The Convert lesson's walkthrough opens paused on «{q_0}» (`pausedConvert`) instead of playing on to «{q_0,q_1}»: opening it completes the Convert step, and the next card says to press [→] to follow `0`, then Play

### Lessons (2026-11-15)

- [x] The tutorial is a lesson engine (`ui/tutorial/engine.ts`, `lessons/`; `steps.ts` is gone): a step completes by a check, a run at its verdict, a latch or a reported action. Basics is the old tutorial, unchanged
- [x] Five one-minute lessons: NFAs, ε-moves, Convert NFA → DFA, Minimize a DFA, Share and export. Each opens a read-only copy of a ready-made automaton; automata saved from them belong to the lesson (Quit removes them, Finish keeps them)
- [x] Read-only automata (`readOnly` in the store): layout moves, Tidy and runs work; structural edits, undo into structure, cut and paste are refused (`sameStructure`), counted in `blockedEdits`, and the card says it's read-only
- [x] Controls (?) has a Lessons tab with ✓ for finished lessons (`automotion:lessons-done`); the finish popup offers "Next: …"; starting another lesson midway asks first
- [x] The pointer draws over the top bar for toolbar buttons, with a tight frame on buttons
- [x] `lessons/index.test.ts` caps every lesson's text: instructions 100 characters, why lines 110 (70 for Basics)
- [x] Walkthroughs pause where a step explains (`pauseAt`, `TracePlayer` `stopAt`, `lessonStopAt`); Convert opens paused on 1 and stops at 2 and 5 of 10, Minimize opens paused and stops at 2 of 3
- [x] Lessons rework (`2026-11-15-lessons-flow-design.md`): idea steps with a Next button, a step's `explain` shown before its instruction, and goal pictures and word-box/dock frames only in Basics
- [x] NFAs is stepped by hand on `001` and the new ε-moves lesson on `b`, then `ba` plays (`pausedRuns`, `lessons/handStep.ts`)
- [x] The Controls header Lessons button is gone: the Lessons tab is the only way in
- [x] `e2e/lessons.spec.ts` covers the idea steps, hand-stepped NFA and ε runs, the Convert and Minimize stops, and Convert pressed before Next

### Theme switch without a blink (2026-11-15)

- [x] Switching between light and dark recolours everything in the same frame. Buttons (120 ms), tape cells and diagram states and arrows (200 ms) fade their colours for hover and runs, and a theme switch reused that fade: on going dark, white buttons, tape cells and states stayed on the already dark page for ~4 frames, a white blink (the reverse, dark on light, going light). `applyTheme` now flips `data-theme` under `.av-theme-switching` (`transition: none` on everything), forces a style flush and drops the class. e2e reads the colours two frames after the switch and checks they are already the settled ones

### Compact Tidy (2026-11-15)

- [x] Tidy no longer spreads a dense automaton along a diagonal: `3rd from end → DFA` comes out as a 4 × 2 grid (was 4 × 4 with half the cells empty), nothing crossing or running through a state. The grid search judged layouts with automatic bends, so a compact grid, whose arrows must curve around a state in between, looked far worse than it reads (132.9 against 43.9 once bent) and the search ran from it; a compactness term in that search couldn't help
- [x] The grid result and every candidate are also packed into compact rectangles (`grid.ts` `compactSeeds`, keeping their order by columns or rows) and the best two refined inside their bounding box, scored with the arrows through a state bent around it (`bendClearOfStates`, as `assignBends` would, but only for those arrows). The rectangles are only starting points: the search moves states out of them, so no shape is forced
- [x] Empty space costs twice as much (`W_AREA` 0.4 → 0.8): besides `3rd from end`, `Divisible by 5` becomes a 3 × 2 grid with every arrow at a clean angle (was a skewed diamond) and `Length mod 5` a 3 × 2 loop; the rows, circles and other grids stay. A layout test checks `3rd from end` wastes at most a cell, whatever its shape

### Polish batch (2026-11-15)

- [x] Line endings: `.gitattributes` pins LF (`* text=auto eol=lf`), Prettier's `endOfLine` is `lf`, and CI runs `npm run format:check` (`prettier --check .`); a Windows checkout with `core.autocrlf` now checks clean. An existing checkout renormalizes once with `git rm -rq --cached . && git reset --hard`
- [x] The issues chip is grey, not red, on the tutorial's automaton while the tutorial runs: halfway through building, the incomplete DFA is expected
- [x] Phones: toasts sit under the DFA/NFA switch instead of over it (placed from the body under the top bar, so a wrapped top bar doesn't matter; e2e checks the boxes); every `:hover` style is inside `@media (hover: hover)`, so taps don't leave highlights stuck; `useTouchOnly()` follows the pointer media queries, so attaching a mouse while the welcome is open switches it to the tutorial offer
- [x] Cut then paste is a move: the first paste of a cut into the automaton it came from restores the arrows into the cut states from the states left behind (on a DFA without the symbols their source reads elsewhere by then); later pastes are copies
- [x] Tidy and the subset walkthrough's layout run in a Web Worker (`layout/layoutClient.ts`), so a 64-state layout no longer freezes the page; it falls back to the page where workers fail
- [x] Tidy also tries a grid for parts of up to 10 states (`layout/grid.ts`: the best candidate snapped to a grid, then improved by moving or swapping states), used when it beats the other candidates by 10%: `To minimize` now comes out as a crossing-free grid with straight arrows (33.4 → 24.8), `3rd from end → DFA` loses its crossings and arrows through states (84 → 46.7); `Contains 101` and the other near ties keep their rows and circles

### Dotted zero for input symbols (2026-11-15)

- [x] The run tape, the word typed in "Test a word…" (its placeholder stays in Geist), edge labels and the symbol input are set in IBM Plex Mono (`--av-font-symbol`), like the tutorial's words to type: Geist's 0 read as O there (`100100` looked like `1OO1OO`), a slashed 0 would read as ∅. Its stack falls back to Geist, which draws ε (Plex Mono has no Greek). State names and prose stay in Geist (e2e `symbol-font.spec.ts`)
- [x] Editing an arrow's symbols opens them as drawn, `0,1`, not `0, 1`: in the monospace a space after the comma is a whole character wide, so the input opened twice as spread out as the label
- [x] Exported and copied pictures embed IBM Plex Mono 500 for the edge labels' characters next to Geist (`embedFont.ts`), so an export doesn't fall back to a system monospace (Consolas' slashed 0)
- [x] Edge labels clear their arrow however wide they are: a label's centre sits a clearance beyond the curve plus its own half-extent (9 px a character), so `0,1` beside a vertical arrow or a sideways self-loop no longer reaches back over the line; one symbol sits 14 px out every way, as before. The layout's label boxes use the same exact width (was 8.5 px, Geist's average)

### Cut and select all (2026-11-15)

- [x] Ctrl+X (⌘X) cuts the selected states: copies them, then deletes them and the selected arrows in one undo step (`store.cutSelection`); Cut / Cut N states in the right-click menus too. The first paste without a place (the pointer off the canvas) puts them back where they were; with the pointer over the canvas it lands there, as after a copy. Only arrows selected, typing, selected text or an open trace leave Ctrl+X to the browser
- [x] Ctrl+A (⌘A) selects every state and arrow of the open automaton and gives the canvas the keyboard, so Delete, Ctrl+X, S or A act on it next. In the history bar (focus there, or the pointer over it) it still picks every automaton: that listener runs in the capture phase, ahead of the canvas's. Both work on non-Latin layouts
- [x] The Controls guide's Keys tab lists Ctrl+X, and Ctrl+A on "canvas or history bar"
- [x] Shift + drag from a state still draws an arrow inside a multi-selection (after Ctrl+A too): Shift picks drawing before moving the selection (e2e checks it). Shift + click won't become a multi-select alternative, since Shift is the arrow gesture; Mac users multi-select with ⌘-click

### Shortcuts on any layout, share-link cap (2026-11-15)

- [x] Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (undo, redo), the canvas's Ctrl+C / Ctrl+V (copy and paste states), Toolbar's Ctrl+C (copy image) and the plain S / A keys (start, accepting) work on a Hebrew or other non-Latin layout: they go through `shell/shortcut.ts` like the history bar's Ctrl+A / Ctrl+C, reading the physical key when the layout types `ז`, `ב`, `ד`, … Undo and redo ignore Ctrl+Alt (AltGr on Windows)
- [x] `shortcutLetter` falls back to the physical key only for letters of another script, not punctuation, so Dvorak's Ctrl+; (on the Z key) doesn't undo and Ctrl+. (on the V key) doesn't paste
- [x] Share links stop inflating past `MAX_SHARE_BYTES` (2 MB of JSON, far above any real automaton): a crafted link of a few KB that deflates to gigabytes says "This link is too large to open" instead of exhausting memory

### Delete several automata (2026-11-15)

- [x] Ctrl+click (⌘-click) in the history bar picks several entries without opening them, starting from the open automaton as in a file explorer (Ctrl+click a picked one to take it out); picked entries are tinted orange. Delete or Backspace then deletes them all after one confirm (`Delete 3 automata?`, listing their names). A plain click, Escape or a click outside the list drops the selection; Ctrl+double-click doesn't rename. The Controls guide's Delete row says so
- [x] Ctrl+A (⌘A) on a focused history entry picks every automaton, so Delete clears the whole history (a blank "Untitled" takes its place); in the rename field it still selects the text. Listed in the Controls guide's Keys tab
- [x] Deleting asks in the app's own dialog instead of the browser's `window.confirm` ("tomerti.github.io says"): `askConfirm()` (`ui/shell/confirmStore.ts`) and `ConfirmDialog.tsx`, mounted once in `App`. Its heading asks (`Delete "Parity"?`, `Delete 3 automata?` with the names listed, cut short past six), "This can’t be undone.", Cancel and a red **Delete** (`.av-danger`); Enter confirms, Escape or the backdrop cancels and focus goes back to the entry. Cancel keeps a Ctrl+click selection. The dialog itself takes the focus, not the Delete button: a button focused right after the Delete key showed the blue keyboard focus ring
- [x] Ctrl+A works over the history bar's empty space too (a window listener: focus in the bar, or the pointer over it; clicking the empty space focuses nothing, so it only worked after clicking an entry), then focuses the open entry so Delete deletes them. The bar's Ctrl+A and Ctrl+C read the physical key when the layout's letter isn't Latin (`shortcut.ts` `isCtrlLetter`: a Hebrew layout reports Ctrl+A as `ש`)

### Share menu (2026-11-15)

- [x] The top bar's share-icon menu ("Share, copy or export") is grouped by what each item does: **Share link** (renamed from Copy link, with a link icon) on its own at the top, then Copy image and Copy LaTeX, then Export SVG, Export PNG and Export LaTeX; copies and downloads used to be mixed in two groups split by format. Each history entry's ⋯ menu says Share link too, set apart from Rename / Duplicate by a separator

### Minimize labels (2026-11-15)

- [x] A minimized automaton names each merged state by its block (A, B, …, as in the walkthrough's legend and explanations; `resultLabels` in `core/minimize.ts`) instead of its joined member labels, which spilled out of the circle over the arrows after a subset construction (`{{q_0,q_2},{q_0,q_1,q_2}}`). Both the done step and Save as new automaton use these names; the legend says what each block merged. States that weren't merged keep their name, unless one reads as a block name, then every state takes its block's name
- [x] Block names go on past Z as AA, AB, …, like spreadsheet columns (`blockName`); the 27th block was `[`
- [x] A merged state remembers what it stands for (`State.mergedFrom`, the member labels; optional in the file schema, so no version bump): hovering it shows `A = {q₀, q₁, q₂}` (a native tooltip, Unicode subscripts, left out of SVG/PNG exports), on the walkthrough's done step and on the saved automaton. Kept through renames, copy and paste, share links, JSON and minimizing again; a state renamed only to dodge a clash says its old label. Export LaTeX writes `% AutoMotion merged: A = {q_0, q_1, q_2}` before the node, and import reads it back

### Phone welcome notice (2026-11-15)

- [x] The phone welcome's "made for a mouse and keyboard" note is an amber callout right under the tagline, above the demo: a laptop icon, a bold "Open this on a computer" headline, and "On a phone you can only open shared automata and run words on them", so it is read before **Got it** is tapped (it was muted text under the theme switch)
- [x] Its body is a checklist instead of two run-on sentences (the second started at the end of a line on phones): "AutoMotion is made for a mouse and keyboard. On a phone you can:" ✓ Open shared automata, ✓ Run words on them, ✗ Build or edit automata (muted). Picked from a page of mocked wording and colour options; the amber stays

### Tidy again (2026-11-15)

- [x] Tidy on an already tidy automaton only fits the view: no undo entry and no edit (it used to add an undo step each press, undoing to the same picture, and move the automaton to the top of the history); a layout test checks that laying out a laid-out sample changes nothing

### v1.0.0 (2026-11-14)

- [x] Tagged `v1.0.0` on master at the README refresh's merge (PR #52; the app is as launch prep's merge, e51ab17, left it) and published the GitHub release, with notes from PR #50 and #52

### README refresh (2026-11-14)

- [x] README rewritten for the public repo, and kept short: tagline, the run as the hero image, get started in three steps, five feature sections of at most four bullets (convert and minimize together, their screenshots side by side), good to know, development. Every control is left to the in-app guide (**?**)
- [x] The README's hero is an animated GIF of a run (`docs/screenshots/run.gif`, 50 fps, ~730 KB, history bar closed so the run sits centred), recorded and encoded by `docs/screenshots/take-gif.mjs` with no dependencies beyond Playwright; "Try it without drawing" share links open an NFA and a DFA in the app
- [x] Screenshots retaken by `docs/screenshots/take.mjs` from `scenes.json`: the whole app for the run, and the tutorial, convert and minimize framed without the history bar or top bar; `public/og.png` re-rendered from the new `run.png`
- [x] One logo orange, `#f76707` (the app's run highlighter), in both themes: the dark mark, lockup and favicon lose the old `#ff922b`, and "Motion" matches the loop in both lockups (it was `#d9480f`); `docs/brand/render.mjs` re-renders the lockup PNGs

### Launch prep (2026-11-14)

- [x] MIT license (LICENSE, mentioned in the README), version 1.0.0, and Open Graph / Twitter link-preview tags in `index.html`
- [x] 1200 × 630 link-preview image `public/og.png`, rendered from `docs/brand/og/og.html` by `docs/brand/og/render.mjs`
- [x] Review hardening: the file schema rejects accepting ids that aren't states, `svgToPng` rejects a sizeless SVG, and the multi-start e2e no longer branches on `isEnabled()`
- [x] Share-link encoding (`persistence/shareLink.ts`): `encodeShare` / `decodeShare` / `shareUrl` / `readShareHash` / `sameAutomaton` put one automaton in a `#a=` URL payload (deflate-raw, base64url)
- [x] "Copy link" in the toolbar's export menu and each history entry's ⋯ menu copies a share link (`ui/shell/copyLink.ts`)
- [x] Opening a share link (`#a=`, `ui/shell/useSharedLink.ts`) on load and on `hashchange`: opens the saved copy or adds the automaton, fits it, toasts, clears the hash; no welcome dialog on such a visit
- [x] Pan and zoom in the walkthrough views (`useFittedViewport` returns `moved` / `fit` / `onPointerDown` and owns a non-passive wheel listener): the wheel zooms around the pointer, dragging pans, a Fit button (`player/FitButton.tsx`, `trace-fit`) shows once moved, the fitted view returns when the fitted target changes; the welcome demo (`ambient`) stays inert
- [x] Tutorial part 3 (convert an NFA, then minimize the DFA) was built and then dropped: the tutorial stays at two parts. Kept from it: the goal picture draws subscripts (`LabelSpans`), the canvas's fit keeps clear of the tutorial card, and Save and minimize's `save-and-minimize` test id
- [x] Phone welcome: on a touch-only device (`ui/shell/touch.ts` `isTouchOnly`) the welcome keeps the demo and theme switch, says AutoMotion is made for a mouse and keyboard, and has one **Got it** button; an iPhone 13 e2e (`e2e/phone.spec.ts`) covers the welcome, opening a share link and running a word; toasts sit under the top bar on phones (≤ 480 px) instead of over the player
- [x] Final-review fixes: the autosave load drops dangling start/accepting ids instead of losing the whole list (`toggleAccepting` ignores non-states), walkthrough zoom survives height-only pane changes, the first-show fit keeps clear of the tutorial card, a link visitor's lone blank "Untitled" makes way for the shared automaton, no "Press ?" note on phones
- [x] The GitHub repo is public, with the topics automata, dfa, nfa, finite-automata, education, tikz, react and typescript

### Discoverability (2026-11-11)

- [x] The empty canvas also says Ctrl+V pastes an automaton’s LaTeX (TikZ) code and that .json / .tex files can be
      dropped; dropping a .tex file imports it (only .json did)
- [x] Import is a menu: Import file… or Paste LaTeX… (a dialog to paste TikZ into, which also
      teaches Ctrl+V on the canvas); errors stay in the dialog
- [x] Save and minimize at the end of Convert to DFA; disabled reasons say what to do
      ("Minimization needs a DFA: use Convert to DFA first", "Already a DFA: …"); the
      toolbar keeps the Convert to DFA / Minimize labels down to 900 px (was 1080 px)

### Feedback fixes (2026-11-03)

- [x] Tutorial renames need the exact name (`even`, `odd`, `any`; capitals and spaces around it
      aside): a typo like `evem` no longer passes, and a red hint says «evem» should be named
      `even`. Renaming a state wrongly later sends part 1 back to its name step. Part 2's last
      rename no longer takes any name of one's own
- [x] State labels are centred on the body of their letters instead of the font's em box: `q₀`
      sat ~3 px low, `even` 2 px (canvas, exports and the tutorial's goal pictures). Descenders
      and subscripts hang below and don't count (centring all the ink left `any` high, and a
      subscript shifted its `q` up), so `q₀`, `any` and `even` all sit at the same height
- [x] Drawing an arrow that already exists (Shift + drag onto the same pair, or the same loop)
      edits that arrow in place: its label turns into the input, reading `0, ` with the caret at
      the end, instead of a second input on top of it
- [x] The top bar's export button has a share icon (not a download arrow) and is named "Copy or
      export"; its menu items show a copy or download icon each, and Copy image shows Ctrl+C

### Tidy

- [x] Tidy lays automata out the way they are drawn by hand instead of ELK's layered layout alone (which staggered states and ran arrows back straight through other states): it tries a row, a circle, ELK layered variants and a stress layout per connected part, bends each arrow clear of the states, points start arrows into free space, and keeps the candidate that reads best on the curves the canvas actually draws (crossings, arrows through states, overlapping labels, bunched arrows, left-to-right flow, size)
- [x] Tidy also resets hand-made bends, loop and start arrow directions and label sides that no longer fit, in the same undo step; separate parts are stacked, the start state's first
- [x] `geometry.ts` moved to `core/` so the layout can score with the canvas's own curves
- [x] 64 states (the subset construction maximum) lay out in about a second; small automata in about 0.1 s

### Issues

- [x] The issues popover lays each message out as one line of text: a label's subscript (q₀) no longer floats apart from its letter, and the row no longer wraps in pieces
- [x] An incomplete DFA is one issue per incomplete state, naming all its missing symbols ("q₀ needs transitions on '0' and '1'"), instead of the first gap plus "(and N more)"; clicking one selects the state
- [x] While the issues popover is open, every state an issue is about gets a pulsing dashed ring in the issue's color (red for errors, amber for warnings), so it is easy to find on the canvas; closed, the canvas stays clean (an incomplete DFA is normal mid-build). Never exported

### LaTeX

- [x] Export LaTeX (an entry's ⋯ menu, and the toolbar's export menu) downloads a standalone `.tex` document: the diagram as a TikZ picture (`automata` library) laid out as on the canvas, 50 px to the cm, with start arrow and loop directions and bends; diagonal start arrows, which `initial where` can't place, are plain `\draw[<-]` arrows
- [x] Copy LaTeX (toolbar export menu) puts just the `tikzpicture` on the clipboard, after a comment naming the libraries it needs
- [x] Import… takes `.tex` files: every `tikzpicture` with states becomes an automaton. Reads hand-written TikZ too: nodes `at (x,y)`, by `right=of q0` / `right of=q0` or inside a path; `edge`, `to` and `--`; `loop above`, `bend left=45`, `in`/`out`; `initial` or an arrow drawn into a state; ε as `\varepsilon` / `\epsilon`; symbols comma-separated
- [x] A `% AutoMotion NFA: name` comment before each exported picture keeps the name and kind on the way back; otherwise the name comes from the file and the kind from the transitions (a DFA when deterministic)
- [x] An arrow's label side (`labelSide`) survives LaTeX both ways: export writes `swap` when the label is on the right of from→to (`auto` puts it on the left); import reads `swap` / `'` on the edge or its label, `auto=right`, and labels placed by hand (`node[below]`), keeping `labelSide` only where it differs from the automatic side
- [x] Export all is a menu: Export all as JSON, or Export all as LaTeX (one standalone `.tex`, a `tikzpicture` and page per automaton with states, importing back as every one of them)
- [x] Ctrl+V with TikZ on the clipboard (copied from Overleaf, notes, …) adds the automata it draws, like Import. The app's own copy still pastes while the window has kept the focus since it was made; once it lost the focus, the paste event looks for LaTeX first (`pasteLatex.ts`)
- [x] CI compiles the exported LaTeX: e2e `latex-samples.spec.ts` exports through the app (every writer feature, and Export all), and the `latex` job runs pdflatex on each file before deploy

### Equal spacing

- [x] A dragged state on a row of states (snapped to their y) also snaps along it to equal gaps: one existing gap past either end, or halfway between two states (where it fits); columns likewise. The nearer of an equal gap and a column alignment wins, Alt skips both
- [x] Each equal gap gets a marker: a pink dimension line with end ticks just under the row (beside a column), on every gap in the row that matches the dragged state's; never exported

### Arrow labels

- [x] An arrow's symbols can go on either side of it: drag them across the arrow (they snap to the side the pointer is on, one undo step; dragging the line still bends it), or right-click the arrow → Label on other side. On a curve the other side is inside it. Stored as `labelSide` (left / right of from→to), so the label stays put when the arrow is bent or its states move; self-loops keep theirs outside

### Copy and paste

- [x] Select several states: Ctrl + drag on the empty canvas draws a selection box, Ctrl + click adds or removes a state (or arrow); the arrows between selected states are selected too
- [x] Dragging a selected state moves the whole selection (one undo step), snapping to the other states
- [x] Ctrl+C / Ctrl+V copy and paste the selected states with the arrows between them and their arrows to outside states (arrows into the chain are not copied); the paste lands at the pointer, or a step off the original, and is selected
- [x] Pasted names keep their label when free, otherwise gain primes (q_1 → q_1'); accepting is copied, start is not; pasting into another automaton drops arrows to states it lacks, and ε-arrows turn a DFA into an NFA
- [x] Ctrl+C copies the selected states when there are any, and the diagram as a picture (Copy image) when there are none
- [x] Right-click: Copy on a state, Copy / Delete N states on a multi-selection, Paste on the empty canvas
- [x] Ctrl+C on a history entry copies that automaton (a snapshot, with its view); Ctrl+V adds a copy of it, named and opened like Duplicate. Ctrl+V pastes whatever was copied last, states or an automaton
- [x] Controls popup: as tall as the open tab (its top stays put when switching), not the tallest one; the Keys tab lists each key once (Ctrl+C and Delete cover history entries too)

### Theme

- [x] The theme follows the system (light or dark, switching live when the system does) unless the theme menu in the top bar forces Light or Dark; System is the default and the choice is remembered
- [x] The welcome dialog has its own System / Light / Dark switch under the demo (`ThemeSwitch.tsx`); it and the theme menu show the same choice (`useThemePref`)
- [x] The run's orange (Run, Start tutorial, Finish, selection) is the light theme's `#d9480f` with white text in dark mode too, instead of a paler orange with dark text
- [x] The run's highlighter (token, halo, taken edges, active states, the tape's read cell) is light mode's `#f76707` / `#d9480f` in dark mode too; only its tints stay dark, the read cell's a little darker so its letter keeps light mode's contrast

### Copy image

- [x] Copy image (first item of the image menu) and Ctrl+C put the diagram on the clipboard as a PNG, to paste straight into a document or chat; Ctrl+C leaves text selections and fields alone
- [x] The copied picture is the downloaded PNG, and neither depends on the canvas's zoom or pan or on display scaling: the whole automaton at a fixed 2× (`PNG_SCALE`), checked pixel for pixel by e2e `copy-image.spec.ts`
- [x] Exported and copied pictures set their labels in Geist, like the canvas, instead of the system font (Segoe UI on Windows): a standalone SVG can't reach the page's web fonts, so `embedFont.ts` embeds Geist 500, cut down by Google Fonts (`text=`) to the characters drawn (2 to 3 KB), as a base64 `@font-face`; offline it falls back to the system font

### Tutorial

- [x] Clearer tutorial (feedback: people didn't know what they were building, and the steps
      confused them): a goal row for each part (a picture of the finished automaton, the goal in
      a few words, example words with ✓ / ✗); the states are named `even` and `odd`, so each step
      can say why in a few words; state names show as small states in the text, and a key's "."
      no longer wraps on its own
- [x] Shorter tutorial with less text: the card sits at the top centre under the DFA/NFA switch
      (runs start below it); one short instruction plus a few muted words of why per step, and a
      progress bar instead of the list of ticked steps; 15 steps (adding and naming the second
      state in one); a larger goal; "rename it `even`" rather than "type"; S and A are their own
      steps, each saying what the key does and what it draws (the arrow, the double ring); part 1 ends on a green "Part 1
      complete!" panel naming part 2, the header numbers steps per part ("Part 2 of 2 · Step 1 of
      4") and part 2's goal flashes in; part 2 ends by renaming the state `any`
- [x] Interactive tutorial: build the "even number of 0s" DFA, run `1010` and `10`, then delete q1 and loop q0 on `0,1` to accept every word
- [x] Coach card in the canvas corner: step counter, keys inline, hints for common mistakes, ✓ for the last step; checks the automaton live and falls back when a step comes undone
- [x] Pointer ring on the state, loop label or word box a step uses
- [x] A first visit opens a welcome dialog offering the tutorial (instead of the Controls popup); Controls has Take / Restart tutorial
- [x] The tutorial works on its own "Tutorial" automaton (reusing an empty one), which stays in history
- [x] UI pass: the welcome is Controls-sized and styled, with the "Watch automata come to life" tagline and an orange Start tutorial pill like Run
- [x] The welcome shows a live demo under the tagline: the "ends in 01" NFA running random words forever with the run view's animation (silent, no controls, no verdict banner)
- [x] The coach card is a checklist: each step done gets a green ✓ and the next one appears on a new line; a finished part folds into one ticked line
- [x] The pointer is orange corner brackets instead of a blue ring (which looked like an accepting state)
- [x] X midway asks before quitting, and quitting (or restarting) removes the unfinished Tutorial automaton from history; Finish keeps it

### Fixes

- [x] The ε shortcut is `\eps` instead of `\epsilon` (in symbols and in the word box); the
      Controls popup, run box tooltip and README say so
- [x] State labels stuttered on every run step at 125%/150% display scaling: the taken edge label's pop was a transform animation on SVG text, which made Chrome redraw the diagram soft and shifted while it ran; it pops by font size now (e2e `welcome-demo.spec.ts` checks at 1.5×)
- [x] At 100% too, with GPU raster (seen on Windows Chrome), each state's `q` hopped 1 px up and down on every run step (subscripts held still): hinting put its baseline on a different pixel row on different repaints. Diagram text is unhinted now (`text-rendering: geometricPrecision`); Playwright's bundled Chromium doesn't show it, so it was measured from screencast frames in real Chrome
- [x] A 0 in the tutorial's words and on the run tape read as ∅ (Geist Mono's slashed zero): both are set in Geist now, and Geist Mono is no longer loaded
- [x] The tutorial's pointer on a run step frames the whole run pill, Run button included, not just the word box
- [x] Finishing the tutorial (Finish, or X on the closing card) also closes its last run, back to editing
- [x] The welcome dialog is centred on the canvas, in line with the run pill, and covers the empty canvas's hint
- [x] The tutorial's 0 read as O (Geist): its words and symbols are set in IBM Plex Mono's dotted 0
- [x] Tutorial steps are one sentence with every key as a key cap (`[Shift]`, `[0]`, `[Enter]`), the symbol to type included, instead of words plus a separate gesture chip in another style
- [x] After `10` is rejected the card keeps part 1 on show, "✓ 10 is rejected, as it should be" included, and asks for Esc to start part 2 (it used to open part 2 with a red "Press Esc")
- [x] Things to do before a step (leave a run, select q0 again before pressing A) are a plain-ink "First, …" line, not a red hint
- [x] A fanfare on Finish (a chime per ticked step was tried and dropped as annoying)
- [x] The welcome dialog was marked seen as soon as it opened, so any reload before answering it (a refresh, Vite's reload after optimizing dependencies, a second incognito tab) lost it for good: it is now marked seen when closed or when the tutorial starts
- [x] Selected states and arrows (and the arrow being drawn) are the run's orange instead of blue (`--av-selected`)
- [x] So are the open automaton's history entry, and every field being edited (the automaton's name, a state's or arrow's inline edit, the word box, a history rename): border, focus ring, caret and selected text
- [x] The accept/reject cue played twice in development: StrictMode runs the verdict banner's mount effect twice; it now plays once per mount (a replay to the end still plays it again)
- [x] Part 2 has a rename step: q0 accepts every word, so name it `any` (any name of one's own will do)
- [x] Finish fits the view (the lone state was left wherever q0 was drawn, off-centre) and opens a congratulations popup with a random joke and confetti
- [x] The trace player's step slider is the run's orange (theme.css's blue range rule was overriding it)

- [x] Replaying a run (Play at the end, First, scrubbing to step 1) plays the Run chime again
- [x] A new transition's arrow stays on screen while its symbols are typed
- [x] A new transition's symbol input opens where its label will be drawn, not on the arrow
- [x] A rejected word's cue is one falling note (the two-note version sounded like it played twice)
- [x] Opening a run or walkthrough no longer flashes the diagram fitted to a placeholder size
      (shifted left) or to the old dock height: both are measured before the first paint
- [x] Double-clicking a state to rename it dropped a name with no tall letter (`even`, the
      tutorial's part 2 rename) ~1 px (2 px zoomed in): the input centred its line box, while the
      drawn label centres its letters (`labelBaselineOffset`). The rename input now measures its
      baseline and puts it where the drawn label's is (e2e `rename-input.spec.ts`)

### History bar

- [x] Left history bar: every automaton with a thumbnail, name, kind and state count; click to open
- [x] Automata are kept most recently edited first (also in exports and on reload)
- [x] History button in the top bar hides/shows it (remembered; starts hidden on phones, where it overlays the canvas)
- [x] Hiding the bar gives the canvas the full width
- [x] The bar floats over the canvas, so the run pill, kind switch, tape, verdict, welcome and fitted diagrams stay centred on the window with it open too; fits keep clear of it on both sides
- [x] Each entry has a ⋯ menu (Rename, Export JSON, Delete); double-click renames; Import / Export all at the bottom
- [x] The top-bar automaton dropdown is gone; the name there still renames the open automaton
- [x] Delete (or Backspace) on a clicked entry deletes that automaton after asking
- [x] One-time cleanup: the first release's three seeded examples are removed from saved work if never changed
- [x] Duplicate in an entry's ⋯ menu adds a copy ("X copy", "X copy 2", …) at the top and opens it in the same view, with its own undo history
- [x] One Create button replaces New DFA / New NFA; the DFA/NFA switch moved out of the top bar into a pill floating at the top of the canvas

### Multiple start states

- [x] An NFA can have several start states (accepting when a run from any of them does); a DFA has one
- [x] S and "Toggle start" add or remove a start state on an NFA; on a DFA S moves it and "Set as start" sets it
- [x] One start arrow per start state, on the canvas, in thumbnails and in exports
- [x] The DFA toggle is disabled while an NFA has several start states (use Convert to DFA)
- [x] Convert to DFA opens with a step that adds a single start state q_s with ε-transitions to the old ones
- [x] File format version 2 (`starts`); version-1 files and saved work migrate on load

### v2 UX overhaul and polish (merged in PRs #5 and #6)

- [x] Double-click adds a state; borderless in-place rename and symbol editing (commit on blur)
- [x] Subscript labels (`q_1`, `q_{12}`); new states are named `q_0`, `q_1`, …
- [x] Shift + drag draws a transition (the ring gesture is gone); drag an edge to bend it, drag a loop to rotate it
- [x] The transition being drawn is a solid arrow; over a state it shows the edge (or self-loop) it will create
- [x] Geist / Geist Mono instead of STIX Two and Schibsted Grotesk; upright labels
- [x] Controls popup as tabs (Build, Arrange, Run, Keys) with gesture chips instead of sentences; sized to the tallest tab (superseded: now as tall as the open tab)
- [x] ε or `\eps` in the word is the empty word
- [x] Run and Convert to DFA play at once; Run has a chime, and an accept/reject cue when the verdict appears
- [x] Run highlight is a slim orange ring and edge instead of the wide yellow highlighter; the Run button is orange too
- [x] Theme toggle is light ↔ dark only, light by default (no longer follows the system; superseded: see Theme above)
- [x] Trace views stop above the floating player, so nothing (e.g. a DFA self-loop) is drawn behind it
- [x] Minimizing an already minimal DFA ends with "Already minimal" instead of Save; names never stack "(min)" or "→ DFA"
- [x] A toggles accepting, S toggles start on the selected state (Enter/Space no longer do)
- [x] Alignment snapping with guides while dragging (Alt skips)
- [x] `\eps` types ε; ε on a DFA turns it into an NFA
- [x] `\emptyset` types ∅ in a state name
- [x] Remove the transition table, issues panel and sidebar; derived alphabet; issues chip
- [x] Minimal top bar with automaton switcher; floating run pill; light/dark theme toggle
- [x] Controls popup (help button, `?`, first visit)
- [x] No examples at all: first launch is one blank automaton (e2e imports `e2e/fixtures/automata.json`)
- [x] Run animation: tape with read head, tokens along edges, dead-branch ✕, verdict banner with a reason
- [x] e2e specs rewritten for the new gestures and shell

- [x] Design spec approved (`docs/superpowers/specs/2026-10-28-automotion-design.md`)
- [x] Write the implementation plan (21 tasks)
- [x] Choose the stack: TypeScript, React, Vite, custom SVG renderer, elkjs, Zustand (see spec)
- [x] Define the automaton data model (see spec §4)
- [x] Choose a file format for saving and loading automata: versioned JSON (see spec §10)
- [x] Create the project repo, README and this file

### Automaton core

- [x] DFA: model and validation (deterministic, total or partial transition function)
- [x] NFA: model and validation, including ε-transitions
- [x] Run a word on a DFA, recording each step
- [x] Run a word on an NFA, recording the set of active states at each step (with ε-closure)
- [x] Tests for the core

### Editing

- [x] Create a new automaton
- [x] Add, rename and remove states
- [x] Set the start state and toggle accepting states
- [x] Add, change and remove transitions
- [x] Delete an automaton

### Drawing

- [x] Render the automaton as a state diagram
- [x] Drag states to reposition them
- [x] Draw states and transitions directly on the canvas
- [x] Turn a start arrow to come from any direction (drag it; snaps to 45°, Alt for free)
- [x] A dragged self-loop snaps to 45° steps too (Alt for free)

### Running a word

- [x] Input box for a word
- [x] Step forward and back through the run, highlighting active states and the transition taken
- [x] Play the whole run automatically
- [x] Show accept or reject at the end
- [x] An incomplete DFA can't be run: it is a red error in the issues chip and Run says why

### Persistence

- [x] Save and load automata
- [x] Import and export files

### Algorithms (step-by-step walkthroughs)

- [x] NFA → DFA conversion (subset construction)
- [x] DFA minimization (Moore's partition refinement)

### Polish and deploy

- [x] Visual design pass (frontend-design)
- [x] Playwright smoke tests
- [x] CI (typecheck, lint, unit tests, e2e)
- [x] Deploy job for GitHub Pages (in `.github/workflows/ci.yml`, runs after checks pass on `master`)
- [x] Enable GitHub Pages and deploy v1: https://tomerti.github.io/automotion/
- [x] Bump GitHub Actions to current majors (removes the Node.js 20 deprecation warnings)

### Rename

- [x] Rename the project from Automaton Vis to AutoMotion (repo `Tomerti/automotion`, https://tomerti.github.io/automotion/); old files and saved data still load
