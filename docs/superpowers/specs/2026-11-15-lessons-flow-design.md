# Lessons that explain

Agreed in chat 2026-11-15, on PR #75 (branch `worktree-lessons-design`). Amends the lessons spec
(`2026-11-15-lessons-design.md`); this document wins where they disagree.

## Intent

Taking the lessons as built, the user found them hectic and not explaining anything: the card holds
too much (a goal picture of the automaton already on the canvas, examples, a progress bar, two lines
of text), a "Watch: …" step is on the card for one 800 ms tick, the breathing frame points at the
word box although Basics taught running a word, and runs play fast with the explanation only
after the fact. In the user's words: "if you show someone an NFA for the first time, you would give
them an intuition first before spamming them with transitions and flashy moves."

So a lesson teaches the way a TA would: **the intuition first, in plain words, before anything
moves; then one small thing at a time; and at each moment, what just happened and why.**

## Goals

- Every concept lesson (NFAs, ε-moves, Convert, Minimize) opens with an **idea step**: two or three
  sentences of intuition and a **Next** button, nothing to do in the app.
- Nothing is on the card only while something plays: each step stays until the user can read it.
- The card holds less: no goal picture outside Basics, no examples that the lesson never uses.
- No hand-holding for what Basics taught: no frame on the word box, the dock or Esc outside Basics.
- **NFAs** teaches guessing (several arrows on one letter, branches that die), stepped by hand.
- **ε-moves** is a new lesson right after NFAs, also stepped by hand.
- The Controls popup has one way to the lessons, not two.

## Non-goals

- Changing Basics: its steps, texts, goal pictures and pointer stay exactly as they are; its unit
  and e2e tests pass unchanged.
- Changing Share and export beyond the card's goal row (it teaches no theory, so it gets no idea
  step; its frame on the menu stays, since the menu is new to the user).
- Changing the walkthroughs' own explanation lines: Convert and Minimize already explain every step
  in the player; the lessons stop at a few moments and give the bigger picture.

## Anti-goals

- A card that grows back: the idea text replaces the goal picture's space, it doesn't add to it.
- Steps that teach the UI instead of the idea ("press Run", "press Esc" with a frame) outside Basics.
- Long lessons: still at most 6 steps, idea step included.
- Anything shown when no lesson runs (the no-persistent-tip rule still holds).

## Approaches

Where the intuition lives:

1. **An idea step on the card** (chosen): the first step is the text and a Next button. One place to
   look, the same progress bar, the text is gone once read, so the card stays small.
2. An intro popup when the lesson starts: room for more, but a modal and a context switch before
   the card starts over.
3. The intuition in the goal line for the whole lesson: no click, but the card holds more, which is
   the complaint.

