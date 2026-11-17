# Regex rework: minimal DFA straight from a regex, simpler To regex, Create menu

Agreed in chat 2026-11-17, after trying the first regex build (`2026-11-17-regex-design.md`). This
document wins where they disagree.

## Intent

Trying the regex features, the user found them hectic: building from a regex left a chain of
automata in the history (the NFA, then a DFA, then the minimal DFA, each saved from its own
walkthrough), To regex gave regexes that read worse than the obvious answer (`a*b*` as a DFA came
back as `a*(ε|bb*)`), and the ▾ beside Create read as a separate, odd control.

## Goals

- From regex gives exactly **one** automaton: the minimal DFA of the regex, named after it.
- To regex simplifies the common patterns, so `a*b*` comes back as `a*b*`.
- Create is one button that opens a small menu: **Blank automaton** and **From regex…**.

## Non-goals

- A Thompson walkthrough (regex → NFA step by step). It is removed; the student chose to skip it.
- A shortest regex in general (hard); only a fixed set of sound rewrites.

## Anti-goals

- Leaving dead walkthrough code behind.
- Any rewrite that changes the language (every rewrite is sound and property-tested).

## Approaches (picked in chat)

- From regex: keep the walkthrough and save one minimal DFA / **skip the walkthrough and create the
  minimal DFA** (picked) / one long walkthrough regex → NFA → DFA → minimal DFA.
- Create: **Create opens a small menu** (picked) / From regex inside Import / its own button.

## Design

### 1. From regex → minimal DFA

- The dialog (`ui/shell/RegexDialog.tsx`) keeps live `\eps`/`\emptyset` normalisation, the error
  caret, the syntax line, Enter and Escape. Its button becomes **Create DFA** (`regex-build` test id
  kept).
- Building: parse → Thompson NFA (`core/thompson.ts`, kept as a pure NFA builder, no steps, no
  layout) → `subsetConstruction` → minimize → relabel states `q_0`, `q_1`, … in breadth-first order
  from the start state (alphabet order for ties), dropping `mergedFrom` → kind `DFA`, name
  `printRegex(regex)` → lay out with the Tidy layout (`layout/layoutClient.ts`) → add as a new
  automaton and open it. A pure core function does everything but the layout and the store.
- Refusal: invalid text → the parse error (with caret, as now); past `MAX_DFA_STATES` (64) → the
  existing DFA-size reason, shown under the input (no caret) and as the button's title. An NFA cap
  stays only as a guard against absurd input (regex length), not as the user-facing limit.
- Removed: the `thompson` trace kind, `ThompsonTraceView`, `thompsonLayout.ts`, Save and convert to
  DFA, `startThompson`, the toolbar's "Save the NFA first" lock, `traceSourceId`'s `thompson` case
  (keep the helper if the `eliminate` kind still needs it), their tests and CSS, the e2e steps that
  used them.

### 2. To regex: more rewrites

Applied whenever a label is built (`core/regexSimplify.ts`), on top of the existing rules:
`ε|rr*` = `ε|r*r` = `r*`; `(ε|r)*` = `r*`; `r*r*` = `r*`; `(ε|r)r*` = `r*(ε|r)` = `r*`;
`r|r*` = `r*` (union branches compared by printed text; order-independent). Exact-string tests:
`a*b*` (minimal complete DFA, with its dead state) → `a*b*`; plus the existing ends-in-1 pin,
updated if it simplifies. The language property test keeps guarding soundness.

### 3. Create menu

Create (same test id and accessible name) opens a menu with **Blank automaton** (creates as Create
did) and **From regex…** (opens the dialog), built like `ImportMenu`. The ▾ button is removed. The
empty canvas keeps its "or build one from a regex" link. Tests and e2e that pressed Create click
Blank automaton after it.

### 4. Docs

README, Controls rows, CLAUDE.md, PROGRESS (Done entry for this rework; the Thompson walkthrough
lines corrected) and the first regex spec (a note pointing here).

## Left to the builder

Exact dialog wording beyond the button label, the regex-length guard value, menu styling within the
theme.
