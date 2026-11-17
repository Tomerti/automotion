# Arrange Lesson Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A seventh lesson, "Arrange", that has the student press Tidy and then do each arranging gesture once (box select, Ctrl+click, group drag, snap, bend, label side, start arrow, Ctrl+A) on a read-only "Divisible by 5" DFA.

**Architecture:** Lessons are data (`src/ui/tutorial/lessons/*.ts`) run by the existing engine (`engine.ts`) and store (`tutorialStore.ts`). The only engine addition is Tidy reporting: a `tidy` lesson action plus a `tidied` snapshot of the lesson automaton in `TutorialContext`, which the "moved / bent / turned" checks compare against. Everything else is a new lesson file, its listing, and tests.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), React 19, Zustand, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-arrange-lesson-design.md` (read it first; its *Chosen* section has the automaton, messy drawing and step targets).

## Global Constraints

- Lesson text caps (`lessons/index.test.ts`): instruction ≤ 100 chars (closing card included), why ≤ 110, `explain` ≤ 140.
- Markup: keys `[Ctrl]`, states `«q_0»`, symbols in backticks.
- `editable: false`, `noun: 'lesson'`, `minutes: 2`, no idea step, no goal picture, `goal.examples: []`.
- Listed second: basics, arrange, nfa, epsilon, convert, minimize, share.
- Counted steps: 9, exempt from the 6-step cap (like Basics).
- Starting automaton has no `bend`, `loopAngle`, `labelSide` or `startAngle`.
- `core/` stays React-free; nothing outside `ui/` imports `ui/`. No import of `tutorialStore` from `ui/canvas/useCanvasEditing.ts` (it would cycle: the store imports `fitActive` from there).
- Run `npm run format` before each commit (CI runs `format:check`).

## Review Focus

1. **Tidy pressed again mid-lesson** wipes the fine-tuning: the snapshot refreshes and the card drops to the first undone step of part 3 (Task 2 test `pressing Tidy again sends part 3 back to its first undone step`).
2. **Undo past Tidy** back to the messy drawing: no part-3 step completes by itself (Task 2 test `undoing past Tidy completes no part-3 step`).
3. **Bending the arrow the other way** flips the label's automatic side: step 7 must still wait for a label drag (Task 2 test `a bend that flips the automatic side does not count as moving the symbols`).
4. **Selection lost before the group drag** (a stray click, then dragging one state alone): step 4 isn't done and the card says to reselect (Task 2 test `asks to reselect the three when they are not all selected`).
5. **Tidy that doesn't land** (a run is open, or another automaton is active, or the user switched away mid-layout): nothing is recorded (Task 1 tests `tidyActive resolves false while a trace is open` and `noteTidied ignores an automaton the lesson doesn't own`).

---

### Task 1: Tidy reports to the lesson

**Files:**
- Modify: `src/ui/tutorial/engine.ts` (`LessonAction`, `TutorialContext`)
- Modify: `src/ui/tutorial/tutorialStore.ts` (`TutorialState`, `OFF`, `tutorialContext`, new `noteTidied`)
- Modify: `src/ui/canvas/useCanvasEditing.ts:210-230` (`tidyActive` return value)
- Modify: `src/ui/shell/Toolbar.tsx:272` (Tidy button)
- Test: `src/ui/tutorial/tutorialStore.test.ts`, `src/ui/canvas/Canvas.test.tsx` (next to the existing `tidyActive` tests near line 1500), `src/ui/shell/Toolbar.test.tsx`

