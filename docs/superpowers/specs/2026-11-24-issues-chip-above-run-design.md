# Issues chip above the run box

## Intent

The "⚠ N issues" chip sat in the top bar after the automaton's name, where it was easy to miss.
Move it where people look while working, so they notice when something is wrong.

## Goals, non-goals

- Goal: the chip is noticeable while editing, and right next to the Run button it explains (an
  incomplete DFA disables Run, whose reason was only a tooltip).
- Non-goals: no change to what counts as an issue, to the list's contents, or to when the chip
  shows (hidden without issues, on a blank automaton and while a trace is open; grey on the
  tutorial's automaton).
- Anti-goal: it must not collide with the tutorial card, toasts or the dock's measured height
  (`--av-dock-h`, which pads trace views).

## Approaches

1. **Above the run box (picked).** Floats centred just above the run pill, inside the dock but out
   of its flow. Sits next to what it blocks; collides with nothing on desktop. Phones 481–760 px
   wide show toasts just above the dock, so they move up.
2. Under the DFA/NFA toggle. Ties issues to the kind, but the tutorial card is pinned there and
   would have to move with the chip; phones ≤ 480 px put toasts there too.

## Design

- `IssuesChip` leaves `TopBar` and renders in `App`'s dock, before `RunPanel`.
- `.av-issues-anchor` is absolutely positioned `bottom: calc(100% + 8px)`, centred on the dock,
  so the dock's height stays the run pill's.
- The chip is larger (30 px, 13 px text), opaque (its tint mixed into `--av-surface-raised`) and
  has the pills' float shadow; red for errors, amber for warnings, grey (muted) on the tutorial.
- Its popover opens upwards, centred on the chip.
- 481–760 px: toasts rise clear of the chip.
- A test checks the chip is in the dock, not the top bar; README and PROGRESS updated.
