# Arrange lesson

Agreed in chat 2026-11-17 (branch `worktree-arrange-lesson`). Adds a seventh lesson to the lessons
spec (`2026-11-15-lessons-design.md`, as amended by `2026-11-15-lessons-flow-design.md`); where
this document disagrees with them, it wins for this lesson only.

Amended 2026-11-17, after review: the user swapped the automaton for "Number of 0s mod 5 = 0" and
dropped the snap step as useless. The lesson has 8 counted steps (parts of 1, 3 and 4); the text below
is the amended design.

## Intent

Students don't know the arranging gestures exist, so they never use them: Basics teaches building
and running, and nothing teaches moving several states at once, bending an arrow or turning the
start arrow. The Controls (?) Arrange tab lists them, but nobody reads a list of gestures they don't
know they need. The Arrange lesson has the student **do each gesture once**, on a real automaton, in
the order they would use them for real: **Tidy first, then touch up what Tidy left.**

## Goals

- A lesson "Arrange" that teaches, by doing: Tidy; box select (Ctrl + drag); Ctrl+click to add to the
  selection; dragging a selection to move it together; Ctrl+A; bending an arrow; moving an arrow's symbols to the other side; turning the start arrow.
- Every step is checked on the automaton (or by Tidy's reported action), so the card moves on by
  itself as in the other lessons.
- It is listed right after Basics, so it is the first lesson the finish popups offer as Next.

## Non-goals

- Pan and zoom (intuitive), Alt to place or turn freely, clicking the empty canvas to clear the
  selection: not taught.
- Copy, cut and paste: not taught (not an arrange gesture, it is on the Keys tab, and Ctrl+C / Ctrl+V
  is what people try anyway). The lesson's automaton stays read-only, so no engine work for pasting.
- Turning a loop gets no step of its own: it is the same gesture as bending, so the bend step's why
  line mentions it.
- No changes to the other lessons, to Basics, or to the Controls dialog.

## Anti-goals

- A step whose check passes before the student has done anything (e.g. two states that Tidy already
  lines up). The starting automaton is chosen so that never happens, and a test pins it.
- Steps that undo the student's own work. That is why Tidy comes first.
- Anything shown when no lesson runs (the no-persistent-tip rule holds).

## Approaches

Where Tidy goes, which shapes the whole flow:

1. **Tidy first, then fine-tune** (chosen): open on a badly drawn automaton, press Tidy, then use the
   other gestures to adjust what Tidy left. This is the real workflow, nothing the student does
   gets wiped, and every later check is an exact "this changed / these line up".
2. Arrange by hand, then Tidy as the punchline: memorable, but Tidy wipes the student's work, and
   "is it fixed now?" is a fuzzy check.

Copy and paste (dropped, see Non-goals): the alternatives were making the lesson editable to paste
into its own automaton (students could then break it mid-lesson), or teaching a paste into a second
automaton (needs the lesson to own and follow an automaton the student creates).

Length: 8 counted steps, over the 6-step cap. The user chose **one lesson with the cap waived** for
it (like Basics), over splitting it into two lessons or trimming to 6 by folding gestures into why
lines.

## The lesson

- `id: 'arrange'`, title **Arrange**, `noun: 'lesson'`, summary along the lines of "Tidy, select,
  move, bend" (builder's wording), `minutes: 2`, `editable: false`.
- Listed right after Basics: `LESSON_IDS` and `LESSONS` become basics, arrange, nfa, epsilon,
  convert, minimize, share. `nextLesson` then offers Arrange first.
- **No idea step**: like Share and export, it teaches no theory. The "opens with an idea step" test
  exempts it as it exempts Share.
- No goal picture, no goal examples. Goal line for all three parts: "Learn to arrange a diagram:
  Tidy first, then by hand" (after review: it says what the student learns, which "Tidy this DFA
  up, then make it yours" didn't).
- Closing card: one line saying all of this is under ? → Arrange (builder's wording).

### The starting automaton

A working DFA of 5–6 states (a real language, so it isn't nonsense; builder's choice), drawn
badly **by its positions only**: states crowded or overlapping, arrows crossing, at least one
self-loop. It sets no `bend`, `loopAngle`, `labelSide` or `startAngle` (all automatic), so undoing
back past Tidy can’t satisfy steps 5–7 (see *Undo past Tidy*). Its ids equal its labels
(`q_0`, `q_1`, …), as in the other lessons. The builder chooses it **together with the states and arrows each step names**, so that
after Tidy:

- the arrow step 5 bends and step 6 moves the symbols of is a two-state arrow (not a loop);
- the group in steps 2–4 can be boxed without catching other states (the box must not need to
  cross a state that isn't in the group), and the third state of step 3 is outside that box.

A unit test runs `layoutAutomaton` (the Tidy layout, on the page as in jsdom) on the starting
automaton and asserts these. If a later change to the layout's costs breaks one, that test fails and
the lesson's choices get updated.

#### Chosen (experiment, 2026-11-17)

**Number of 0s mod 5 = 0**, picked by the user (replacing "Divisible by 5" after review): `q_i` is
the number of 0s read so far, mod 5; start and accepting `q_0`; name "Number of 0s mod 5 = 0".
Ten transitions on ten edges: `q_i` →0 `q_(i+1 mod 5)` (a 5-cycle) and a loop `q_i` →1 `q_i` on
every state.

A throwaway spike ran `layoutAutomaton` on it from three different messy drawings. Findings:

- **Tidy's result doesn't depend on the starting drawing**: all gave the same layout, two rows on
  a 140 grid: q_1 (0, 0), q_2 (140, 0), q_3 (280, 0) on top; q_0 (0, 140), q_4 (280, 140) below
  (the bottom middle is empty; the q_4 → q_0 arrow runs straight through it).
- **Tidy leaves every drawing choice automatic** here: no `bend`, `loopAngle`, `labelSide` or
  `startAngle`, and every `drawnBend` is 0. So the "differs from tidied" checks compare **drawn**
  values: `drawnBend` (`core/geometry.ts`), the side `labelSideOf` resolves to, and
  `startAngle ?? START_ANGLE`. A drag back to the drawn value doesn't count. Since the messy
  drawing is automatic too, its drawn values equal the tidied ones and *Undo past Tidy* can't
  complete steps 5–7.

**Messy drawing:** states apart (no overlaps, so it reads as badly drawn rather than broken) with
crossing arrows: q_0 (400, 300), q_1 (150, 150), q_2 (420, 140), q_3 (180, 320), q_4 (300, 220).
The builder may adjust it, keeping every drawing choice automatic.

**What each step names:** box «q_1» and «q_2» (step 2; the box is clean); Ctrl+click «q_3»
(step 3); bend «q_4» → «q_0» and move its symbols (steps 5–6, straight along the bottom row); the
start arrow is «q_0»'s (step 7).

### Steps

Instructions ≤ 100 chars, why ≤ 110, markup as in the other lessons (keys `[Ctrl]`, states
`«q_2»`). Wording below is the intent; the builder writes the final text. "Tidied" means the
snapshot taken when Tidy was pressed (see *Checks*).

**Part 1, Tidy up**

1. **Press Tidy.** Why: it lays out the whole automaton the way you'd draw it by hand. Done on the
   `tidy` action. Target: the Tidy button (framed, since the toolbar is new to this lesson).

**Part 2, Select and move**

2. **Hold [Ctrl] and drag a box around «a» and «b».** Done: both are selected.
3. **[Ctrl] + click «c» to add it.** Done: «a», «b» and «c» are all selected.
4. **Drag one of them: the others move along.** Done: «a», «b» and «c» have each moved by the same
   non-zero offset from where Tidy put them.

**Part 3, Fine-tune**

5. **Drag the line «f» → «g» to bend the arrow.** Why: drag a loop the same way to turn it around
   its state. Done: that arrow's `bend` differs from the tidied one.
6. **Now drag the symbol written on that arrow across it, to the other side.** Why: the line bends
   the arrow, its symbols move on their own (steps 5 and 6 both drag "the arrow", so each names
   which part to grab). Done: its label is drawn on the side that is
   *not* the automatic one for the arrow's current bend (`labelSideOf(bend, labelSide) !==
   labelSideOf(bend, undefined)`). Not "differs from tidied": bending the arrow the other way in
   step 5 flips the automatic side, which would pass with no label drag.
7. **Drag the start arrow to turn it.** Done: the start state's `startAngle` differs from the
   tidied one.
8. **Press [Ctrl] + [A].** Why: everything is selected, so dragging any state moves the whole
   automaton. Done: every state is selected.

Ctrl+A is last because, with everything selected, a drag moves the whole automaton: anywhere earlier
it would get in the way of the single-arrow steps unless the lesson taught clearing the selection,
which is a non-goal.

The checks are structural (re-evaluated live), as in the other lessons, so the engine's existing
rules apply: the card falls back within the current part if a done step comes undone (e.g. the
student presses Tidy again or undoes), and never past the start of the part.

**Undo past Tidy.** Ctrl+Z back past the Tidy restores the messy drawing while the `tidy` action
stays latched and `tidied` stays set, and the engine never returns to step 1. Accepted as a rare
edge case, with no engine work: because the messy automaton is messy by positions only, its
drawing fails steps 5–7's checks (bend, label side and start angle: none explicit), and a test
asserts that. The student just redoes, or presses Tidy again.

### Checks: what the engine needs

- **A `tidy` lesson action.** Add `'tidy'` to `LessonAction`, reported from `tidyActive`
  (`ui/canvas/useCanvasEditing.ts`) through `noteLessonAction` once the layout has landed (also when
  the layout was already the same and no edit was made), so the snapshot below is the tidied
  automaton.
- **The tidied snapshot.** The tutorial store records the lesson automaton as it is right after each
  Tidy of an owned automaton (`noteLessonAction` returns early for an action already reported, so
  the snapshot is set separately, on every Tidy, not only the first), and `TutorialContext` gets
  it, e.g. `tidied: Automaton | undefined`. Steps 4, 5 and 7 compare against it; before any
  Tidy they are not done. It is cleared when the lesson ends, like `actions`.
- **Selection** is already in the context (`selected`, states only); that is all steps 2, 3 and 8
  need. Box select adds to the selection, so steps 2–3 hold even if something was selected before.
- **Drawn values, steps 5–7:** compare what the canvas draws, not the raw fields (see *Chosen*):
  `drawnBend` and `startAngle ?? START_ANGLE` against `tidied`; the label side against the
  automatic side for the current bend (step 6). A label drag writes an explicit side only when it
  changes the drawn side, so this is exact.

### Tests to update

- `lessons/index.test.ts`: the 6-step cap exempts Arrange as well as Basics; the idea-step test
  exempts Arrange as well as Share; the lesson order lists `arrange` second. The text caps (100 /
  110 / 140) apply unchanged.
- Tests or e2e that assume NFAs is the first Next lesson (finish popups, `nextLesson`) now get
  Arrange.
- New: `lessons/arrange.test.ts` (each step's check, including the "not done before the gesture"
  cases, the layout assertions above, and the messy drawing failing steps 5–7) and an e2e spec walking the lesson with real gestures.
- The README's lesson count and list ("Five one-minute lessons") and PROGRESS.md.

## Left to the builder

All final wording, small adjustments to the messy drawing (within the rules above), how `tidied`
is plumbed through the tutorial store, and the e2e spec's shape.
