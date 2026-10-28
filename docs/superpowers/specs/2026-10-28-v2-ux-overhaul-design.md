# Automaton Vis v2: interaction and UI overhaul

Approved 2026-10-28. Supersedes the v1 spec where they disagree (editing gestures, layout, run view).

## Goals

Make the editor minimalistic and intuitive: draw on a full-bleed canvas with direct gestures,
no side panels, a short controls popup, and a run animation that reads at a glance.

## Model (`src/core/`)

- `Transition` gains optional `bend?: number` (signed perpendicular offset of the curve apex from
  the chord, world px, positive = left of from→to on screen) and `loopAngle?: number` (radians,
  self-loops only). Absent = v1 automatic geometry (straight, or curved by `CURVE_OFFSET` when the
  reverse edge exists; loop at `bestLoopAngle`). The schema accepts both as optional numbers; the
  file format version is unchanged.
- Labels: `q_1` displays as q₁, `q_{12}` as q₁₂. Storage keeps the raw text.
  `parseLabel(label)` in `core/label.ts` returns `{ base, sub }[]` segments; every UI surface that
  shows a state label (canvas, tape, explanations, lists) renders segments.
- New states are named `q_0`, `q_1`, … (first free index).
- Symbol input: `\epsilon`, `eps` and `ε` mean ε; the input replaces `\epsilon` with `ε` live.
  Adding ε to a DFA switches it to NFA in the same undo step, with an info toast.
- The alphabet is derived: edits that change edge symbols keep `alphabet` equal to the sorted set
  of non-ε symbols on transitions (`syncAlphabet`). There is no alphabet editor.

## Canvas (`src/ui/canvas/`)

| Gesture | Effect |
| --- | --- |
| Double-click empty canvas | add a state there |
| Double-click a state | rename in place: borderless input over the label, same font; Enter/blur commit, Esc cancels |
| Double-click an edge | edit its symbols in place (same borderless style) |
| Shift + drag from a state to a state (or itself) | new transition, then type its symbols |
| Drag a state | move it; snaps to another state's x or y within 8 screen px with a dashed guide (Alt disables) |
| Drag an edge | bend it (snaps straight within 6 px); dragging a self-loop rotates it |
| Click background / drag background | clear selection / pan |
| Enter / Space on the selected state | toggle accepting / toggle start (A and S remain aliases) |
| Delete/Backspace, Ctrl+Z / Ctrl+Y | delete selection, undo / redo |
| Right-click | menu: start, accepting, rename, delete; edges: edit, straighten, delete |
| `?` | open the controls popup |

The outer-ring draw gesture and hold-Space panning are removed.

## Shell (`src/ui/shell/`)

- Full-bleed canvas; no left sidebar and no right panel (transition table and issues list are
  deleted).
- Slim top bar: brand mark · automaton switcher (name, click to rename; dropdown: automata list,
  New DFA, New NFA, Load examples, Delete, Import, Export JSON) · DFA/NFA toggle · icon buttons
  with tooltips (undo, redo, fit, tidy, convert to DFA, minimize, export SVG/PNG, theme, help) ·
  "⚠ N issues" chip with a popover listing issues (click selects the item).
- Floating run pill at the bottom of the canvas: word input + Run.
- First launch (no stored data, or no storage) starts with one blank DFA named "Untitled" and a
  faint hint "Double-click to add a state · ? for controls". Examples load only on request. A
  corrupt store is still backed up; the app then starts blank.
- Theme: system / light / dark toggle stored in localStorage `automaton-vis:theme`, applied as
  `data-theme` on `<html>`. Exports always use the light palette.
- Controls popup: modal listing the gesture table above; opens from the help button or `?`, and
  once automatically on first visit (`automaton-vis:seen-help`).

## Run view (`src/ui/player/`)

- Input tape across the top: one cell per symbol, read-head caret, consumed cells dimmed.
- Read step: the edge label symbol lights up and a token slides along each taken edge from the
  previous state to the next (≈600 ms ÷ speed). NFA: one token per active state; ε steps move
  tokens along ε edges; branches that die fade with a ✕.
- Verdict: large Accepted (green) / Rejected (red) banner with a one-line reason.
- Compact player bar: first, previous, play/pause, next, last, scrubber, speed, close (Esc).
  Stepping backwards or scrubbing jumps without animation. `prefers-reduced-motion` disables motion.

## Testing

Unit and component tests follow each change; the table/issues/sidebar tests are removed with their
components. e2e specs are rewritten for the new gestures. CI (typecheck, lint, unit, e2e) must pass.
