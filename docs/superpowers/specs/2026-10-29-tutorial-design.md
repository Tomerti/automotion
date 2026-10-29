# Interactive tutorial

Approved in chat 2026-10-29. Extends the v1 spec (`2026-10-28-automotion-design.md`), the v2 spec
(`2026-10-28-v2-ux-overhaul-design.md`) and the multiple-start-states spec; this document wins
where they disagree.

## Goal

A first-time user learns the editor by doing: they build a DFA for **an even number of 0s** over
Σ = {0, 1} (q0 is the start and the only accepting state), run two words to see it work, then
change it to accept **every** word by deleting q1 and giving q0 a self-loop on `0,1`. Each step is
done with the real gestures on the real canvas; the tutorial watches the automaton and moves on
by itself. It never does a step for the user.

## Entry points

- **First visit** (no `automotion:seen-help` key): a small welcome dialog opens instead of the
  Controls popup. Title "Welcome to AutoMotion", one line ("Learn the basics by building a small
  automaton, about two minutes."), buttons **Start tutorial** (primary) and **Not now**, and a
  footnote "Press ? at any time for all the controls." Escape, the backdrop and Not now dismiss
  it. Opening it marks help as seen (same key, same `markHelpSeen()`), so it shows once.
  `useControlsHelp()` no longer opens the Controls popup by itself; `?` still opens it.
- **Controls popup**: a **Take the tutorial** button in its header, left of the close button
  (reads **Restart tutorial** while one is running). It closes the popup and starts the tutorial.
- Starting while a tutorial is running restarts it from step 1 on a fresh automaton.

## The tutorial automaton

- If the active automaton has no states, the tutorial uses it: it is renamed **Tutorial** (or
  "Tutorial 2", … if taken; same numbering as `freeName`) and made a DFA. This keeps the first
  visit from leaving an empty "Untitled" behind. Otherwise a new DFA named that way is created
  (`createAutomaton`, then a rename), which also opens it.
- Opening it closes any open trace (as creating or selecting already does).
- When the tutorial ends (finished or closed), the automaton stays in history like any other.
- Progress is not saved: a reload ends the tutorial; the automaton is kept.

## Steps

States are found by **role**, never by label, so renaming them is harmless; instructions show
their current labels through `LabelText` (subscripts). Within a context `a` (the tutorial
automaton):

- **q0** = the first start state (`startStates(a)[0]`), or before there is one, the first state.
- **q1** = the first state that is not q0.
- `edge(x, y)` = the symbols of the transition x → y as a set (empty if none).

| # | Part | Instruction | Gesture chip | Done when | Pointer |
|---|------|-------------|--------------|-----------|---------|
| 1 | 1 | Add a state | Double-click · empty canvas | ≥ 1 state | – |
| 2 | 1 | Make q0 the start state | Click q0, then S | q0 is a start state | q0 |
| 3 | 1 | Make q0 accepting: a word is accepted when it ends here | A · selected state | q0 accepting | q0 |
| 4 | 1 | Add a second state, q1 | Double-click · empty canvas | ≥ 2 states | – |
| 5 | 1 | Reading a 0 in q0 goes to q1 | Shift + Drag · q0 to q1, type 0 | edge(q0,q1) = {0} | q0 |
| 6 | 1 | …and a 0 in q1 goes back | Shift + Drag · q1 to q0, type 0 | edge(q1,q0) = {0} | q1 |
| 7 | 1 | A 1 changes nothing: add a self-loop on 1 to both states | Shift + Drag · a state onto itself | edge(q0,q0) = {1} and edge(q1,q1) = {1} | the state still missing its loop |
| 8 | 1 | Test it: run `1010` (two 0s) | Enter · in "Test a word" | latched (see below): run of `1010` reached its verdict, accepted | word box |
| 9 | 1 | Now run `10` (one 0): it should be rejected | Esc, then Enter · in "Test a word" | latched: run of `10` reached its verdict, rejected | word box |
| 10 | 2 | Accept every word: delete q1 (its arrows go with it) | Click q1, then Delete | exactly one state, which is start and accepting | q1 |
| 11 | 2 | Let q0's loop read both symbols: `0,1` | Double-click · the loop | edge(q0,q0) = {0,1} | q0's loop label |
| 12 | 2 | Run `10` again: now it's accepted | Enter · in "Test a word" | latched: run of `10` reached its verdict, accepted | word box |
| 13 | – | Done. "You built a DFA, ran it and changed what it accepts. Try **Convert to DFA** and **Minimize** in the toolbar next; press **?** for all the controls." | – | **Finish** button | – |

Steps 8–9 and 12 also require the structural steps before them in their part (see *Progress*), so a
run only counts on the right automaton. The counter reads "Tutorial · n of 12"; step 13 reads
"Tutorial · Done".

### Latched run steps

A run step is done when the open trace is a `run` trace whose `source.id` is the tutorial
automaton, whose `word` equals the step's word, whose `accepted` matches, and whose `stepIndex`
is the last step (the verdict is on screen). Once done it stays done (stored in the tutorial
store), even after the trace closes.

### Progress and fallback

- `progress` is the furthest step reached; it only increases. Parts: steps 1–9 and 10–12.
- The **current** step is the earliest step from the start of `progress`'s part up to `progress`
  that is not done (latched steps count as done). If none, `progress` advances to the next step and
  the check repeats (several steps can complete at once, e.g. the user added two states early).
- So undoing, deleting q0 or breaking an arrow drops the card back to the step that needs redoing,
  without losing the furthest point. Part 2 never falls back into part 1 (deleting q1 there is the
  point).
- When a step completes, the card shows "✓ {that step's short confirmation}" (e.g. "✓ q0 is the
  start state") under the new instruction until the next step completes.

### Hints

Each step may return one hint, shown in the card in the error colour under the instruction. The
first applicable one wins:

- Any step while the tutorial automaton isn't the active one: "You're on {name}." with a **Back
  to Tutorial** button (`setActive`). No other hint, no pointer.
- Any structural step (1–7, 10–11) while a trace is open: "Press Esc to get back to editing."
- Part 1, more than two states: "Delete the extra state {label} (click it, then Delete)."
- Part 1, q1 accepting: "Only q0 should be accepting: select q1 and press A."
- Automaton is an NFA: "It became an NFA: switch back to DFA at the top" (ε makes it one).
- Steps 5–7 and 11: an edge the step asks for exists but has other symbols: "q0 → q1 should read
  only 0" (wording per edge).
- Part 1, an arrow other than q0 → q1, q1 → q0 and the two loops (only possible once q1 exists):
  "Delete the arrow {from} → {to} (click it, then Delete)."
- Run steps, a run of a different word on the tutorial automaton is open: "That was `11`. Press
  Esc and run `1010`."
- Step 10, no states left: "Undo (Ctrl+Z) to bring q0 back."

Hints are pure functions of the context, like `done`.

## UI

### Coach card (`TutorialCard.tsx`)

- Floats in the top-right corner of `.av-canvas-area` (absolute, 12 px inset), above the canvas
  and trace views, below modals and toasts. Width 300 px; on narrow screens (the existing `max-width: 760px`
  breakpoint) it spans the width under the kind pill.
- Header: "Tutorial · n of 12" in the muted small caps style of other section labels, and a ✕
  icon button "End tutorial" (`aria-label`). There is no Back button: steps are checked live and
  fall back by themselves, so Back would only jump forward again. (Changed from the chat design.)
- Body: the instruction (`LabelText` for state labels, `<code>`-styled words in Geist Mono), the
  gesture chip, then the hint or the ✓ confirmation.
- Step 13 shows the closing text and a primary **Finish** button.
- `role="region"`, `aria-label="Tutorial"`, `aria-live="polite"` on the instruction so screen
  readers hear each new step. The card takes no keys and never steals focus, so S, A, Delete, Esc
  and typing keep working.
- Styling uses the existing tokens (`--av-surface-raised`, `--av-rule-strong`,
  `--av-shadow-float`, `--av-font-ui`, `--av-red` for hints, `--av-green` for ✓), so it follows
  light and dark. A short fade/slide between steps; none under `prefers-reduced-motion`.
- `data-testid="tutorial-card"` with `data-step` (1–13).

### Gesture chips

`GestureChip` (and `MouseGlyph`, the `Gesture` type) move from `ControlsDialog.tsx` to
`src/ui/shell/GestureChip.tsx`, unchanged, and both the Controls popup and the card import it.

### Pointer (`TutorialPointer.tsx`)

- Given a CSS selector (or nothing), draws a soft pulsing ring in the accent colour around the
  element's bounding box (plus 6 px), `position: fixed`, `pointer-events: none`. It follows the
  element with a `requestAnimationFrame` loop while mounted (states move, the canvas pans and
  zooms) and hides when the element is missing. No pulse under `prefers-reduced-motion` (a still
  ring).
- Targets: a state `[data-testid="canvas"] [data-state-id="…"]`, a loop label
  `[data-transition-id="…"] [data-testid="edge-label"]`, the word box `input[aria-label="Word"]`.
- `data-testid="tutorial-pointer"`.

### Welcome dialog (`WelcomeCard.tsx`)

Uses the existing `.av-modal` / `.av-modal-backdrop` styles and the Controls popup's focus
handling (dialog takes focus; Escape closes and stops propagation). `aria-label="Welcome"`.

## Code layout

`src/ui/tutorial/`:

- `steps.ts`: pure. `TutorialContext` (`automaton`, `isActive`, `trace`, `stepIndex`), the step
  table (`id`, `part`, `instruction(ctx)`, `gesture`, `confirmation(ctx)`, `done(ctx)`,
  `hint(ctx)`, `target(ctx)`, `run?: { word, accepted }`), and `advance(progress, latched, ctx)` →
  `{ progress, current, latched }`. Imports only `core/` and types.
- `tutorialStore.ts`: a small Zustand store (`active`, `automatonId`, `progress`, `latched`,
  `confirmation`) with `startTutorial()`, `endTutorial()`. While active it subscribes to
  `appStore` and runs `advance` on every change; it also ends itself if the tutorial automaton is
  deleted. Selectors return stable references (see `useAppStore`'s doc comment).
- `TutorialCard.tsx`, `TutorialPointer.tsx`, `WelcomeCard.tsx`, `tutorial.css`.

Changes elsewhere: `help.ts` (first visit opens the welcome dialog, not Controls),
`ControlsDialog.tsx` (tutorial button, `GestureChip` import), `App.tsx` (mounts the welcome
dialog, card and pointer). README (a "Learn" line), PROGRESS.md and CLAUDE.md (architecture:
`ui/tutorial/`) are updated.

## Testing

- `steps.test.ts`: every step's `done` and `hint` on fixtures; `advance` moves through several
  done steps at once, falls back within a part, never falls back into part 1 from part 2, latches
  run steps only at the verdict and only for the tutorial automaton; roles survive renames.
- `tutorialStore.test.ts`: starting reuses an empty active automaton or creates a new one; names
  "Tutorial 2" when taken; ends when its automaton is deleted.
- `TutorialCard.test.tsx`: shows the current step and counter, the hint, Back to Tutorial, ✕ ends,
  Finish ends.
- `WelcomeCard` / `help` tests: first visit shows the welcome dialog (not Controls), once; Start
  starts the tutorial; `?` still opens Controls. `App.test.tsx`'s first-visit test is updated.
- `e2e/tutorial.spec.ts`: from a first visit, walk all 13 steps with real gestures (double-click,
  Shift + drag, typing symbols, S, A, Delete, running words, Esc) and check the card advances and
  the final automaton has one state with a `0,1` loop. Other specs keep dismissing first-visit help
  via `e2e/helpers.ts` (the same key), so they are unaffected.

## Out of scope

Saving progress across reloads, other tutorials (NFA, Convert, Minimize), touch-specific
instructions, localisation.
