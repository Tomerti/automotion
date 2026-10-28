# Progress

Legend: `[ ]` to do · `[~]` in progress · `[x]` done

## Current

- [ ] Review the implementation plan (`docs/superpowers/plans/2026-10-28-automaton-vis-v1.md`) and choose an execution method

## Next

### Automaton core
- [ ] DFA: model and validation (deterministic, total or partial transition function)
- [ ] NFA: model and validation, including ε-transitions
- [ ] Run a word on a DFA, recording each step
- [ ] Run a word on an NFA, recording the set of active states at each step (with ε-closure)
- [ ] Tests for the core

### Editing
- [ ] Create a new automaton
- [ ] Add, rename and remove states
- [ ] Set the start state and toggle accepting states
- [ ] Add, change and remove transitions
- [ ] Delete an automaton

### Drawing
- [ ] Render the automaton as a state diagram
- [ ] Drag states to reposition them
- [ ] Draw states and transitions directly on the canvas

### Running a word
- [ ] Input box for a word
- [ ] Step forward and back through the run, highlighting active states and the transition taken
- [ ] Play the whole run automatically
- [ ] Show accept or reject at the end

### Persistence
- [ ] Save and load automata
- [ ] Import and export files

### Algorithms (step-by-step walkthroughs)
- [ ] NFA → DFA conversion (subset construction)
- [ ] DFA minimization (Moore's partition refinement)

### Polish and deploy
- [ ] Visual design pass (frontend-design)
- [ ] Playwright smoke tests
- [ ] CI and deploy to GitHub Pages

## Ideas (later)

- [ ] Regex → NFA

## Done

- [x] Design spec approved (`docs/superpowers/specs/2026-10-28-automaton-vis-design.md`)
- [x] Write the implementation plan (21 tasks)
- [x] Choose the stack: TypeScript, React, Vite, custom SVG renderer, elkjs, Zustand (see spec)
- [x] Define the automaton data model (see spec §4)
- [x] Choose a file format for saving and loading automata: versioned JSON (see spec §10)
- [x] Create the project repo, README and this file
