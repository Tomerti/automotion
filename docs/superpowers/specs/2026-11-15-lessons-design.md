# Lessons

Agreed in chat 2026-11-15. Extends the tutorial spec (`2026-10-29-tutorial-design.md`); this
document wins where they disagree.

## Intent

The tutorial teaches the basics in two short parts. Everything else (NFAs, converting,
minimizing, sharing and exporting) has no guided path: a third part that converted and minimized
was built and reverted (`660e16b`) because it made the tutorial long and tedious, and every later
feature (regex → NFA, Turing machines, plain text → automaton, checking an automaton against a
language) would make it longer still.

So the tutorial stays as it is, and the rest is taught by **lessons**: a list of short,
independent, interactive lessons, each teaching one feature, taken in any order, whenever someone
wants it. The current tutorial becomes the first lesson, **Basics**.

Lessons are for students who know the theory and want the app, and for students still learning
it. Each step says what to do in the app; the line under it gives the reason in the theory, in one
sentence, so the first group can skim it and the second learns from it.

## Goals

- A lesson takes about a minute: at most 6 steps, starting from an automaton it loads itself, so
  nobody draws before the point of the lesson.
- Lessons look and behave like the tutorial: the same coach card, goal row, pointer, live checks,
  hints and fallback.
- Adding a lesson later (regex → NFA, TM, …) means writing a step table and a starting automaton,
  not new UI.
- Every why line explains, not names: "A DFA can't guess, so each of its states stands for every
  NFA state you could be in: here {q₀, q₁}", not "Each DFA state is a set of NFA states".

## Non-goals

- Lessons for features that don't exist yet (regex, TM, language checking): the engine should not
  stand in their way, but they aren't designed here.
- A reference manual or help pages: the Controls popup stays the reference.
- Saving progress inside a lesson: a reload ends it, as with the tutorial.

## Anti-goals

- Lessons that grow long. If one needs more than 6 steps, it is two lessons.
- Lessons that repeat what the walkthroughs already explain: Convert and Minimize explain every
  step in words, so a lesson points there instead of copying it.
- Anything that stays on screen when no lesson is running (see the no-persistent-tip rule): the
  list lives in the Controls popup, the only nudge is in the popup after a lesson.
- Any change to how Basics behaves. Its unit and e2e tests must pass unchanged, apart from the
  imports and names the refactor moves.

## Approaches

1. **Turn the tutorial into a lesson engine** (chosen). A lesson is data; the store, card,
   pointer, hints and latching work on whichever lesson is open; Basics is ported as the first
   lesson. Costs a refactor up front (the code assumes parts 1/2/3, `COUNTED_STEPS = 15`,
   `PART_TITLES`), then each lesson is cheap.
2. A second, simpler engine for lessons beside the untouched tutorial. No risk to Basics, but two
   coach cards that drift apart, every fix twice, and Basics doesn't sit naturally in the list.
3. Lessons without checking: load an automaton and show steps the user ticks. Cheap, but drops the
   live checks and pointer that make the tutorial work, while walkthrough steps are easy to check.

Chosen: 1, because lessons will keep coming with new features and each should cost a step table.

## Design

### What a lesson is

```ts
interface Lesson {
  id: LessonId;              // 'basics' | 'convert' | 'minimize' | 'nfa' | 'share'
  title: string;             // in the list and the card's header
  summary: string;           // one line in the list
  minutes: number;           // "~1 min" in the list
  /** The automaton it opens on; null: a blank DFA (Basics). */
  start: Automaton | null;
  parts: LessonPart[];       // Basics has 2, the others 1
  closing: string;           // the closing card's text
}

interface LessonPart {
  title: string;
  goal: Goal;                // the goal row
  /** What the part achieved, on the hand-over panel; only parts followed by another. */
  done?: string;
  steps: StepSpec[];
}
```

> Superseded: the `after` picture is gone; only Basics shows goal pictures. See `2026-11-15-lessons-flow-design.md`.

