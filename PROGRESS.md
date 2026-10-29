# Progress

Legend: `[ ]` to do · `[~]` in progress · `[x]` done

## Current

Nothing in progress: pick the next task from the list below.

## Next

- [ ] Subset walkthrough: larger results (8+ DFA states) are too small to read; consider a more compact layout or pan/zoom in trace views (the transition table is gone in v2)
- [ ] Equal-spacing snap guides (Notability-style) in addition to center alignment
- [ ] Format: decide on line endings (`.gitattributes` / Prettier `endOfLine`) so `prettier --check .` passes, then add it to CI
- [ ] Hardening from review: import schema should check that start/accepting refer to existing states; PNG export guard for a 0×0 size; e2e loops should wait instead of polling `isEnabled()`

## Ideas (later)

- [ ] Regex → NFA

## Done

### Fixes

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
- [x] Each entry has a ⋯ menu (Rename, Export JSON, Delete); double-click renames; Import / Export all at the bottom
- [x] The top-bar automaton dropdown is gone; the name there still renames the open automaton
- [x] Delete (or Backspace) on a clicked entry deletes that automaton after asking
- [x] One-time cleanup: the first release's three seeded examples are removed from saved work if never changed

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
- [x] Theme toggle is light ↔ dark only, light by default (no longer follows the system)
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

- [x] Design spec approved (`docs/superpowers/specs/2026-10-28-automaton-vis-design.md`)
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

### Running a word

- [x] Input box for a word
- [x] Step forward and back through the run, highlighting active states and the transition taken
- [x] Play the whole run automatically
- [x] Show accept or reject at the end

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
- [x] Enable GitHub Pages and deploy v1: https://tomerti.github.io/automaton-vis/
- [x] Bump GitHub Actions to current majors (removes the Node.js 20 deprecation warnings)
