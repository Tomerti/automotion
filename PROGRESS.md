# Progress

Legend: `[ ]` to do · `[~]` in progress · `[x]` done

## Current

Nothing in progress: pick the next task from the list below.

## Next

- [ ] Subset walkthrough: larger results (8+ DFA states) are too small to read; consider a more compact layout or pan/zoom in trace views (the transition table is gone in v2)
- [ ] Equal-spacing snap guides (Notability-style) in addition to center alignment
- [ ] Format: decide on line endings (`.gitattributes` / Prettier `endOfLine`) so `prettier --check .` passes, then add it to CI
- [ ] The run tape and edge labels still set 0 in Geist, where it reads as O: consider the tutorial's dotted-zero symbol font (`--av-font-symbol`) there too
- [ ] Hardening from review: import schema should check that start/accepting refer to existing states; PNG export guard for a 0×0 size; e2e loops should wait instead of polling `isEnabled()`

- [ ] Copy and paste follow-ups: Ctrl+X (cut), Ctrl+A (select all), and Shift + click as an alternative to Ctrl + click (Ctrl + click is a right-click on a Mac, so Mac users have ⌘ only)

## Ideas (later)

- [ ] Regex → NFA

## Done

### Copy and paste

- [x] Select several states: Ctrl + drag on the empty canvas draws a selection box, Ctrl + click adds or removes a state (or arrow); the arrows between selected states are selected too
- [x] Dragging a selected state moves the whole selection (one undo step), snapping to the other states
- [x] Ctrl+C / Ctrl+V copy and paste the selected states with the arrows between them and their arrows to outside states (arrows into the chain are not copied); the paste lands at the pointer, or a step off the original, and is selected
- [x] Pasted names keep their label when free, otherwise gain primes (q_1 → q_1'); accepting is copied, start is not; pasting into another automaton drops arrows to states it lacks, and ε-arrows turn a DFA into an NFA
- [x] Ctrl+C copies the selected states when there are any, and the diagram as a picture (Copy image) when there are none
- [x] Right-click: Copy on a state, Copy / Delete N states on a multi-selection, Paste on the empty canvas

### Theme

- [x] The theme follows the system (light or dark, switching live when the system does) unless the theme menu in the top bar forces Light or Dark; System is the default and the choice is remembered

### Copy image

- [x] Copy image (first item of the image menu) and Ctrl+C put the diagram on the clipboard as a PNG, to paste straight into a document or chat; Ctrl+C leaves text selections and fields alone
- [x] The copied picture is the downloaded PNG, and neither depends on the canvas's zoom or pan or on display scaling: the whole automaton at a fixed 2× (`PNG_SCALE`), checked pixel for pixel by e2e `copy-image.spec.ts`
- [x] Exported and copied pictures set their labels in Geist, like the canvas, instead of the system font (Segoe UI on Windows): a standalone SVG can't reach the page's web fonts, so `embedFont.ts` embeds Geist 500, cut down by Google Fonts (`text=`) to the characters drawn (2 to 3 KB), as a base64 `@font-face`; offline it falls back to the system font

### Tutorial

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
- [x] Controls popup as tabs (Build, Arrange, Run, Keys) with gesture chips instead of sentences; sized to the tallest tab
- [x] ε or `\epsilon` in the word is the empty word
- [x] Run and Convert to DFA play at once; Run has a chime, and an accept/reject cue when the verdict appears
- [x] Run highlight is a slim orange ring and edge instead of the wide yellow highlighter; the Run button is orange too
- [x] Theme toggle is light ↔ dark only, light by default (no longer follows the system; superseded: see Theme above)
- [x] Trace views stop above the floating player, so nothing (e.g. a DFA self-loop) is drawn behind it
- [x] Minimizing an already minimal DFA ends with "Already minimal" instead of Save; names never stack "(min)" or "→ DFA"
- [x] A toggles accepting, S toggles start on the selected state (Enter/Space no longer do)
- [x] Alignment snapping with guides while dragging (Alt skips)
- [x] `\epsilon` types ε; ε on a DFA turns it into an NFA
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