**Interfaces:**
- Produces:
  - `LessonAction` gains `'tidy'`.
  - `TutorialContext.tidied?: Automaton`: the lesson's own automaton as it was right after the last Tidy of it; absent before any Tidy. Optional, so existing test literals stay valid.
  - `TutorialState.tidied: Automaton | undefined` (`undefined` in `OFF`, so `startLesson` and `endLesson` clear it); `tutorialContext` copies it into the context (its `t` parameter's `Pick` adds `'tidied'`).
  - `export function noteTidied(): void` in `tutorialStore.ts`: when a lesson runs and the active automaton is the lesson's own (`app.activeId === t.automatonId`), sets `tidied` to that automaton and adds `'tidy'` to `actions` (on every call, not only the first), then `moveOn`. Otherwise does nothing.
  - `tidyActive(): Promise<boolean>`: `true` once the layout landed or was already the same; `false` on every early return (no automaton, trace open, layout failed, automaton changed or switched during the await).
  - Toolbar: `onClick={() => void tidyActive().then((ok) => { if (ok) noteTidied(); })}`.

- [ ] **Step 1: Write the failing tests**

In `tutorialStore.test.ts`, using `startLesson(TEST_LESSON)` (`testing/testLesson.ts`; it opens a copy of `CONTAINS_01`):
- `noteTidied records the lesson automaton and the tidy action`: start it, `noteTidied()`; expect `tut().tidied` toBe the active automaton object and `tut().actions.has('tidy')`.
- `noteTidied records again on every Tidy`: `noteTidied()`, move a state with `app().edit(...)` (positions only), `noteTidied()`; expect `tut().tidied` toBe the new active automaton.
- `noteTidied ignores an automaton the lesson doesn't own`: start, `app().createAutomaton('DFA')`, `noteTidied()`; expect `tut().tidied` undefined and no `'tidy'`.
- `ending or restarting the lesson clears tidied`: `noteTidied()`, `endLesson()` → undefined; same after `startLesson` again.

In `Canvas.test.tsx`:
- `tidyActive resolves true once the layout lands`: `expect(await tidyActive()).toBe(true)` on an automaton with states.
- `tidyActive resolves false while a trace is open`: open a run (`startRun` as the neighbouring tests do), `expect(await tidyActive()).toBe(false)`.

In `Toolbar.test.tsx`:
- `Tidy reports to a running lesson once the layout lands`: `startLesson(TEST_LESSON)`, render `<Toolbar />`, click `Tidy`, `await waitFor(() => expect(tutorialStore.getState().actions.has('tidy')).toBe(true))`.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/ui/tutorial/tutorialStore.test.ts src/ui/canvas/Canvas.test.tsx src/ui/shell/Toolbar.test.tsx`
Expected: FAIL (`noteTidied` not exported; `tidyActive` resolves undefined).

- [ ] **Step 3: Implement the interfaces above**

Doc comments in the codebase's style: `tidied` says what it is and who reads it (the Arrange lesson's checks).

- [ ] **Step 4: Run the tests, then the whole suite and typecheck**

Run: `npx vitest run src/ui/tutorial src/ui/canvas/Canvas.test.tsx src/ui/shell/Toolbar.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/ui/tutorial/engine.ts src/ui/tutorial/tutorialStore.ts src/ui/tutorial/tutorialStore.test.ts src/ui/canvas/useCanvasEditing.ts src/ui/canvas/Canvas.test.tsx src/ui/shell/Toolbar.tsx src/ui/shell/Toolbar.test.tsx
git commit -m "feat(lessons): Tidy reports to the running lesson, with a snapshot of what it laid out"
```

---

### Task 2: The Arrange lesson

**Files:**
- Create: `src/ui/tutorial/lessons/arrange.ts`
- Test: `src/ui/tutorial/lessons/arrange.test.ts`

**Interfaces:**
- Consumes: `TutorialContext.tidied`, `'tidy'` action (Task 1); `drawnBend`, `labelSideOf`, `START_ANGLE`, `STATE_RADIUS` from `core/geometry.ts`.
- Produces: `export const ARRANGE_LESSON: Lesson & { id: 'arrange' }`. That type needs `'arrange'` in `LESSON_IDS`: append it at the end of the tuple in this task (nothing lists it yet); Task 3 moves it to second place and adds it to `LESSONS`. Step indices (from `lessonSteps`): 0 tidy, 1 box, 2 ctrl-click, 3 drag-together, 4 snap, 5 bend, 6 symbols, 7 start-arrow, 8 ctrl-a, 9 closing.

**The automaton** (`id: 'arrange-lesson'`, name `'Divisible by 5'`, DFA, alphabet `['0','1']`, ids = labels, start and accepting `q_0`), messy positions from the spec: q_0 (400, 300), q_1 (150, 150), q_2 (420, 140), q_3 (180, 320), q_4 (300, 220). Transitions (one per pair; ids `t0…t9` or similar): q_0→q_0 `0`, q_0→q_1 `1`, q_1→q_2 `0`, q_1→q_3 `1`, q_2→q_4 `0`, q_2→q_0 `1`, q_3→q_1 `0`, q_3→q_2 `1`, q_4→q_3 `0`, q_4→q_4 `1`.

**Parts and steps** (goal text for every part: ``Tidy this DFA up, then make it yours``; no `done` lines: the hand-over panel only follows a run). Each check returns false without `ctx.automaton`.

| # | Part | id | instruction | why | completes |
|---|---|---|---|---|---|
| 1 | Tidy up | `arrange/tidy` | `Press Tidy at the top.` | `It lays out the whole automaton the way you’d draw it by hand.` | `action: ['tidy']`; `target: () => 'button[aria-label="Tidy"]'` |
| 2 | Select and move | `arrange/box` | `Hold [Ctrl] and drag a box around «q_0» and «q_2».` | `A box selects every state inside it.` | `latch`: `selected` ⊇ {q_0, q_2} |
| 3 | | `arrange/add` | `[Ctrl] + click «q_3» to add it.` | `[Ctrl] + click a selected state to take it out again.` | `latch`: `selected` ⊇ {q_0, q_2, q_3} |
| 4 | | `arrange/move` | `Drag one of them: the other two move along.` | — | `done`: `movedTogether(['q_0','q_2','q_3'])`; `first`: `First, select «q_0», «q_2» and «q_3» again.` while not all three are selected and not done |
| 5 | Fine-tune | `arrange/snap` | `Drag «q_1» until it snaps into line with «q_4».` | `States snap into line, and to equal gaps, as you drag them.` | `done`: q_1 and q_4 have exactly equal x or exactly equal y |
| 6 | | `arrange/bend` | `Drag the arrow from «q_3» to «q_2» to bend it.` | `Drag a loop the same way to turn it around its state.` | `done`: `tidied` set and `drawnBend(a,'q_3','q_2') !== drawnBend(tidied,'q_3','q_2')` |
| 7 | | `arrange/label` | ``Drag that arrow’s `1` to the other side.`` | — | `done`: for q_3→q_2 with `b = drawnBend(...)`, `labelSideOf(b, t.labelSide) !== labelSideOf(b, undefined)` |
| 8 | | `arrange/start` | `Drag the start arrow to turn it around «q_0».` | — | `done`: `tidied` set and `(q_0.startAngle ?? START_ANGLE) !== (tidied q_0.startAngle ?? START_ANGLE)` |
| 9 | | `arrange/all` | `Press [Ctrl] + [A].` | `Everything is selected: drag any state and the whole automaton moves.` | `latch`: every state selected |

`movedTogether(ids)`: `tidied` set; every id's offset `(x − tidied.x, y − tidied.y)` equals the first one's within `1e-6` on both axes, and the first offset is non-zero (`Math.hypot > 1e-6`).
Lesson: title `Arrange`, summary `Tidy, select, move, bend`, `minutes: 2`, `editable: false`, closing `That’s arranging: Tidy first, then fine-tune by hand. [?] shows every gesture again.`

- [ ] **Step 1: Write the failing tests**

`arrange.test.ts`, in the style of `share.test.ts` (a `ctx(over)` builder with `automaton`, `isActive: true`, `owned`, `actions`, `selected`, `tidied`). In `beforeAll`, `tidied = await layoutAutomaton(start)` (from `src/layout/layout.ts`; runs on the page in jsdom). Small local helpers: `moved(a, ids, dx, dy)`, `withTransition(a, from, to, patch)`, `withState(a, id, patch)`. Tests:
- `opens on Divisible by 5`: name, DFA, `runWord(start,'101').accepted` true, `'1010'` true, `'110'` false, `'111'` false.
- `is messy by positions only`: no state has `startAngle`, no transition has `bend`, `loopAngle` or `labelSide`.
- `Tidy leaves every step something to do` (the spec's constraints, on `tidied`): q_1 and q_4 share neither x nor y (also on `start`); no state other than q_0 and q_2 has its centre within `STATE_RADIUS` of the box spanning q_0's and q_2's circles; q_3 is outside that box; q_3→q_2 exists, is not a loop, reads `['1']`; `tidied` sets no `bend`, `labelSide`, `startAngle` on the named elements.
- `nothing counts before Tidy`: `advance(L, 0, new Set(), ctx({}))` stays on 0, even with q_0/q_2/q_3 selected.
- `walks every step to the closing card`: a sequence of contexts (tidy action + `tidied`; select q_0,q_2; add q_3; `moved(tidied, three, 0, -80)`; then q_1's y set to q_4's; bend q_3→q_2 to `40`; `labelSide` set to the side opposite `labelSideOf(40, undefined)`; q_0 `startAngle: Math.PI / 2`; every state selected), asserting `current` is 1, 2, … 9 and `steps[9].id === 'done'`.
- `step 4 needs all three moved by the same offset`: only q_0 moved → current stays 3.
- `asks to reselect the three when they are not all selected` (Review Focus 4): at step 4 with `selected: ['q_0']`, `steps[3].hint(c)` equals `{ kind: 'first', text: 'First, select «q_0», «q_2» and «q_3» again.' }`; null with all three selected.
- `a bend that flips the automatic side does not count as moving the symbols` (Review Focus 3): at step 6 done with bend `-40` and no `labelSide` → current is 6.
- `turning the start arrow back to where it was does not count`: `startAngle: START_ANGLE` → current stays 7.
- `pressing Tidy again sends part 3 back to its first undone step` (Review Focus 1): progress at step 8 with all part-3 changes, then context `automaton: tidied` → current 4.
- `undoing past Tidy completes no part-3 step` (Review Focus 2): progress 4, `automaton: start`, `tidied` and `'tidy'` kept → current 4; and from progress 5, 6, 7 each stays where it is.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/ui/tutorial/lessons/arrange.test.ts`
Expected: FAIL (module `./arrange` not found).

- [ ] **Step 3: Write `arrange.ts` per the tables above**

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/ui/tutorial/lessons/arrange.test.ts && npm run typecheck`
Expected: PASS. If the layout test fails, the layout changed since the spec: pick new names per the spec's rules and update spec and lesson together.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/ui/tutorial/lessons/arrange.ts src/ui/tutorial/lessons/arrange.test.ts src/ui/tutorial/engine.ts
git commit -m "feat(lessons): Arrange lesson: Tidy, then select, move, snap, bend and turn"
```

---

### Task 3: List it second, and say so

**Files:**
- Modify: `src/ui/tutorial/engine.ts:5` (`LESSON_IDS`: `'arrange'` second)
- Modify: `src/ui/tutorial/lessons/index.ts` (`LESSONS`: `ARRANGE_LESSON` after `BASICS`)
- Modify: `src/ui/tutorial/lessons/index.test.ts` (order; cap and idea-step exemptions)
- Modify: `src/ui/tutorial/TutorialCard.test.tsx:692-704` (Next after a test lesson is now Arrange)
- Modify: `README.md:61-63`, `PROGRESS.md`

**Interfaces:**
- Consumes: `ARRANGE_LESSON` (Task 2).

- [ ] **Step 1: Update the tests first**

- `index.test.ts`: `lists the lessons in order` expects `['basics','arrange','nfa','epsilon','convert','minimize','share']`; the six-step test is renamed `has at most six counted steps, unless it is Basics or Arrange` and skips both; the idea-step test's `opens` excludes `'arrange'` as it does `'share'` (rename it accordingly).
- `TutorialCard.test.tsx`, `offers the first unfinished lesson after Basics as Next, and starts it`: expects `Next: Arrange` and `lessonId` `'arrange'`. `never offers the lesson just finished, even when storage is blocked` (finishing `NFA_LESSON`) now expects `Next: Arrange`, the first unfinished lesson that isn't Basics; its point (never NFAs itself) still holds.

- [ ] **Step 2: Run and see them fail**

Run: `npx vitest run src/ui/tutorial`
Expected: FAIL on the order and Next assertions.

- [ ] **Step 3: Move `'arrange'` to second place in `LESSON_IDS` and add `ARRANGE_LESSON` to `LESSONS`**

- [ ] **Step 4: Run the whole unit suite, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Docs**

- README "Learn by doing": "Six short lessons", listing **Arrange** first; it is not one-minute any more, so drop "one-minute" (e.g. "Six short lessons, each on a ready-made automaton you can't break: **Arrange**, **NFAs**, …").
- PROGRESS.md: tick `Lesson: Arrange (…)` under Next, and add a dated Done section `### Arrange lesson (2026-11-17)` with one line per change (Tidy action and snapshot; the lesson; listed second; cap exemption).

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/ui/tutorial/engine.ts src/ui/tutorial/lessons/index.ts src/ui/tutorial/lessons/index.test.ts src/ui/tutorial/TutorialCard.test.tsx README.md PROGRESS.md
git commit -m "feat(lessons): list Arrange right after Basics"
```

---

### Task 4: End-to-end walk

**Files:**
- Modify: `e2e/lessons.spec.ts` (new test, reusing its `startLesson` and `finish` helpers)

**Interfaces:**
- Consumes: the lesson row `lesson-arrange` (rows are `lesson-<id>`), the card's `data-step` (current index + 1), test ids `state-<label>`, `edge-q_3-q_2`, `edge-label`, `start-arrow`, and `stateCenter` from `e2e/helpers.ts`.

- [ ] **Step 1: Write the test `the Arrange lesson walks Tidy and every arranging gesture, and finishes`**

`openApp(page, { clear: true })`, `startLesson(page, 'lesson-arrange')`, then after each gesture `await expect(card).toHaveAttribute('data-step', String(n))`:
1. Click the `Tidy` button → step 2.
2. Hold `Control`, drag a box from a point up-left of q_0 to a point down-right of q_2 (each corner one state-diameter beyond the circle, measured from `.av-state-body`'s box; start up-left on the diagonal, clear of q_0's loop and start arrow), release `Control` → 3.
3. `Control` + click q_3 → 4.
4. Drag q_0 by (0, −80) screen px, `steps: 10` → 5.
5. Drag q_1 to (its x + 70, q_4's y + 3), `steps: 12` (the snap pulls it onto q_4's row) → 6.
6. Press the midpoint between q_3's and q_2's centres (the straight arrow) and drag it 40 px along the perpendicular → 7. Remember the release point `P`.
7. Drag `edge-q_3-q_2`'s `edge-label` centre `L` to `2P − L` (its mirror across the bent arrow's apex) → 8.
8. Drag from the `start-arrow` box's centre to 80 px below q_0's centre → 9.
9. `page.keyboard.press('Control+a')` → 10 (closing card).
Then `const ticked = await finish(page, guide, card, 'lesson-arrange'); await ticked();`.

- [ ] **Step 2: Build and run it**

Run: `npx playwright test e2e/lessons.spec.ts`
Expected: PASS for the whole file (first time: `npx playwright install chromium`). If a gesture misses (e.g. the box start lands on the loop), adjust that gesture's geometry, not the lesson.

- [ ] **Step 3: Full check**

Run: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run e2e`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
npm run format
git add e2e/lessons.spec.ts
git commit -m "test(e2e): walk the Arrange lesson"
```
