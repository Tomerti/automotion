# Multiple start states for NFAs

Approved in chat 2026-10-28. Extends the v1 spec (`2026-10-28-automotion-design.md`) and the v2
spec (`2026-10-28-v2-ux-overhaul-design.md`); this document wins where they disagree.

## Goal

An NFA may have several start states, as in the common textbook generalization: a word is
accepted when a run from **any** start state accepts. Converting such an NFA to a DFA shows the
standard construction first: a new single start state with ε-transitions to the old start states.
DFAs keep exactly one start state.

## Model (`src/core/model.ts`)

- `Automaton.start: StateId | null` is replaced by `starts: StateId[]`, ordered by when each state
  became a start state, with no duplicates. `emptyAutomaton` sets `starts: []`.
- Every reader of `start` reads `starts` instead. Only start states that exist count (as today's
  "start that points at a missing state" handling).
- `core/testing/fixtures.ts`: `FixtureSpec.start?: string` stays for single-start fixtures, and a
  new `starts?: string[]` covers several; `arbitraries.ts` generates NFAs with 0 to 3 start states
  and DFAs with 0 or 1.

## Validation (`src/core/validate.ts`)

- No start state: the existing warning "No start state" (both kinds).
- A DFA with more than one start state: error "A DFA has exactly one start state".
- Reachability (unreachable-state warnings) starts from all start states.

## Editing (`src/core/edit.ts`, canvas)

- `setStart(a, id | null)` keeps its meaning for DFAs: `starts` becomes `[id]` (or `[]`).
- New `toggleStart(a, id)`: on an NFA, adds `id` to `starts` or removes it; on a DFA, makes `id`
  the only start state, or clears `starts` if it already was (today's S-key behaviour).
- `removeState` drops the state from `starts`.
- S key on a selected state calls `toggleStart`. The state's right-click menu item reads
  "Set as start" on a DFA (calls `setStart`, as today) and "Toggle start" on an NFA (calls
  `toggleStart`). The Controls popup text stays "Toggle start state".
- Kind toggle (`Toolbar.tsx`): the DFA button is disabled while the automaton is an NFA with more
  than one start state, titled "An NFA with several start states can't be a DFA: use Convert to
  DFA". `setKind` also refuses it (via the new validation error), as a backstop.

## Drawing (`src/ui/canvas/`)

- Every start state gets its own start arrow, entering from the left exactly as today's single
  arrow: `Diagram.tsx` renders one `data-testid="start-arrow"` group per start state, each with
  `data-state-id`. `StateNode`'s `data-start` follows `starts`. `geometry.ts` treats the left side
  as occupied for every start state (loop and edge placement), and `Thumbnail.tsx` draws one arrow
  per start state. SVG/PNG export follows from `Diagram`.
- Layout (`layout/layout.ts`): every start state gets the FIRST-layer constraint.

## Running a word (`src/core/run.ts`)

- `canRun` / `canMinimize` / `canConvert`: "Set a start state first" when `starts` has no existing
  state.
- The run's `start` step activates all start states (a token on each, as the run view already
  draws one per active state); its explanation is `Start: {q0, q2}` as today's `formatSet`. The
  ε-closure step and everything after are unchanged, since they already work on sets.
- `analysis.ts`: `reachableStates`, `trimUnreachable` and `accepts` start from all start states
  (ε-closure of the whole set for `accepts`).

## Converting to a DFA (`src/core/subset.ts`)

- One start state: unchanged.
- Several start states:
  1. Build the **extended NFA**: a copy of the NFA plus a new state, the only start state, with an
     ε-transition to each old start state. Its label is `q_s` (shown q with subscript s), or the
     first of `q_s'`, `q_s''`, … that no state uses. It sits `START_GAP` (120 world px) left of the
     leftmost old start state, at the average y of the old start states. The extended NFA is the
     trace's `source`, so the walkthrough's left diagram shows the new state and its ε-arrows.
  2. A new first step, `phase: 'starts'`, explains "Several start states: add a new start state
     q_s with ε-transitions to {q0, q2}", and highlights the new state and its ε-transitions
     (`focus`), with nothing revealed in the DFA yet.
  3. The subset construction then runs on the extended NFA exactly as today: its `init` step is
     ε-closure({q_s}), which contains q_s and every old start state's closure.
- The saved NFA is never changed. "Save as new automaton" saves the result DFA, whose start subset
  label includes `q_s` (an honest record of the construction).
- `SubsetStep.phase` gains `'starts'`; `SubsetTraceView` shows it like an `init` step with an empty
  DFA side.

## Minimize (`src/core/minimize.ts`)

DFA only, so it reads `starts[0]`; the result DFA has `starts: [its start]`.

## File format (`src/persistence/`)

- `CURRENT_VERSION` becomes 2. The schema's automaton has `starts: string[]` instead of `start`, and
  checks that every entry is an existing state id and that a DFA has at most one.
- `migrate()` turns a version-1 file into version 2: each automaton's `start: id | null` becomes
  `starts: [id]` or `[]`. Files newer than 2 are refused as today. localStorage autosave goes
  through the same path, so saved work migrates on the next load and is written back as v2.
- `e2e/fixtures/automata.json` stays v1 on purpose, covering the migration end to end.

## Testing

- Core: `toggleStart` and `removeState` on both kinds; validation of a multi-start DFA; a run on a
  multi-start NFA activates all starts and gives the same verdict as a run on the extended NFA;
  property test: the subset DFA accepts exactly the words the (possibly multi-start) NFA accepts;
  the `starts` step and `q_s` naming and placement (including a taken `q_s`).
- Persistence: v1 → v2 migration (with and without a start), schema rejecting an unknown start id
  and a two-start DFA, round trip of a multi-start NFA.
- UI: one start arrow per start state on the canvas and in thumbnails; S toggles on an NFA and
  moves on a DFA; the menu label per kind; the DFA button disabled with its title; the subset view's
  first step.
- e2e: on an NFA, make two start states with S, run a word that only the second start accepts,
  then Convert to DFA and see the `q_s` step first.

## Out of scope

- A separate "merge start states" editing action (the construction only appears in the
  walkthrough).
- Several start states on a DFA.
