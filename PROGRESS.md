# Progress

Legend: `[ ]` to do · `[~]` in progress · `[x]` done

## Current

- [~] Deploy to GitHub Pages: workflow is in place, waiting for Pages to be enabled

## Next

- [ ] Enable GitHub Pages (Settings → Pages → Source: GitHub Actions)

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
- [x] Deploy workflow for GitHub Pages (`.github/workflows/deploy.yml`)