Pacing of a run or walkthrough (user's choice per lesson):

- **NFAs and ε-moves: stepped by hand.** The run opens paused; each step says "Press [→]" and, once
  it is reached, explains what changed. The user sets the pace.
- **Convert and Minimize: it plays and stops** at each moment worth explaining (today's `pauseAt`
  mechanism, with more stops and a real explanation at each), because their walkthroughs already
  explain every step in words.

## Design

### The idea step

- A new kind of step: `idea: true` (or a separate spec type; builder's call). Its instruction is the
  intuition (up to ~3 sentences, at most 240 characters, same markup), it has no why line and no
  target, and the card shows a **Next** button under it (`data-testid="tutorial-next"`, accessible
  name "Next"). Next latches the step (e.g. through the existing action mechanism with a
  `'next'` action, reset per lesson like the others).
- Next must not take focus away in a way that breaks the canvas shortcuts afterwards: after the
  click, focus goes back where the card's other buttons leave it today (the card never keeps focus).
  [Enter] on the focused button works; no new global shortcut.
- It counts as a step in the progress bar and the "Step n of m" header.
- While the idea step is on the card, the goal row is hidden (the idea is the context); it appears
  from step 2 on.

### The goal row

- `Goal.automaton` becomes optional. Lessons other than Basics don't set it, and the goal row then
  shows only the goal text and the examples, on one line where they fit. `Goal.after` is removed
  (Convert was its only user), along with the wide-picture layout.
- Examples are shown only when the lesson runs words; Convert, Minimize and Share have none.

### Pointer

Outside Basics, steps target only controls the user hasn't met: Convert to DFA, Minimize, Save as
new automaton (the button itself, not the dock), and Share's menu. No target on the word box, the
dock or for Esc.

### No step lives only while something plays

The step that opens a trace stays on the card until the trace pauses at its first stop: its latch
is "reached the first stop", not "opened". The "Watch: …" steps are gone. While a step is on the
card, its `pauseAt` gives the stop; the next step is on the card while paused there, explains it,
and says what to press.

### Cards that explain a moment (my call, after the builder check)

A card that is up while a run or walkthrough is paused at a moment (both pacing kinds, all four
concept lessons) leads with the explanation: a new optional `explain` on the step, shown first, in
the instruction's size and normal ink (not the muted why style), at most 140 characters. The
instruction ("Press [→] to read the `1`.", "Press Play.") follows as the second line. Such a step has
no why line. In the lesson lists below, "Paused at k." cards give the instruction first and the
explanation after the slash; Convert and Minimize give the explanation (in quotes) first: in both,
the explanation is `explain` and "Press …" is the instruction. The test that the step after a
`pauseAt` starts with "Press Play" becomes: its instruction starts with "Press".

### Starting early (my call, after the builder check)

If the user opens the trace while the idea step is still up (runs `001`, presses Convert to DFA),
the idea step looks ahead: `lessonStopAt` and the hand-step flag use those of the first step after
the idea step, so the run still opens paused and the walkthrough still stops. Pressing Next then
latches only what has happened, and the card lands on the moment the trace is paused at.

### Stepping by hand (NFAs, ε-moves)

- The run a hand-stepped lesson asks for opens **paused** at its first step (e.g. a step flag
  `handStep: true` on the run step, read by `App.tsx` through the tutorial store the way
  `lessonStopAt` is, to pass `autoPlay={false}`; builder's call on the shape).
- Each following step is "Press [→] …" and latches when `stepIndex` reaches its index; it also sets
  `pauseAt` to that index, so Play or Space still stops at every explained moment instead of
  running to the end. Stepping back with [←] while the run is open takes the card back with it
  (`steppedBack`; changed after user feedback: a card left ahead of the run explained a moment not
  on screen). Closed, or with another word running, finished steps stay done.
- A run of another word, or of the right word that was left: the existing "That was `x`" hint and
  `first` hints handle it, as now.

### The lessons

Order in the list: Basics, NFAs, ε-moves, Convert, Minimize, Share and export. `LessonId` gains
`'epsilon'`. Wording below is a draft within the caps (instruction 100 characters, why 110, idea
240); the builder may tighten it. Each "→" step's text names what the user sees after pressing.

In the two hand-stepped lessons, each card after the run opens is the one up **while the run is
paused at index k**: its why line says what happened on reaching k (what the user is looking at),
its instruction says what the next press does, and it latches when the index passes k.

**NFAs** (replaces the a\*b\* lesson). Opens an NFA for *words ending in `01`*: q₀ start, loop on
0,1; q₀ –0→ q₁; q₁ –1→ q₂; q₂ accepting. No ε. Goal: "This NFA accepts words ending in `01`. Watch it guess.", no examples (changed after
user feedback: three chips in a row read as a jumble, and `010` is never run).
The run of `001` is start {q₀}, read 0 → {q₀,q₁}, read 0 → {q₀,q₁} (q₁'s branch dies, q₀ guesses
again), read 1 → {q₀,q₂}, verdict accept: indices 0–4 (no ε, so no closure steps).

1. Idea: "An NFA can have several arrows on one letter, or none. Think of it as guessing: it follows
   every guess at once, and accepts if any guess ends in an accepting state." [Next]
2. Run `001`. (latch: an owned run of `001` is open; it opens paused at index 0)
3. Paused at 0. Press [→] to read the first `0`. / It starts in «q_0», with nothing guessed yet.
4. Paused at 1. Press [→] to read the second `0`. / From «q_0», a `0` can stay in «q_0» or move to
   «q_1». It follows both, so it's in both at once.
5. Paused at 2. Press [→] to read the `1`. / «q_1» had no arrow on `0`, so that guess died; from
   «q_0» it took both arrows again.
6. Paused at 3. Press [→] for the verdict. / The guess in «q_1» read `1` and reached «q_2».

Closing (up at the verdict): "One guess reached an accepting state, and one is enough: an NFA
accepts if any guess does."

**ε-moves** (new, `'epsilon'`, ~1 min). Opens the current a\*b\* NFA (q₀ start, loop on a; q₀ –ε→ q₁;
q₁ accepting, loop on b). Goal: "This NFA accepts some a’s, then some b’s. Watch the ε-arrow.", no examples. The run of `b` is start
{q₀}, ε-closure → {q₀,q₁}, read b → {q₁}, verdict accept: indices 0–3.

1. Idea: "An ε-arrow moves without reading a letter. The NFA takes it for free, so whenever it can
   reach a state by ε, it is in that state too." [Next]
2. Run `b`. (latch: open; it opens paused at index 0)
3. Paused at 0. Press [→] to follow the ε-arrow. / It starts in «q_0» and hasn't read anything yet.
4. Paused at 1. Press [→] to read the `b`. / It took the ε-arrow for free: it's in «q_0» and «q_1»
   before reading a letter.
5. Paused at 2. Press [→] for the verdict. / «q_0» has no arrow on `b`, but «q_1» does: no `a` was
   needed.
6. At the verdict. Press [Esc], then run `ba`. / It ended in «q_1», which accepts. (run step: `ba`
   rejected; it plays by itself, stuck on the `a`)

Closing: "ε costs nothing: the NFA is in every state it can reach by ε-arrows, before and after each
letter."

**Convert NFA → DFA** (same "Contains 01" NFA). Goal: "Turn this NFA into a DFA", no examples, no
picture. Walkthrough stops: index 1 ({q₀,q₁} appears, the first new state) and index 4 ({q₀,q₂},
the first accepting one); then the end (index 9).

Changed after user feedback (the idea lacked the "every NFA has a DFA" fact; the card and the
player line were two places to read; the card's height change made the diagram jump): the card
explains and points at the line below the walkthrough, which drops "ε-closure" when the NFA has no
ε-arrows (`core/subset.ts`); the card keeps one height while a lesson's trace is open
(`data-tracing`, a 190 px minimum) and the trace's top padding only grows while one trace is open.

1. Idea: "Every NFA has a DFA that accepts exactly the same words. A DFA can't guess, so each of its
   states is a set: all the NFA states you could be in after the same input." [Next]
2. Press Convert to DFA at the top. (frame on the button; latch: paused at index 1)
3. Press Play. (latch: index 4) Its explanation follows the walkthrough: before index 1, "The DFA
   starts in «{q_0}»: before reading anything, the NFA can only be in «q_0»."; at index 1, "Below, it
   follows `0` from «{q_0}»: «q_0» can stay or move to «q_1», so the new DFA state is
   «{q_0,q_1}»."; between the stops, "Below, it follows each symbol from each set: a set it already
   has is reused, a new one becomes a state."
4. Press Play to finish. (latch: last step) At index 4: "Below, `1` from «{q_0,q_1}» leads to
   «{q_0,q_2}». It holds «q_2», which accepts, so this DFA state accepts too."; after it, the
   between-stops text.
5. "Every set the NFA can reach is now a state: four in all." / Press Save as new automaton to keep
   the DFA. (frame on the Save button; latch: saved)

Closing as now.

**Minimize a DFA** (same 4-state DFA). Goal: "Make this DFA as small as possible", no examples, no
picture. The walkthrough opens paused at the partition (index 0); stops: the split (index 1), the
end (index 2).

1. Idea: "Two states are the same if no word can tell them apart: from both, every word is
   accepted or rejected alike. Minimizing merges such states." [Next]
2. Press Minimize at the top. (frame; latch: open, paused at index 0)
3. "It starts with two groups: accepting and not. A word ending in each already tells them apart."
   / Press Play. (latch: index 1)
4. "On `1`, «{q_0}» stays out of accepting but «{q_0,q_1}» gets in, so they split." / Press Play.
   (latch: last step)
5. "No symbol tells «{q_0,q_2}» and «{q_0,q_1,q_2}» apart, so they merge." / Press Save as new
   automaton to keep the smaller DFA. (frame on Save; latch: saved)

Closing as now.

**Share and export**: the goal row loses its picture. Changed after user feedback (the frame stayed
on the menu after it was used, the LaTeX step offered two choices, and nothing said what the copied
picture is for): only the first step (Share link) frames the menu; the LaTeX step is "Open Share,
copy or export again and choose Copy LaTeX." (action `copy-latex` only) and leads with "Copied:
paste it into notes, slides or a chat and you get a picture of the automaton."; the closing card is
"Copied as TikZ: paste it into a LaTeX document and it draws the automaton as on the canvas."

### Away from the lesson, and after the tutorial (user feedback)

- While another automaton is open (or a trace of one), the card is hidden entirely, instead of
  saying "You're on …" with a link back. It comes back on the lesson's own automaton (picked in the
  history bar). The lesson keeps running.
- The popup after Basics doesn't offer "Next: …". It says "More lessons, on NFAs, converting and
  minimizing, are in the Lessons tab: press ?." (`more-lessons`). The other lessons still offer Next.

### Controls popup

The header's **Lessons** button goes; the **Lessons** tab stays as the one way in (last in the tab
row). `ControlsDialog.test.tsx` and any e2e that clicks the header button are updated.

### Spec and docs

- The lessons spec's *The first lessons*, *Playback* and the Goal/`after` paragraph are superseded
  by this document; update them (or point here) so `CLAUDE.md`'s "binding when unclear" spec stays
  true. `CLAUDE.md`'s tutorial notes and `PROGRESS.md` follow.
- The step-count cap (6, idea step included) and the text caps stay; the text-length test gains the
  240-character cap for idea steps.

## Testing

- Engine: the idea step latches only on Next; a hand-stepped run opens paused and each step latches
  at its index; Play stops at every explained index; ← takes the card back while the run is open.
- Each lesson: its unit test walks every step on fixture contexts (as `testLesson.ts` does today),
  checks its goal examples against its start automaton, and the caps.
- Card: no goal picture outside Basics; goal row hidden on the idea step; Next button present only on
  idea steps.
- e2e: `lessons.spec.ts` takes every lesson, ε-moves included, to Finish; `tutorial.spec.ts`
  unchanged.

## Left to the builder

- The idea step's exact shape in `StepSpec` and how Next latches.
- How a hand-stepped run opens paused (flag shape, where `App.tsx` reads it).
- Final wording within the caps.
- The Save button's selector for the frame.