`Goal` (today's: text, examples, picture, description) gains an optional `after` picture, for
lessons that turn one automaton into another (Convert: the NFA → the DFA). A goal with `after`
shows only that target picture, in a full-width row of its own: the start automaton is already on
the canvas, so showing both made them too small to read (controller ruling R7). `examples` may be empty (Share and export has none).

Step specs stay as today's `StepSpec`, with one more way to complete. A step is done by:

- **a check** on the automaton (`done`, or `edges`), as now;
- **a run** reaching its verdict (`run`), latched, as now;
- **a latch** (`latch(ctx)`): something that comes and goes (a walkthrough opening, reaching a
  step or its end) and stays done once seen. This is the reverted part 3's `latch`, revived;
- **an action** (`action`): something that leaves no trace in the state (a link copied, a picture
  exported), latched when the action is reported (see *Actions*).

Step ids are namespaced per lesson (`convert/open`); `StepId` becomes a string.

### The engine

- `advance`, `toStep`, `runSucceeded` and the generic hints (the "elsewhere" hint, "First, press
  Esc", the part hand-over, "That was `11`") move to an engine module and take the lesson as an
  argument. Basics' own hints (`part1Hint`, `nfaHint`, `PART1_EDGES`, the names) move into the
  Basics lesson.
- The store holds `lessonId` beside today's fields; `startLesson(id)` replaces `startTutorial()`
  (kept as `startLesson('basics')`), `quitLesson`, `finishLesson` likewise.
- The card reads titles, goals, the hand-over text, the counted steps and the closing text from
  the open lesson. Basics keeps every word of today's card: "Part 1 of 2 · Step 3 of 11",
  "Tutorial · Done", "End tutorial", "Quit the tutorial?", "Back to Tutorial". The other lessons
  use lesson wording: "{title} · Step 2 of 4", "{title} · Done", "End lesson", "Quit the lesson?
  {its automata} will be removed from your history.", "Back to {automaton name}".
- Test ids (`tutorial-card`, `tutorial-step`, …) and the card's look stay as they are for every
  lesson: e2e and the tutorial's tests rely on them. The folder stays `ui/tutorial/`; lessons go
  in `ui/tutorial/lessons/`, one file each, with `index.ts` listing them in order.

### The lesson's automata

- Basics opens on a blank DFA exactly as today (reusing an untouched Untitled, named "Tutorial").
- Another lesson adds a copy of its `start` automaton under a free name made from its own name
  ("Contains 01", "Contains 01 2", …), opens it and fits it below the card. As for Basics, an
  untouched "Untitled" is replaced by the copy, so no empty one is left behind (quitting still
  never leaves the canvas without an automaton).
- **Owned automata**: the lesson's automaton, plus any automaton saved from a walkthrough of an
  owned automaton while the lesson runs (Save as new automaton, Save and minimize). Being on an owned
  automaton, or having a walkthrough of one open, is not "elsewhere". This generalizes part 3's
  `derivedId`.
- Quitting midway removes every owned automaton (asking first, as now). Finishing keeps them.

### Playback

> Superseded: runs of the words in a lesson's `pausedRuns` now open paused, and playback stops where each step explains, with idea steps and `explain` text. See `2026-11-15-lessons-flow-design.md`.

Runs and conversions play as they open and minimizations open paused, in lessons as everywhere
else. A lesson instead pauses the player at the moment a step explains (changed 2026-11-15 on
user feedback: the first build opened lesson runs paused, so Run seemed to do nothing until Play):

- `TracePlayer` takes `stopAt?: number | null`: while playing, after stepping onto that index it
  pauses, as at the end. Play from there goes on; stepping and jumps ignore it. The interval holds
  the `stopAt` it stepped with, because reaching the index can move the lesson on (to a step with no
  pause point) before React re-renders.
- A step may have `pauseAt(ctx)`: the trace index to pause on while it is the step on the card. Such
  a step latches on reaching that same index, so while the player is paused the card shows the next
  step, which explains the moment and says to press Play (a test checks the "Press Play" part).
- `lessonStopAt(trace)` (tutorial store) is the current step's `pauseAt` for a run or walkthrough
  of an owned automaton while a lesson runs, else `null`; `App.tsx` passes it to the player.

### Editing

A lesson has `editable: boolean`: Basics `true`, the four lessons here `false`. While a
non-editable lesson runs, its owned automata can't be changed structurally (adding, deleting or
renaming states and arrows, the DFA/NFA switch, and undo or redo of such edits are refused,
through the store's read-only lock), so every latch can count on the automaton's shape: an edited "Contains 01" might never reveal {q₀, q₁}, an edited DFA might come
out "Already minimal" with no Save button. A blocked edit puts a plain-ink line on the card: "This
lesson's automaton is read-only: quit the lesson to change it." Runs, walkthroughs, selecting,
panning and layout changes still work: moving states, Tidy, and undo or redo of layout-only
changes (they change no latch). Future lessons that edit
(say, fixing a broken DFA) set `editable: true` and bring their own hints, as Basics does.

### Actions

Steps about sharing and exporting can't be checked from the state. The shell reports them:
`noteLessonAction(action)` in the lesson store, a no-op when no lesson runs, called by Share link,
Copy image (Ctrl+C with nothing selected, and the menu entry), Export SVG / PNG, Copy LaTeX and
Export LaTeX. The context gains `actions: ReadonlySet<LessonAction>`, reset when a lesson
starts. Only actions on an owned automaton count. An action counts when it is chosen, before the
clipboard call: a browser that refuses the clipboard already shows a toast, and the lesson
shouldn't get stuck behind it (e2e needn't grant clipboard permission either).

### Where lessons are found

- **Controls popup.** (Superseded: the header button is gone, the Lessons tab is the only way in. See `2026-11-15-lessons-flow-design.md`.) The header's "Take the tutorial" button becomes **Lessons** (an intended
  change: `ControlsDialog.test.tsx` and any e2e that clicks it are updated), which opens a
  new **Lessons** tab (last in the tab row, so `?` still opens on the controls). Each row: title,
  summary, "~1 min", and a ✓ once finished. Clicking a row closes the popup and starts it. The
  running lesson's row says **Restart**.

  ```
   Controls                       [Lessons] [x]
   Mouse · Keyboard · Runs · … · Lessons
   ───────────────────────────────────────────
    ✓ Basics            Build a DFA, run it   ~2 min
      Convert NFA → DFA The subset construction ~1 min
      Minimize a DFA    Merge equal states     ~1 min
      NFAs              ε and branches that die ~1 min
      Share and export  Links, pictures, LaTeX  ~1 min
  ```

