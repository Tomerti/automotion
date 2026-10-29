# AutoMotion — Design

Date: 2026-10-28 · Status: draft for review

## 1. Goal and scope

AutoMotion is a browser app for building finite automata (DFA, NFA), drawing them as state
diagrams, and stepping through processes on them: running a word, converting an NFA to a DFA,
and minimizing a DFA.

It is a **portfolio project**: visual polish and clean, well-tested code matter as much as the
feature list. Success means a polished live demo that a visitor can use immediately, a pure and
thoroughly tested automaton core, and a codebase worth showing.

### In scope (v1)

- Build and edit DFAs and NFAs (with ε-transitions) on a canvas and in a synced transition table.
- Run a word with a step-by-step walkthrough of active states.
- NFA → DFA conversion (subset construction) as a step-by-step walkthrough.
- DFA minimization (Moore's partition refinement) as a step-by-step walkthrough.
- Keep several automata; autosave to localStorage; JSON import/export; SVG/PNG export of a diagram.
- Static deployment to GitHub Pages.

### Out of scope (v1)

- Regex → NFA (planned later).
- Backend, accounts, shareable links.
- Comfortable editing on touch/mobile. The app is desktop-first; on a phone it should be viewable
  and runnable, but editing is not a target.

### Assumptions

- Alphabet symbols are single characters. `ε` is reserved and is never part of the alphabet.
- A DFA may be **partial** while it is being built, but that is an error: a partial DFA can't be
  run. Minimization still accepts one and completes it with a dead state first, and an NFA can be
  switched to a partial DFA. Only an NFA run can get stuck.

## 2. Stack

- TypeScript (strict), React, Vite.
- Rendering: custom SVG components (no graph library).
- Auto-layout: elkjs.
- State: Zustand with immer.
- Import validation: zod.
- Tests: Vitest, fast-check (property tests), React Testing Library, Playwright.
- Lint/format: ESLint, Prettier.
- CI/deploy: GitHub Actions → GitHub Pages.

## 3. Architecture

Dependencies point downward only. `core/` imports nothing from the other folders.

```
src/
  core/        pure TS, no React: model, validation, edit ops, run, algorithms, traces
  layout/      elkjs wrapper: Automaton → state positions
  store/       Zustand store: collection, selection, viewport, open trace, undo/redo
  persistence/ localStorage autosave, JSON import/export, schema migration, examples
  ui/
    canvas/    SVG renderer, geometry, interaction (pan/zoom, drag, draw edges)
    table/     transition-table panel and issues list
    player/    generic trace player and per-trace-kind renderers
    shell/     app layout, automaton list, toolbar, toasts, error boundary
```

## 4. Data model (`core/model.ts`)

```ts
type StateId = string;   // stable generated id; the display label is separate
type Symbol = string;    // single character
const EPSILON = 'ε';

interface State {
  id: StateId;
  label: string;
  x: number;
  y: number;
}

interface Transition {
  id: string;
  from: StateId;
  to: StateId;
  symbols: Symbol[];     // one edge per (from, to) pair, carrying all its symbols, e.g. "a,b"
}

interface Automaton {
  id: string;
  name: string;
  kind: 'DFA' | 'NFA';
  alphabet: Symbol[];    // explicit and editable; never contains ε
  states: State[];
  start: StateId | null;
  accepting: StateId[];
  transitions: Transition[];
}
```

- Positions live on states so save/load is trivial. Algorithms ignore them.
- At most one `Transition` exists per (from, to) pair; edit operations maintain this invariant.

### Validation (`core/validate.ts`)

`validate(a: Automaton): Issue[]` where
`Issue = { severity: 'error' | 'warning'; code?: 'incomplete-dfa'; message: string; stateId?: StateId; transitionId?: string }`.
It never throws.

Errors:
- A transition references a state that does not exist.
- A transition uses a symbol not in the alphabet (ε excepted, for NFAs).
- DFA only: a transition uses ε.
- DFA only: two transitions from the same state share a symbol (nondeterminism).
- Duplicate state labels.
- DFA only: the DFA is incomplete (one issue, naming the first missing transition and how many more
  there are, or saying it has no transitions yet when it has two or more states but an empty
  alphabet; a single state with no transitions is complete; code
  `incomplete-dfa`). It blocks a run; minimization and the NFA → DFA kind switch
  ignore it (`ignoringIncomplete`).

Warnings:
- No start state.
- No accepting states.
- Unreachable states.

Changing `kind` from NFA to DFA is allowed only when the result has no errors other than being
incomplete.

## 5. Edit operations (`core/edit.ts`)

Every edit is a pure function `(Automaton, …args) → Automaton`, used by both the canvas and the
table: `addState`, `removeState` (also removes its transitions and clears start/accepting),
`renameState`, `moveState`, `setStart`, `toggleAccepting`, `addSymbolToEdge` (creates the edge if
needed), `removeSymbolFromEdge` (deletes the edge when it has no symbols left), `setEdgeSymbols`,
`removeTransition`, `addAlphabetSymbol`, `removeAlphabetSymbol` (also strips it from edges),
`setKind`, `rename`. New states are labeled `q0`, `q1`, … using the lowest free index.

Helpers: `completeWithDeadState(dfa)`, `removeUnreachable(a)`, `epsilonClosure(a, set)`.

## 6. Traces

Every process is computed **eagerly and in full** by a pure function in `core/`, producing an
immutable `Trace`: an array of step snapshots. The player only moves an index through it, so
back, scrub, jump-to-end, and autoplay need no extra logic.

```ts
interface Highlight {
  states?: StateId[];
  transitions?: string[];
}

interface StepBase {
  explanation: string;   // e.g. "Read 'a': {q0, q2} → {q1}"
  focus: Highlight;
}

interface Trace<S extends StepBase> {
  kind: 'run' | 'subset' | 'minimize';
  steps: S[];
}
```

Each trace kind extends `StepBase` with its own payload and has its own renderer in `ui/player/`.

### 6.1 Word run — `runWord(a, word): Trace<RunStep>`

Precondition: `a` has a start state and no validation errors; every symbol of `word` is in the
alphabet. Otherwise the UI shows the reason and does not start.

- Step 0: the active set is `{start}`; for an NFA, ε-closure is shown as its own sub-step when it
  adds states.
- One step per symbol: the symbol read and its index in the word, the active set before, the
  transitions taken, and the active set after. For an NFA, the ε-closure after each symbol is its
  own sub-step when it adds states.
- If the active set becomes empty, the trace ends with "stuck → reject".
- The final step states the verdict: accept if any active state is accepting, otherwise reject.
- The empty word is supported (verdict after step 0).

### 6.2 Subset construction — `subsetConstruction(nfa): Trace<SubsetStep>` plus the result DFA

- Initial step: the DFA start state is ε-closure({start}).
- One step per (subset S, symbol a) pair processed from the worklist: show S highlighted in the
  NFA, compute move(S, a) and its ε-closure, and report whether the result is a **new** DFA state
  or **reuses** an existing one.
- The empty set appears as an explicit dead state, so the result is a complete DFA.
- A DFA state is accepting if its subset contains an NFA accepting state. Labels are the subsets,
  e.g. `{q0,q1}`.
- **Rendering:** a split view. The source NFA is on the left, the DFA under construction on the
  right. elkjs lays out the **final** DFA once; each step reveals only the DFA states and edges
  built so far, so nothing moves between steps.

### 6.3 Minimization — `minimize(dfa): Trace<MinimizeStep>` plus the result DFA

Moore's partition refinement:

1. Remove unreachable states (shown fading out).
2. Complete the DFA with a dead state if it is partial.
3. Initial partition {F, Q∖F}, dropping an empty block; each block is drawn as a color tint.
4. Each refinement step splits one block. The explanation names a witness, e.g.
   "q1 and q3 differ on 'b': q1 → block A, q3 → block B".
5. When a full pass makes no split, the final step shows the minimized DFA. Each merged state is
   placed at the centroid of its block's original positions.

### 6.4 Trace results and editing lock

- Subset and minimize traces end with a **"Save as new automaton"** action that adds the result
  to the collection, named e.g. "N1 → DFA" or "D2 (min)".
- While a trace is open, the canvas and table are **view-only**. Closing the player returns to
  editing. This means a trace can never be out of date with respect to its automaton.

### 6.5 Player UI

Generic over trace kinds: previous, next, play/pause, speed, a scrubber, the current step's
explanation, and keyboard shortcuts (←/→ step, space play/pause, Esc close). The word run also
shows the input word with the current position marked.

## 7. Rendering and canvas editing (`ui/canvas/`)

### Rendering

- States are circles with labels; accepting states have a double circle; the start state has an
  incoming arrow.
- Edges go straight from boundary to boundary. If a reverse edge exists, both curve apart.
  Self-loops sit on the side of the state with the most free angular space. Labels sit at the edge
  midpoint, offset to the outside of curves.
- All geometry is in a pure `geometry.ts` module and is unit-tested.
- Highlights (active states, taken transitions, partition tints, validation errors) are styling
  props on the same components, animated with CSS/SVG transitions.

### Interactions (no tool palette; direct manipulation)

| Action | Gesture |
|---|---|
| Add state | Double-click empty space |
| Move state | Drag the state |
| Add transition | Drag from a state's outer ring to another state, or to itself; an inline symbol input opens at the edge |
| Rename state / edit symbols | Double-click the state or the edge label |
| Start / accepting | Context menu, or `S` / `A` with a state selected |
| Delete | Select, then `Delete`; removing a state removes its edges |
| Pan / zoom | Drag the background or hold space; scroll wheel; "Fit to view" button |
| Tidy | Runs elkjs on the current automaton and animates states to new positions (undoable) |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` |

## 8. Transition table (`ui/table/`)

A collapsible panel docked to the right, editing the same model as the canvas.

- Rows are states, marked `→` for start and `*` for accepting. Columns are alphabet symbols, plus
  ε for an NFA.
- A DFA cell is a single-state picker; an NFA cell is a multi-state chip picker. Editing a cell
  adds or removes that symbol on the (from, to) edge via the edit operations.
- Column headers add, remove, and rename alphabet symbols. Row headers rename or delete states and
  toggle start/accepting.
- Cells involved in validation errors are marked red. An **issues list** below the table shows all
  `validate()` issues; clicking one selects the offending element on the canvas.

## 9. Store (`store/`)

Zustand with immer, holding:

- the automata collection and the active automaton id
- the selection (states and transitions)
- the viewport (pan, zoom) per automaton
- the open trace and its current step index
- undo/redo history

Undo/redo stores `Automaton` snapshots per automaton, capped at 100 entries. A drag is
grouped into one entry, committed on pointer-up. Undo history is not persisted.

## 10. Persistence (`persistence/`)

- **Autosave**: the collection is written to localStorage, debounced at about 500 ms, and loaded on startup.
- **Examples**: on first launch, with nothing in storage, the app seeds three example automata:
  - an NFA with ε-transitions for "ends in ab"
  - a DFA for "even number of 0s"
  - a DFA with redundant states that minimizes visibly
- **File format** (JSON):
  ```json
  { "format": "automotion", "version": 1, "automata": [ /* Automaton[] */ ] }
  ```
  Files from before the rename to AutoMotion carry `"format": "automaton-vis"` and still import.
- **Export**: the current automaton or all of them, as a `.json` download.
- **Import**: by file picker or by dropping a file on the window. If an imported automaton's id
  collides with an existing one, it gets a new id.
- **Migration**: `migrate(json)` upgrades older versions to the current one. Version 1 has no
  migrations, but every load goes through this step.
- **Diagram export**: the current diagram as SVG and as PNG (rasterized from the SVG).

## 11. Error handling

- Imported files are validated with zod at the boundary. A bad file shows a toast with a specific
  reason (e.g. "transition t3 points to unknown state q9") and nothing is imported.
- Model problems are `validate()` issues shown in the UI, not exceptions. Actions that need a
  valid automaton are disabled, with a tooltip giving the reason:
  - Run needs a start state and no errors.
  - Convert needs an NFA with no errors.
  - Minimize needs a DFA with no errors.
- If localStorage fails (quota, private mode), the app shows a one-time warning ("changes won't
  persist — export to save") and keeps working in memory.
- A top-level React error boundary offers an "export your data" button so work is not lost.

## 12. Testing

- **Unit tests for `core/`** (Vitest):
  - validation
  - every edit operation
  - ε-closure, dead-state completion, unreachable-state removal
  - `runWord` on DFAs and NFAs, including stuck runs and the empty word
  - subset construction and minimization step contents on hand-checked examples
- **Property tests** (fast-check, on random small automata and random words):
  - The DFA produced by subset construction accepts exactly the words its NFA accepts.
  - The minimized DFA accepts the same language as its input and has no more states than the
    input after removing unreachable states and completing it with a dead state.
  - Minimizing an already minimized DFA changes nothing (up to renaming).
- **Other unit tests**:
  - persistence round-trip, migration and import errors
  - `geometry.ts`
- **Component tests** (React Testing Library):
  - transition table edits
  - trace player controls
- **End-to-end smoke tests** (Playwright):
  1. Build a DFA on the canvas, run a word, and see accept.
  2. Convert the example NFA and step to the end.
  3. Export, then import.
- **CI**: GitHub Actions runs typecheck, lint, and tests on every push, then deploys to GitHub
  Pages from `master`.

## 13. Build order

1. Scaffold (Vite, TS strict, ESLint/Prettier, Vitest, CI)
2. `core/`: model, validation, edit operations, `runWord`, with tests
3. Store, with undo/redo
4. Static SVG renderer and geometry
5. Canvas editing interactions
6. Transition table and issues list
7. Trace player and word run
8. Subset construction walkthrough
9. Minimization walkthrough
10. Persistence, examples, import/export
11. Visual design pass (frontend-design)
12. Playwright smoke tests and deploy to GitHub Pages

The UI stays functional and unstyled until step 11, so the design pass works on a complete app.
