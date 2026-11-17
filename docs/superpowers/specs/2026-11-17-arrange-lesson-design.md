# Arrange lesson

Agreed in chat 2026-11-17 (branch `worktree-arrange-lesson`). Adds a seventh lesson to the lessons
spec (`2026-11-15-lessons-design.md`, as amended by `2026-11-15-lessons-flow-design.md`); where
this document disagrees with them, it wins for this lesson only.

## Intent

Students don't know the arranging gestures exist, so they never use them: Basics teaches building
and running, and nothing teaches moving several states at once, bending an arrow or turning the
start arrow. The Controls (?) Arrange tab lists them, but nobody reads a list of gestures they don't
know they need. The Arrange lesson has the student **do each gesture once**, on a real automaton, in
the order they would use them for real: **Tidy first, then touch up what Tidy left.**

## Goals

- A lesson "Arrange" that teaches, by doing: Tidy; box select (Ctrl + drag); Ctrl+click to add to the
  selection; dragging a selection to move it together; Ctrl+A; snapping a state into line; bending
  an arrow; moving an arrow's symbols to the other side; turning the start arrow.
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

Length: 9 counted steps, over the 6-step cap. The user chose **one lesson with the cap waived** for
it (like Basics), over splitting it into two lessons or trimming to 6 by folding gestures into why
lines.

## The lesson

- `id: 'arrange'`, title **Arrange**, `noun: 'lesson'`, summary along the lines of "Tidy, select,
  move, bend" (builder's wording), `minutes: 2`, `editable: false`.
- Listed right after Basics: `LESSON_IDS` and `LESSONS` become basics, arrange, nfa, epsilon,
  convert, minimize, share. `nextLesson` then offers Arrange first.
- **No idea step**: like Share and export, it teaches no theory. The "opens with an idea step" test
  exempts it as it exempts Share.
- No goal picture, no goal examples. Goal line for all three parts, something like "Tidy this DFA
  up, then make it yours" (builder's wording, same markup rules).
- Closing card: one line saying all of this is under ? → Arrange (builder's wording).

### The starting automaton

A working DFA of 5–6 states (a real language, so it isn't nonsense; builder's choice), drawn
badly **by its positions only**: states crowded or overlapping, arrows crossing, at least one
self-loop. It sets no `bend`, `loopAngle`, `labelSide` or `startAngle` (all automatic), so undoing
back past Tidy can’t satisfy steps 6–8 (see *Undo past Tidy*). Its ids equal its labels
(`q_0`, `q_1`, …), as in the other lessons. The builder chooses it **together with the states and arrows each step names**, so that
after Tidy:

- the states step 5 asks to line up do **not** already share an x or a y;
- the arrow step 6 bends and step 7 moves the symbols of is a two-state arrow (not a loop);
- the group in steps 2–4 can be boxed without catching other states (the box must not need to
  cross a state that isn't in the group), and the third state of step 3 is outside that box;
- «d» of step 5 is not in that group, so pressing it (unselected) selects it alone and it drags
  on its own. (Pressing a state that is part of a multi-selection drags the whole group, which
  snaps only to states outside it.)

A unit test runs `layoutAutomaton` (the Tidy layout, on the page as in jsdom) on the starting
automaton and asserts these. If a later change to the layout's costs breaks one, that test fails and
the lesson's choices get updated.

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

5. **Drag «d» until it snaps into line with «e».** Done: «d» and «e» share an x or a y exactly
   (snapping copies the coordinate, so equality is exact).
6. **Drag the arrow «f» → «g» to bend it.** Why: drag a loop the same way to turn it around its
   state. Done: that arrow's `bend` differs from the tidied one.
7. **Drag that arrow's symbols to the other side.** Done: its `labelSide` differs from the tidied
   one (absent counts as automatic, the value it resolves to on the canvas; see *Checks*).
8. **Drag the start arrow to turn it.** Done: the start state's `startAngle` differs from the
   tidied one.
9. **Press [Ctrl] + [A].** Why: everything is selected, so dragging any state moves the whole
   automaton. Done: every state is selected.

Ctrl+A is last because, with everything selected, a drag moves the whole automaton and nothing
can snap to anything: anywhere earlier it would block the snap step unless the lesson taught
clearing the selection, which is a non-goal. (The order agreed in chat had it fifth; moved after
the builder check.)

The checks are structural (re-evaluated live), as in the other lessons, so the engine's existing
rules apply: the card falls back within the current part if a done step comes undone (e.g. the
student presses Tidy again or undoes), and never past the start of the part.

**Undo past Tidy.** Ctrl+Z back past the Tidy restores the messy drawing while the `tidy` action
stays latched and `tidied` stays set, and the engine never returns to step 1. Accepted as a rare
edge case, with no engine work: because the messy automaton is messy by positions only, its
drawing fails steps 5–8's checks (no explicit bend, label side or start angle; «d» and «e» not in
line), and a test asserts that. The student just redoes, or presses Tidy again.

### Checks: what the engine needs

- **A `tidy` lesson action.** Add `'tidy'` to `LessonAction`, reported from `tidyActive`
  (`ui/canvas/useCanvasEditing.ts`) through `noteLessonAction` once the layout has landed (also when
  the layout was already the same and no edit was made), so the snapshot below is the tidied
  automaton.
- **The tidied snapshot.** The tutorial store records the lesson automaton as it is right after each
  Tidy of an owned automaton (`noteLessonAction` returns early for an action already reported, so
  the snapshot is set separately, on every Tidy, not only the first), and `TutorialContext` gets
  it, e.g. `tidied: Automaton | undefined`. Steps 4, 6, 7 and 8 compare against it; before any
  Tidy they are not done. It is cleared when the lesson ends, like `actions`.
- **Selection** is already in the context (`selected`, states only); that is all steps 2, 3 and 9
  need. Box select adds to the selection, so steps 2–3 hold even if something was selected before.
- **Label side, step 8:** an automatic `labelSide` (absent) means the canvas chose a side. Dragging
  the symbols writes an explicit side. "Differs" should compare the side the canvas actually draws
  (via `core/geometry.ts`), not the raw field, so a drag that writes the same side Tidy left
  implicitly doesn't count; the builder confirms what the drag writes and picks the comparison.
  The same care applies to `bend` and `startAngle` if Tidy leaves them absent.

### Tests to update

- `lessons/index.test.ts`: the 6-step cap exempts Arrange as well as Basics; the idea-step test
  exempts Arrange as well as Share; the lesson order lists `arrange` second. The text caps (100 /
  110 / 140) apply unchanged.
- Tests or e2e that assume NFAs is the first Next lesson (finish popups, `nextLesson`) now get
  Arrange.
- New: `lessons/arrange.test.ts` (each step's check, including the "not done before the gesture"
  cases, the layout assertions above, and the messy drawing failing steps 5–8) and an e2e spec walking the lesson with real gestures.
- The README's lesson count and list ("Five one-minute lessons") and PROGRESS.md.

## Left to the builder

The starting automaton and its language, the states and arrow each step names, all final wording,
how `tidied` is plumbed through the tutorial store, the label-side comparison, and the e2e spec's
shape.