- **After a lesson.** The "Tutorial complete!" popup becomes the popup for every lesson ("Lesson
  complete!" for the others), and gains a **Next: {first unfinished lesson}** button beside "Back
  to building" (none once all are done).
- The welcome dialog stays as it is: it offers Basics only.
- Starting a lesson while another one runs asks first (`askConfirm`: "Quit {title}? Its automata
  will be removed."), unless it is the same lesson (Restart, as today).
- On touch-only devices the Lessons tab says lessons need a mouse and keyboard, and its rows are
  disabled.

### Finished lessons

Saved as a list of lesson ids under `automotion:lessons-done`, apart from the automata (no file
format change, nothing in exports or share links). Finishing a lesson adds it. Reading it never
throws; a bad value counts as none finished.

### Text

- Instruction: one sentence, at most 100 characters (as now).
- Why: one sentence giving the reason, at most 110 characters for lessons (Basics keeps 70). Both
  checked by the existing test, extended to every lesson.
- Same markup as now: `[Key]`, «state», `word`.

### The first lessons

> Superseded: the NFAs, Convert and Minimize lessons were reworked and an ε-moves lesson added. See `2026-11-15-lessons-flow-design.md`.

Wording below is as built (changed during implementation, 2026-11-15, to fit the length caps). Fixtures are given as their
language and shape; ids equal labels.

**Convert NFA → DFA** (opens "Contains 01": q₀ start with a loop on 0,1; q₀ –0→ q₁ –1→ q₂; q₂
accepting with a loop on 0,1. Its DFA has 4 states.) Goal: "Turn this NFA into a DFA", NFA → DFA
pictures, `1011` ✓ `110` ✗.

1. Press **Convert to DFA** at the top. / A DFA can't guess, so each of its states stands for
   every NFA state you could be in. (latch: a subset walkthrough of an owned automaton is open) The
   reason sits here, not on step 2, because step 2 is on the card for only one 800 ms step.
2. Watch it build the DFA: it pauses at a new state. / It follows each symbol from each set, so
   every set the NFA can reach becomes a state. (pauses at, and latches on, the step where
   «{q_0,q_1}» appears: {q_0} on `0`)
3. Press Play to finish building it. / After a `0` the NFA could still be in «q_0» or
   have moved to «q_1», so the DFA state is both. (latch: last step; on the card while paused)
4. Press **Save as new automaton** to keep the DFA. / Saved, it's an automaton of its own: you can
   run words on it, or minimize it next. (latch: an owned DFA saved from it exists; with the
   walkthrough reopened short of its end, the card first says "let it play to the end": a reopened
   walkthrough plays by itself)

**Minimize a DFA** (opens that 4-state DFA, named by its subsets; it minimizes to 3: {q₀, q₂} and
{q₀, q₁, q₂} merge, after one split). Goal: "Make this DFA as small as possible", before → after.

1. Press **Minimize** at the top. / It looks for states no word can tell apart, and merges them.
   (latch)
2. Press Play: it pauses when a block splits. / It starts from accepting and not, and a
   block splits when a symbol sends its states to different blocks. (pauses at, and latches on, the
   split step)
3. Press Play to finish. / On a `1`, «{q_0}» stays put but «{q_0,q_1}» reaches an
   accepting state, so they differ. (latch: last step; on the card while paused at the split)
4. Press **Save as new automaton** to keep the smaller DFA. / Saved, it's an automaton of its own:
   you can run words on it, or share it. (latch: the minimized DFA saved; the card asks to press
   Play first when the reopened walkthrough, which opens paused, is short of its end)

**NFAs** (opens an NFA for a\*b\*: q₀ start, loop on a; q₀ –ε→ q₁; q₁ accepting, loop on b).
Goal: "Run an NFA", `aab` ✓ `aba` ✗.

1. Type `aab` in the word box and press Run. / The run starts in q_0 and q_1 at once, since the
   ε-arrow moves without reading. (latch: the run is open)
2. Watch: the run pauses where a branch dies. / An NFA follows every guess at once, and a guess
   dies when it has no arrow to take. (pauses at, and latches on, the first step where a branch
   dies: reading the first `a`)
3. Press Play to see the verdict. / q_1 has no arrow on `a`, so that guess dies while
   q_0 carries on. (run latched; on the card while paused)
4. Press [Esc], then run `aba`. / By the last `a` every branch has died, so none is left to accept
   and it's rejected. (run latched; it plays to its verdict)

**Share and export** (opens the Basics DFA, even zeros, its states named «even» and «odd»). Goal: "Share your automaton", no examples.

1. Open **Share, copy or export** and choose **Share link**. / The automaton travels inside the
   link: whoever opens it gets their own copy. (action: share-link)
2. Press [Ctrl] + [C] with nothing selected. / That copies the picture, ready to paste into notes
   or slides. (action: copy-image, or export-png / export-svg, which the copy's failure toast
   suggests; with states selected Ctrl+C copies the states and nothing counts, so the card first
   asks to click the empty canvas to clear the selection)
3. Choose **Copy LaTeX** or **Export LaTeX** from the same menu. / It is TikZ, laid out as on the
   canvas, to paste into a LaTeX document. (action: copy-latex or export-latex)

Order in the list: Basics, NFAs, Convert, Minimize, Share and export.

## Testing

- Basics: today's `steps.test.ts`, `TutorialCard.test.tsx`, `tutorialStore.test.ts` and the e2e
  tutorial spec pass unchanged in substance.
- Each lesson: a unit test walking its steps on fixture contexts (done, fallback, hints), its goal
  examples checked against its goal automaton, and the text caps; an e2e spec taking it to the end.
- The engine: owned automata (a saved DFA is owned, an unrelated one is "elsewhere"), actions
  reported only while a lesson runs, the finished list surviving a bad stored value.

## Left to the builder

- The exact predicates for each latch (which trace step counts as "the first DFA state", "a branch
  crossed out"), and the selectors the pointer frames.
- The final wording within the caps, the fixture coordinates, and the goal pictures' layout.
- How owned automata are detected (e.g. a new automaton appearing in `follow()` while a walkthrough
  of an owned one was open, as part 3 did).
- Whether the Next button and the list share a helper for "first unfinished lesson".
