# Regex: regex → NFA and NFA → regex

Agreed in chat 2026-11-17. Extends the main design spec (`2026-10-28-automotion-design.md`, which
listed "Regex → NFA (planned later)"); this document wins where they disagree.

## Intent

AutoMotion is for students learning automata. They can already watch an NFA become a DFA and a
DFA get minimized, one explained step at a time. The other classic conversions of the course, a
regular expression into an NFA and an automaton back into a regular expression, have no place in
the app. This adds both, as walkthroughs in the same style: the point is to **watch the
construction happen**, the way the lecture draws it, not just to get the answer.

- **Regex → NFA**: type a regex, watch Thompson's construction build the NFA piece by piece,
  save it. From there the existing Convert to DFA and Minimize take over, so a student can follow
  regex → NFA → DFA → minimal DFA in one sitting.
- **NFA → regex**: take the open automaton (DFA or NFA), watch state elimination remove its
  states one at a time, and end with a regex to copy. The order of elimination changes the regex
  you get (a common exam point), so the student may pick the next state to remove.

## Goals

- Both directions are walkthroughs in the trace player: every step explained in words, the parts
  it concerns highlighted, step back and forth, scrub, play.
- The regex syntax is the course's: `|` union, `+` one or more, `*` zero or more, concatenation by
  juxtaposition, parentheses, `ε` and `∅`.
- The Thompson walkthrough looks like the textbook drawing: concatenation left to right, a union's
  branches stacked, a star's ε-arrows looping over and under. Nothing moves between steps.
- State elimination works on the student's own drawing (their positions), and the regex it ends
  with is readable: the obvious ε / ∅ clutter removed, but recognisably what the method produces
  by hand.
- Every result is right: the NFA accepts exactly the regex's language, and the regex exactly the
  automaton's (property-tested both ways).

## Non-goals

- Programming-regex features: character classes, `?`, `{n,m}`, `.`, anchors, escapes.
- Simplifying the result to a shortest or "nicest" regex, or checking two regexes for
  equivalence.
- Regexes as saved objects: the NFA a student saves is named after its regex and that is what
  persists. No file-format or share-link change.
- Lessons for regex. They are a follow-up task (PROGRESS.md, Ideas), designed once this lands.
- Other constructions (Glushkov, Sipser's variant, Arden's lemma). Thompson and state elimination
  were chosen; nothing here needs to make room for the others.
- LaTeX export of a regex, and editing the diagram of a walkthrough.

## Anti-goals

- A result that doesn't look like the method. If the NFA were laid out by Tidy so that a union's
  branches no longer stack, or the regex were rewritten past recognition, the walkthrough would
  be correct and useless for learning.
- Steps that move things. Stepping back and forth must keep every state where it was.
- Anything always on screen when no walkthrough is open (the no-persistent-tip rule): the new
  entry points are a menu item, a toolbar button, and a line on the empty canvas.
- Slowing the common path: Create still makes a blank automaton in one click.

## Constraints

- `core/` stays pure TypeScript with no React; the parser, both constructions and the Thompson
  layout live there. Traces are computed eagerly into immutable step snapshots, with a `can*`
  guard returning a user-facing reason or `null`, like `run.ts`, `subset.ts`, `minimize.ts`.
- `Automaton` symbols are single characters (`addAlphabetSymbol`) but may be any character but
  `,`, including `(`, `*`, `|`.
- Every trace today has a `source: Automaton` and is shown over the active automaton, which is
  locked for editing while it is open (`store.edit` etc. refuse while `trace` is set);
  `setActive` closes it. Regex → NFA has no source automaton.
- `Diagram` draws an edge's label as `symbols.join(',')` in IBM Plex Mono; its `data-testid`s
  are a contract. Edge label width comes from `EDGE_LABEL_CHAR_WIDTH` per character.
- Lesson texts and player behaviour (`lessonStopAt`, `pausedConvert`, `TraceExtraActions`'
  in-lesson check on `trace.source.id`) must keep working for the existing trace kinds.

## Approaches

For the Thompson walkthrough's picture (the main open choice):

