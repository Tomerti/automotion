# Progress

Legend: `[ ]` to do · `[~]` in progress · `[x]` done

## Current

- [ ] Choose the stack (e.g. web app with TypeScript and a graph-drawing library)
- [ ] Define the automaton data model (states, alphabet, transitions, start state, accepting states; DFA vs NFA)
- [ ] Choose a file format for saving and loading automata (e.g. JSON)

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

## Ideas (later)

- [ ] NFA → DFA conversion (subset construction)
- [ ] DFA minimization
- [ ] Regex → NFA

## Done

- [x] Create the project repo, README and this file
