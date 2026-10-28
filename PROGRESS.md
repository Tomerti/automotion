# Progress

Legend: `[ ]` to do · `[~]` in progress · `[x]` done

## Current

- [~] v2 UX overhaul (spec: `docs/superpowers/specs/2026-10-28-v2-ux-overhaul-design.md`), in review on branch `worktree-v2-ux-overhaul`

## Next

- [ ] Subset walkthrough: larger results (8+ DFA states) are too small to read; consider a more compact layout or pan/zoom in trace views (the transition table is gone in v2)
- [ ] Equal-spacing snap guides (Notability-style) in addition to center alignment
- [ ] Format: decide on line endings (`.gitattributes` / Prettier `endOfLine`) so `prettier --check .` passes, then add it to CI
- [ ] Hardening from review: import schema should check that start/accepting refer to existing states; PNG export guard for a 0×0 size; e2e loops should wait instead of polling `isEnabled()`

## Ideas (later)

- [ ] Regex → NFA

## Done

### v2 UX overhaul

- [x] Double-click adds a state; borderless in-place rename and symbol editing (commit on blur)
- [x] Subscript labels (`q_1`, `q_{12}`); new states are named `q_0`, `q_1`, …
- [x] Shift + drag draws a transition (the ring gesture is gone); drag an edge to bend it, drag a loop to rotate it
- [x] Enter toggles accepting, Space toggles start on the selected state
- [x] Alignment snapping with guides while dragging (Alt skips)
- [x] `\epsilon` types ε; ε on a DFA turns it into an NFA
- [x] Remove the transition table, issues panel and sidebar; derived alphabet; issues chip
- [x] Minimal top bar with automaton switcher; floating run pill; light/dark/system theme toggle
- [x] Controls popup (help button, `?`, first visit)
- [x] No seeded examples: first launch is one blank automaton; "Load examples" in the menu
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