1. **Final layout revealed piece by piece** (chosen). Lay the finished NFA out once from the
   regex's structure, then each step reveals one piece in its final place, inner pieces first.
   Stable when stepping back, reads like the textbook. Costs a small dedicated layout routine;
   long regexes give wide diagrams (Fit and pan handle that).
2. **Tidy the finished NFA, then reveal.** Reuses the worker layout at no cost, but Tidy optimises
   crossings, not structure: a union's branches needn't stack, so "this box is `a|b`" is lost.
3. **Separate pieces, slid together.** Each subexpression its own small NFA, a step slides two
   together and adds the glue. The most literal, but it needs animated motion between steps
   (nothing like it exists) and stepping back gets messy, for little over 1.

Chosen: 1. Elimination order: automatic, with an optional pick by clicking (chosen over automatic
only, which hides the order's effect, and pick-only, which makes Play impossible).
State elimination itself has one sensible picture: the student's own diagram.

## Design

### 1. Regex syntax (`core/regex.ts`)

Grammar, loosest to tightest:

```
union   := concat ('|' concat)*
concat  := postfix+
postfix := atom ('*' | '+')*
atom    := symbol | 'ε' | '∅' | '(' union ')'
```

- A **symbol** is any single character except `| + * ( ) ε ∅ \ ,` and whitespace. Whitespace is
  ignored between tokens (`a b` is `ab`).
- `\eps` types ε and `\emptyset` types ∅, normalised live as in symbol inputs
  (`normalizeSymbolText`, `normalizeStateLabel`).
- Postfix operators stack (`a*+` is legal and means `(a*)+`).
- Errors are values, never throws: `{ ok: false, error, at }` with a character index and a short
  message: "Nothing to repeat before *", "Missing )", "Unexpected )", "Nothing after |", "Empty
  ( )", "Type a regex", "Unknown \\ command". The AST keeps each node's source span
  (`start`, `end`) for the walkthrough's highlight.
- `printRegex(ast)` writes a regex back with the fewest parentheses its precedence needs; both
  the elimination result and the saved NFA's name use it. `parse(print(r))` is `r` (property
  test).
- Size cap: an NFA past `MAX_THOMPSON_STATES` (64, like `MAX_DFA_STATES`) is refused before
  building: "Too long to draw: this regex needs N states (at most 64)".

### 2. Thompson's construction (`core/thompson.ts`)

`canThompson(text): string | null` and `thompson(ast): ThompsonTrace`, built bottom-up in post
order (left operand before right, operand before operator). Every piece has exactly one start
and one accepting state. Rules:

| Node | Piece |
|---|---|
| symbol `a` | new start → new accept on `a` |
| `ε` | new start → new accept on ε |
| `∅` | new start, new accept, no arrow |
| `rs` | ε-arrow from r's accept to s's start; start r's, accept s's |
| `r₁\|…\|rₙ` | new start, ε into every branch's start; ε from every branch's accept into a new accept |
| `r*` | new start, new accept; ε start→r.start, r.accept→accept, r.accept→r.start (back), start→accept (skip) |
| `r+` | as `r*` without the skip arrow ("like star, but it must pass through r once") |

A union is one node with all its branches (`a|b|c` is one fan of three, 8 states and 4 build
steps, not `(a|b)|c`; chosen in chat), built in one step once its branches are. A concatenation
of several operands is left-associative (`abb` is `(ab)b`), one step per join, joined by an
ε-arrow, never by merging states (chosen in chat).
States are named `q_0`, `q_1`, … in creation order, so the numbers follow the build.

Steps:

- `intro`: the regex, nothing drawn; explains that each part becomes a small NFA with one start
  and one accepting state, built from the inside out.
