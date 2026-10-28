# Progress

Legend: `[ ]` to do · `[~]` in progress · `[x]` done

## Current

Nothing in progress. v1 is live at https://tomerti.github.io/automaton-vis/; pick the next item from Next.

## Next

- [ ] Subset walkthrough: larger results (8+ DFA states) are too small to read; hide the transition table while a trace is open, and consider a more compact layout or pan/zoom in trace views
- [ ] Format: decide on line endings (`.gitattributes` / Prettier `endOfLine`) so `prettier --check .` passes, then add it to CI
- [ ] Hardening from review: import schema should check that start/accepting refer to existing states; PNG export guard for a 0×0 size; e2e loops should wait instead of polling `isEnabled()`

## Ideas (later)

- [ ] Regex → NFA

## Done

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