- one `build` step per AST node, with `node` (its span), `pieceStates` (every state of this
  piece), `newStates`, `newTransitions`, and the piece's `start` and `accept`. Explanation names
  the node in the regex and says what was added ("`a|b`: a new start state with ε-moves into
  both pieces, and ε-moves from both their accepting states into a new accepting state").
- `done`: the whole NFA with its start and accepting state.

`ThompsonTrace = { kind: 'thompson'; regex: string; result: Automaton; steps: ThompsonStep[] }`,
no `source`. `result.kind` is `'NFA'`, its name `printRegex(ast)`, its alphabet the regex's
symbols. Example: `(a|b)*abb` gives 10 build steps and 14 states.

### 3. Thompson layout (`core/thompsonLayout.ts`)

Structural, recursive, deterministic: each piece is a box with its start on the left edge and its
accept on the right edge, both on the box's middle line.

- symbol / ε / ∅: two states one `GAP` apart.
- concatenation: the boxes side by side, one `GAP` between r's accept and s's start, middle lines
  aligned.
- union: new start left, all branches' boxes stacked vertically, aligned left and right (a short
  branch's arrow stretches to the widest), new accept right.
- star / plus: new start left, the operand's box, new accept right; the back arrow
  (r.accept → r.start) bent over the box, the skip arrow (start → accept) bent under it, both
  with `bend` set so they clear the box.

`GAP` and row spacing come from the state radius in `core/geometry.ts` so edge labels fit
(at least one label's clearance). The result is written into the `x`/`y` of `result`'s states and
the `bend` of its arrows; the layout worker and Tidy are not used. A test checks that no two
states overlap and no arrow passes through a state (`transitionPolyline` against every state
circle) for a set of sample regexes.

### 4. The Thompson walkthrough view (`ui/player/ThompsonTraceView.tsx`)

- Above the diagram, the regex in IBM Plex Mono, with the current step's span highlighted in the
  run orange; spans of pieces already built are tinted.
- The diagram is `result` with `visibleStates` / `visibleTransitions` limited to the states and
  arrows built so far. The current piece's start gets the start arrow and its accept the double
  ring (the view passes `{ ...result, starts: [start], accepting: [accept] }`), so each step
  shows "one start, one accepting state". New states and arrows are highlighted
  (`active` / `taken`).
- A dashed rounded frame around the current piece's states, drawn by the view over the diagram
  with the viewport transform (never exported).
- Opens playing, like Convert to DFA.
- Last step: **Save as new automaton** (adds `result`, opens it, closes the trace) and **Save and
  convert to DFA** (adds it, then `startSubset`), hidden in lessons and when `canConvert` refuses.

The trace opens over whatever automaton is active, which stays locked while it is open; closing
it without saving returns to that automaton. Every place that reads `trace.source` must handle
the source-less kind (`TraceExtraActions`' lesson check: a Thompson trace is never a lesson's).

### 5. Entering a regex (`ui/shell/RegexDialog.tsx`)

- **Create** in the history bar becomes a split button: the main part creates a blank automaton
  as today (name, test id and title unchanged); a ▾ beside it opens a menu with **From regex…**.
- The empty canvas's hint gets one more line, "or build one from a regex", a link button opening
  the same dialog.
- The dialog: one input in IBM Plex Mono with live `\eps` / `\emptyset` normalisation, a one-line
  syntax reminder (`| or, + one or more, * any number, ε as \eps, ∅ as \emptyset`, each operator
  and command in a chip: no separator that reads as an operator), and under the input, while
  invalid, the error with a caret under the offending character, or, when it parses but needs too
  many states, that reason without a caret. **Build NFA** is disabled with the error as its
  reason; Enter builds; Escape cancels. Styled like `PasteLatexDialog`.

### 6. State elimination (`core/eliminate.ts`)

`canEliminate(a): string | null` refuses with a reason: no states, no start state, or a symbol
that would read as regex syntax ("To regex can't write the symbol '(': rename it"; the characters
excluded from regex symbols above). An incomplete DFA, unreachable states and a missing accepting
state are all fine (no accepting state gives `∅`).

`eliminate(a, order?: StateId[]): EliminateTrace`. `order` is a prefix: the states to remove
first, in that order; the rest follow the automatic order.

The working automaton at each step is an `Automaton` whose arrows' single "symbol" is a regex
label string (a GNFA), so `Diagram` draws it unchanged.

Steps:

- `gnfa`: adds a new start state `s` with ε-arrows into every start state (handles several start
  states) and a new accepting state `f` with ε-arrows from every accepting state, which stop
  accepting; each arrow's symbols become one label joined by `|` (`0,1` → `0|1`). `s` sits left of
  the drawing at the start states' mean height, `f` right of it at the accepting states' mean
  height; every original state keeps its position. Explains that missing arrows count as ∅.
- per removed state `q`, two steps:
  - `pick`: `q` highlighted with its incoming and outgoing arrows; lists the paths `p → q → r`
    it lies on.
  - `remove`: `q` gone; each pair `(p, r)` with `p → q → r` gets
    `R(p,r) | R(p,q) R(q,q)* R(q,r)` (the first term only if that arrow exists, `R(q,q)*` only
    if `q` has a loop; `p = r` gives a loop on `p`). The new or changed arrows are highlighted;
    the explanation shows each formula filled in (at most three, then "and N more").
- `done`: only `s → f` remains; its label is the regex (`∅` when no arrow is left). The view
  shows it large under the diagram with a **Copy** button (`regex-copy`).

**Automatic order:** remove next the state that creates the fewest new arrows (in-degree ×
out-degree, not counting its loop), ties broken by the shorter total label length, then by the
order in `a.states`.

**Size** (my call): labels can grow exponentially with the number of states. `eliminate` throws
once any label passes `MAX_REGEX_LENGTH` (2000 characters), like `subsetConstruction` past
`MAX_DFA_STATES`: To regex reports it as a toast ("The regex grows past 2000 characters: try a
smaller automaton"), and a pick that would throw keeps the current trace and shows the same toast.
On the diagram an arrow label longer than 40 characters is drawn cut short with `…`, the full
label in its native tooltip; the explanation, the done panel and Copy always have the full text.
Property tests use automata of at most 5 states.

**Simplification**, applied whenever a label is built, and nothing else: `εr = rε = r`,
`∅|r = r|∅ = r`, `∅r = r∅ = ∅`, `ε* = ∅* = ε`, `(r*)* = r*`, `r|r = r` (equal printed text),
and printing with minimal parentheses. A label is an AST internally and printed for display.

### 7. Picking the order

- While the player is paused on a `gnfa`, `pick` or `remove` step that is not the last, clicking a
  state of the source automaton that hasn't been removed yet makes it the next state removed: the
  trace is recomputed with `order` = the states removed before the next `pick` plus the clicked
  one (on a `pick` step, the clicked state replaces the current pick), and the player jumps to
  the new `pick` step. Steps after it change; steps before stay identical.
- Clicking `s`, `f`, a removed state or anything during play does nothing.
- The `pick` step's explanation ends with "Click another state to remove it first instead."
- The store needs `replaceTrace(trace, stepIndex)` (keeps the trace open, swaps it, sets the
  step) alongside `openTrace`.
- Opens paused, like Minimize: the first decision is the student's.

### 8. Entry point for NFA → regex

A **To regex** button in the toolbar after Minimize (`to-regex`, with an icon for the narrow
toolbar like its neighbours), disabled with `canEliminate`'s reason as its title. Not offered on
the done step of other walkthroughs.

### 9. Docs and help

- Controls (`help.ts`): rows for From regex… and To regex, and the syntax line.
- README: a short "Regular expressions" feature section; PROGRESS.md: tick Regex → NFA, add
  NFA → regex, and keep "Lessons for regex" under Ideas.

### 10. Tests

- Parser: precedence, spans, every error message and position; `parse(print(r)) = r` with
  fast-check regex arbitraries (`core/testing/arbitraries.ts`).
- Thompson: the NFA accepts exactly the words a reference matcher does (a JS `RegExp` built from
  the AST, `ε` as empty, `∅` as `[^\s\S]`), on all words up to length 6 for random regexes; state
  and step counts for fixed examples; layout overlap and clearance checks.
- Elimination: for random automata (existing arbitraries), the regex's Thompson NFA accepts
  exactly the automaton's words up to length 6, with automatic and random orders; the order
  prefix is respected; simplification rules each tested.
- Components: both views render their steps, the regex highlight, the Copy button, picking
  recomputes.
- e2e (`e2e/regex.spec.ts`): From regex… → walkthrough → Save as new automaton; Save and convert
  to DFA; To regex on a fixture, pick a state while paused, copy the result; a parse error shown
  in the dialog.

## Left to the builder

- Exact explanation wording within the style of the existing walkthroughs.
- `GAP`, frame padding and the icon for To regex.
- How the regex span highlight and the Copy button are styled, within the theme tokens.
- Splitting the work into tasks and their order.
