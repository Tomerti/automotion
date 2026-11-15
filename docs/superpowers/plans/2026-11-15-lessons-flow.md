# Lessons That Explain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lessons open with an idea step, explain each paused moment, step NFA runs by hand, add an ε-moves lesson, and carry less on the card.

**Architecture:** The lesson engine (`src/ui/tutorial/engine.ts`) gains two step fields (`idea`, `explain`) and one lesson field (`pausedRuns`); the tutorial store gains `pressNext()`, `lessonOpensPaused()` and a look-ahead in `lessonStopAt()`; `TutorialCard` renders the idea step's Next button, the explanation line and a goal row without a picture. The lesson files are rewritten on top.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), React 19, Zustand, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-15-lessons-flow-design.md` (amends `docs/superpowers/specs/2026-11-15-lessons-design.md`). Read both.

Work in the worktree `C:\Code\personal\automotion\.claude\worktrees\lessons-design` (branch `worktree-lessons-design`, PR #75).

## Global Constraints

- Basics (`lessons/basics.ts`) behaves exactly as now: same steps, texts, goal pictures, targets; `e2e/tutorial.spec.ts` passes unchanged.
- Text caps: instruction ≤ 100 characters; why ≤ 110 (Basics 70); `explain` ≤ 140; an idea step's instruction ≤ 240.
- At most 6 counted steps per lesson other than Basics, idea step included.
- Markup in texts: `[Key]`, `«state»`, `` `word` ``.
- Card test ids stay (`tutorial-card`, `tutorial-step`, `tutorial-instruction`, `tutorial-why`, `tutorial-goal`, …); new: `tutorial-next`, `tutorial-explain`.
- Lesson order: Basics, NFAs, ε-moves, Convert, Minimize, Share and export.
- No goal picture outside Basics. Outside Basics, no `target` on the word box, the dock or for Esc.
- Commit after each task; every commit passes `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- The user opens the run or walkthrough while the idea step is still up: the run still opens paused / the walkthrough still stops at its first stop, and Next lands on the matching card (tests in Tasks 1, 3, 5).
- Play or Space during a hand-stepped run: playback stops at every explained index, never runs to the end (test in Task 3).
- Stepping back with [←], or closing and rerunning a hand-stepped run midway: the card's `first` hint asks to step forward to where it was instead of explaining a moment that isn't on screen (tests in Tasks 3, 4).
- Another word run during a hand-stepped lesson: nothing latches, and the card asks to run the lesson's word (tests in Tasks 3, 4).
- A narrow window (≤ 760 px): the goal row without a picture still fits, with the examples wrapping (checked in Task 2's CSS; covered by e2e at default size only).

---

### Task 1: Engine and store: idea steps, explanations, paused runs, look-ahead

**Files:**
- Modify: `src/ui/tutorial/engine.ts`
- Modify: `src/ui/tutorial/tutorialStore.ts`
- Modify: `src/ui/tutorial/testing/testLesson.ts`
- Test: `src/ui/tutorial/engine.test.ts`, `src/ui/tutorial/tutorialStore.test.ts`

**Interfaces:**
- Produces (engine.ts):
  - `LESSON_IDS = ['basics', 'nfa', 'epsilon', 'convert', 'minimize', 'share']`.
  - `StepSpec.idea?: true`: an idea step. No `why`, no `target`; done only once `pressNext()` latches it.
  - `StepSpec.explain?(l: Labels, ctx: TutorialContext): string`: what the paused moment shows, rendered before the instruction.
  - `Step.idea: boolean`, `Step.explain(ctx: TutorialContext): string | null`.
  - `Goal.automaton?: Automaton`, `Goal.description?: string` (both optional now; Basics sets them). `Goal.after` stays until Task 5.
  - `Lesson.pausedRuns?: readonly string[]`: words whose runs of an owned automaton open paused.
  - `pacingStep(lesson: Lesson, current: number): Step | undefined`: `steps[current]`, or `steps[current + 1]` when `steps[current]` is an idea step.
- Produces (tutorialStore.ts):
  - `pressNext(): void`: when the step on the card is an idea step, adds its id to `latched` and moves on; otherwise does nothing.
  - `lessonOpensPaused(trace: AnyTrace, t?: TutorialState): boolean`: true for a run of an owned automaton whose word is in the running lesson's `pausedRuns`.
  - `lessonStopAt` reads `pacingStep(t.lesson, t.current)?.pauseAt` instead of the current step's.
- Produces (testLesson.ts): `IDEA_LESSON: Lesson`: `PAUSING_LESSON` with an idea step `{ id: 'idea/idea', idea: true, instruction: () => 'An idea.' }` first, and `pausedRuns: ['01']`.

- [ ] **Step 1: Write the failing engine tests** in `engine.test.ts`:
  - `it('an idea step is done only once latched')`: `advance(IDEA_LESSON, 0, new Set(), ctxWithNoTrace).current === 0`; with `latched = new Set(['idea/idea'])` it is `1`.
  - `it('an idea step never asks to press Esc first')`: with a subset trace of the owned automaton open, `lessonSteps(IDEA_LESSON)[0]!.hint(ctx)` is `null`.
  - `it('an idea step looks ahead to the next step for pacing')`: `pacingStep(IDEA_LESSON, 0)!.id === 'pause/open'`; `pacingStep(IDEA_LESSON, 2)!.id === 'pause/watch'`.
  - `it('passes explain through, null when unset')`: a test lesson step with `explain: () => 'Look.'` gives `step.explain(ctx) === 'Look.'`; Basics' first step gives `null`.
- [ ] **Step 2: Run** `npx vitest run src/ui/tutorial/engine.test.ts`. Expected: FAIL (`pacingStep`/`IDEA_LESSON` not defined).
- [ ] **Step 3: Implement in `engine.ts`.** In `toStep`: `structural` also excludes `spec.idea`; `latching(s)` includes `s.idea`; `happened` is false for idea steps (only `pressNext` latches them). Add `pacingStep`. Make `Goal.automaton`/`description` optional.
- [ ] **Step 4: Run** the engine tests. Expected: PASS.
- [ ] **Step 5: Write the failing store tests** in `tutorialStore.test.ts`:
  - `it('Next latches the idea step and moves on')`: `startLesson(IDEA_LESSON)`; `current === 0`; `pressNext()`; `current === 1`; `pressNext()` again leaves `current === 1`.
  - `it('pauses a walkthrough opened during the idea step at the next step\'s stop')`: start `IDEA_LESSON`, open a subset trace of the lesson's automaton (`appStore.getState().openTrace(subsetConstruction(own))`, `own` being the lesson's automaton in the app store); `lessonStopAt(trace)` is `2` while `current === 0`; after `setStep(2)` and `pressNext()`, the card is on `pause/end`.
  - `it('opens a run paused only for a word in pausedRuns, on an owned automaton')`: with `IDEA_LESSON` running, `lessonOpensPaused(runWord(own, '01'))` is true, `lessonOpensPaused(runWord(own, '1'))` false, a run of `'01'` on another automaton false, and no lesson running false.
- [ ] **Step 6: Run** `npx vitest run src/ui/tutorial/tutorialStore.test.ts`. Expected: FAIL.
- [ ] **Step 7: Implement** `pressNext`, `lessonOpensPaused` and the look-ahead in `tutorialStore.ts`.
- [ ] **Step 8: Run** `npm run typecheck && npm test`. Expected: all pass (Basics' tests unchanged).
- [ ] **Step 9: Commit** `feat(tutorial): idea steps, explanations, paused runs and pacing look-ahead`.

### Task 2: The card and the player wiring

**Files:**
- Modify: `src/ui/tutorial/TutorialCard.tsx`, `src/ui/tutorial/tutorial.css`
- Modify: `src/ui/shell/App.tsx` (the `TracePlayer` `autoPlay`)
- Modify: `src/ui/player/traceExtraActions.tsx` (`SaveButton` gets `data-testid="save-trace-result"`)
- Test: `src/ui/tutorial/TutorialCard.test.tsx`, `src/ui/shell/App.test.tsx`

**Interfaces:**
- Consumes: Task 1's `Step.idea`, `Step.explain`, `pressNext`, `lessonOpensPaused`, optional `Goal.automaton`.
- Produces: the Save button selector `[data-testid="save-trace-result"]` for lesson targets.

- [ ] **Step 1: Write the failing card tests** in `TutorialCard.test.tsx` (use `IDEA_LESSON` and a test lesson whose goal has no `automaton`):
  - `it('shows the idea step with a Next button and no goal row')`: on `IDEA_LESSON` step 1, `getByTestId('tutorial-next')` has name "Next", `queryByTestId('tutorial-goal')` is null, `queryByTestId('tutorial-why')` is null; clicking Next shows step 2 and the goal row.
  - `it('leads with the explanation, then the instruction')`: a step with `explain` renders `tutorial-explain` before `tutorial-instruction` in document order, and no `tutorial-why`.
  - `it('shows a goal without a picture as text and examples only')`: `queryByTestId('tutorial-goal-picture')` is null and the goal text is shown.
  - Basics' existing card tests pass unchanged.
- [ ] **Step 2: Run** `npx vitest run src/ui/tutorial/TutorialCard.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement in `TutorialCard.tsx`.** Hide `GoalRow` while `step.idea`; `GoalRow` renders `GoalPicture` only when `goal.automaton` is set (keep the `after` branch for now) and sets `data-no-picture` otherwise. In `.av-tutorial-now`: `explain` as `<p className="av-tutorial-explain" data-testid="tutorial-explain">` before the instruction; an idea step's instruction gets the extra class `av-tutorial-idea`. Under it, for an idea step only, `<div className="av-tutorial-actions"><button type="button" className="av-go" data-testid="tutorial-next" onClick={pressNext}>Next</button></div>`. Pointer: unchanged (idea steps have no target).
- [ ] **Step 4: CSS in `tutorial.css`:** `.av-tutorial-explain` 14.5px, weight 400, `line-height: 1.5`, ink colour (not muted), with the same `av-tutorial-step` entrance as `.av-tutorial-text`; `.av-tutorial-idea` weight 400; `.av-tutorial-goal[data-no-picture]` lays the text and examples on one line, wrapping when they don't fit.
- [ ] **Step 5: Run** the card tests. Expected: PASS.
- [ ] **Step 6: Write the failing App test** in `App.test.tsx`: `it('opens a run paused for a word the lesson steps by hand')`: start `IDEA_LESSON`, press Next, run `01` through the word box; the player shows a Play button (not Pause) and `step-counter` reads `Step 1 / …`. Running `1` instead plays (Pause button shown).
- [ ] **Step 7: Implement** in `App.tsx`: `const opensPaused = useTutorial((s) => (trace ? lessonOpensPaused(trace, s) : false));` and `autoPlay={(trace.kind === 'run' && !opensPaused) || trace.kind === 'subset'}`. Add the Save button test id.
- [ ] **Step 8: Run** `npm run typecheck && npm test`. Expected: PASS.
- [ ] **Step 9: Commit** `feat(tutorial): the card shows idea steps with Next, explanations first, goals without pictures`.

### Task 3: The NFAs lesson, stepped by hand

**Files:**
- Modify: `src/ui/tutorial/lessons/nfa.ts`
- Test: `src/ui/tutorial/lessons/nfa.test.ts` (rewrite)

**Interfaces:**
- Consumes: Task 1's fields; `runOf`/`ownsTrace` pattern from today's `nfa.ts`.
- Produces: `A_STAR_B_STAR` moves to `lessons/epsilon.ts` in Task 4 (delete it here; nothing else imports it).

The lesson opens on `ENDS_01: Automaton` = `{ id: 'nfa-lesson', name: 'Ends in 01', kind: 'NFA', alphabet: ['0','1'] }`, states `q_0` (120, 200), `q_1` (240, 200), `q_2` (360, 200); start `q_0`; accepting `q_2`; transitions `q_0→q_0` on `0,1` (loop up), `q_0→q_1` on `0`, `q_1→q_2` on `1`. `pausedRuns: ['001']`. Goal: text "Follow an NFA for words ending in `01`", examples `001` ✓ `010` ✗, no picture. The run of `001` is indices 0–4 (start, read 0, read 0, read 1, verdict).

Steps (instruction / explain; "at k" = the run of `001` is open at index k):

| id | instruction | explain | completes | pauseAt |
|---|---|---|---|---|
| `nfa/idea` | An NFA can have several arrows on one letter, or none. Think of it as guessing: it follows every guess at once, and accepts if any guess ends in an accepting state. | — | Next | — |
| `nfa/run` | Run `001`. | — | latch: owned run of `001` open | — |
| `nfa/read-0` | Press [→] to read the first `0`. | It starts in «q_0», with nothing guessed yet. | latch: index ≥ 1 | 1 |
| `nfa/guess` | Press [→] to read the second `0`. | It guessed this `0` starts the final `01`, so it follows both «q_0» and «q_1». | latch: index ≥ 2 | 2 |
| `nfa/dies` | Press [→] to read the `1`. | «q_1» had no arrow on `0`, so that guess died; «q_0» made the same guess again. | latch: index ≥ 3 | 3 |
| `nfa/reach` | Press [→] for the verdict. | The guess in «q_1» read `1` and reached «q_2». | latch: index ≥ 4 | — (end) |

Closing: "One guess reached an accepting state, and one is enough: an NFA accepts if any guess does."

`first` on the four paused steps: no owned run of `001` open → "First, run `001` again."; open at an index below the one the card explains (k for the step whose pauseAt is k+1; 3 for `nfa/reach`) → "First, press [→] to get back to this point." The `nfa/run` step keeps today's "That was `x`. Press [Esc] and run `001`." hint. No `target` on any step.

- [ ] **Step 1: Write the failing tests** in `nfa.test.ts`:
  - the run of `001` on `ENDS_01`: `steps.map(s => s.active)` is `[['q_0'], ['q_0','q_1'], ['q_0','q_1'], ['q_0','q_2'], ['q_0','q_2']]` and it is accepted; the goal examples hold.
  - walks: no trace → `current 0`; `pressNext` equivalent (`latched` with `nfa/idea`) → 1; run open at 0 → 2; at 1 → 3; at 2 → 4; at 3 → 5; at 4 → closing (`id 'done'`).
  - `pauseAt` of steps 2–4 at the run's index 0 is 1, 2, 3; null with no run or a run of another word.
  - Play from index 0 with `stopAt` from each card stops at 1, 2, 3, 4 in turn (simulate: for each card, its `pauseAt` is the next index).
  - `first` hints: card 4 (`nfa/dies`) with the run at index 1 → "First, press [→] to get back to this point."; with no run → "First, run `001` again."; with a run of `01` → the same.
  - a run of `01` latches nothing past `nfa/run`.
  - `explain` texts as in the table; no step has a `target`.
  - `NFA_LESSON.pausedRuns` equals `['001']`.
- [ ] **Step 2: Run** `npx vitest run src/ui/tutorial/lessons/nfa.test.ts`. Expected: FAIL.
- [ ] **Step 3: Rewrite `nfa.ts`** as above (`title: 'NFAs'`, `summary: 'Guesses, and branches that die'`, `minutes: 1`, `editable: false`).
- [ ] **Step 4: Run** `npm run typecheck && npm test`. Expected: PASS (fix `lessons/index.test.ts` only if its "Press Play" rule fails: Task 6 rewrites it; until then change its regex to `/^Press /`).
- [ ] **Step 5: Commit** `feat(lessons): NFAs teaches guessing, stepped by hand on words ending in 01`.

### Task 4: The ε-moves lesson

**Files:**
- Create: `src/ui/tutorial/lessons/epsilon.ts`, `src/ui/tutorial/lessons/epsilon.test.ts`
- Modify: `src/ui/tutorial/lessons/index.ts` (insert after NFAs)

**Interfaces:**
- Consumes: Task 1; `LESSON_IDS` already has `'epsilon'`.
- Produces: `EPSILON_LESSON: Lesson & { id: 'epsilon' }`.

Opens on `A_STAR_B_STAR` (today's a\*b\* from `nfa.ts`, `id: 'epsilon-lesson'`, `name: 'a*b*'`). `pausedRuns: ['b']`. Goal: "Follow an NFA with an ε-arrow", `b` ✓ `ba` ✗, no picture. `title: 'ε-moves'`, `summary: 'Arrows that read nothing'`, `minutes: 1`, `editable: false`. The run of `b` is indices 0–3 (start, ε-closure, read b, verdict).

| id | instruction | explain | completes | pauseAt |
|---|---|---|---|---|
| `epsilon/idea` | An ε-arrow moves without reading a letter. The NFA takes it for free, so whenever it can reach a state by ε, it is in that state too. | — | Next | — |
| `epsilon/run` | Run `b`. | — | latch: owned run of `b` open | — |
| `epsilon/closure` | Press [→] to follow the ε-arrow. | It starts in «q_0» and hasn't read anything yet. | latch: index ≥ 1 | 1 |
| `epsilon/read` | Press [→] to read the `b`. | It took the ε-arrow for free: it's in «q_0» and «q_1» before reading a letter. | latch: index ≥ 2 | 2 |
| `epsilon/verdict` | Press [→] for the verdict. | «q_0» has no arrow on `b`, but «q_1» does: no `a` was needed. | latch: index ≥ 3 | — (end) |
| `epsilon/ba` | Press [Esc], then run `ba`. | It ended in «q_1», which accepts. | run `ba`, rejected | — |

Closing: "ε costs nothing: the NFA is in every state it can reach by ε-arrows, before and after each letter."

`first` hints as in Task 3 (with `b`), on `epsilon/closure`, `epsilon/read`, `epsilon/verdict`. No targets.

- [ ] **Step 1: Write the failing tests** in `epsilon.test.ts`, mirroring Task 3's: the run of `b` has phases `['start','closure','read','verdict']` and is accepted; `ba` ends `stuck` on `a`; the walk through all six steps to the closing card; `pauseAt` 1 and 2; the `first` hints; `ba` plays (it is not in `pausedRuns`); no targets.
- [ ] **Step 2: Run** `npx vitest run src/ui/tutorial/lessons/epsilon.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write `epsilon.ts`** and add it to `LESSONS` after `NFA_LESSON`.
- [ ] **Step 4: Run** `npm run typecheck && npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(lessons): an ε-moves lesson after NFAs`.

### Task 5: Convert and Minimize: idea steps, more stops, explanations; `after` removed

**Files:**
- Modify: `src/ui/tutorial/lessons/convert.ts`, `src/ui/tutorial/lessons/minimize.ts`
- Modify: `src/ui/tutorial/engine.ts` (remove `Goal.after`), `src/ui/tutorial/TutorialCard.tsx` (remove the `after` branch and `data-wide-picture`), `src/ui/tutorial/tutorial.css` (remove `[data-wide-picture]`, `.av-tutorial-goal-wide` rules and its entry in the 760 px block)
- Test: `src/ui/tutorial/lessons/convert.test.ts`, `src/ui/tutorial/lessons/minimize.test.ts`, `src/ui/tutorial/TutorialCard.test.tsx` (drop the `after` tests)

**Interfaces:**
- Consumes: Tasks 1–2; `[data-testid="save-trace-result"]`.
- Produces: `AFTER_SPOTS` and the DFA layout move into `minimize.ts` (convert no longer draws the DFA); keep one test that the Minimize lesson's DFA equals `subsetConstruction(CONTAINS_01).result` up to positions and ids-as-labels.

**Convert** (goal "Turn this NFA into a DFA", no examples, no picture). Walkthrough indices: 1 = «{q_0,q_1}» appears, 4 = «{q_0,q_2}» appears, 9 = end.

| id | explain | instruction | completes | pauseAt | target |
|---|---|---|---|---|---|
| `convert/idea` | — | A DFA can't guess. So each DFA state stands for a set of NFA states: every state the NFA could be in at that point. | Next | — | — |
| `convert/open` | — | Press Convert to DFA at the top. | latch: owned walkthrough at index ≥ 1 | 1 | Convert to DFA button |
| `convert/pair` | After a `0` the NFA could be in «q_0» or «q_1», so the DFA gets the state «{q_0,q_1}». | Press Play. | latch: index ≥ 4 | 4 | — |
| `convert/accepting` | «{q_0,q_2}» holds «q_2», which accepts, so this DFA state accepts too. | Press Play to finish. | latch: last index | — | — |
| `convert/save` | Every set the NFA can reach is now a state: four in all. | Press Save as new automaton to keep the DFA. | latch: `owned.length > 1` | — | `[data-testid="save-trace-result"]` |

Find indices 1 and 4 by `revealedStates` of the states labelled `{q_0,q_1}` and `{q_0,q_2}`, as `pairAt` does today. `first` hints: no walkthrough → "First, press Convert to DFA again."; on `convert/save` short of the end → "First, press Play to reach the end." (keep today's logic).

**Minimize** (goal "Make this DFA as small as possible", no examples, no picture). Opens paused at index 0 (partition); 1 = split; 2 = end.

| id | explain | instruction | completes | pauseAt | target |
|---|---|---|---|---|---|
| `minimize/idea` | — | Two states are the same if no word can tell them apart: from both, every word is accepted or rejected alike. Minimizing merges such states. | Next | — | — |
| `minimize/open` | — | Press Minimize at the top. | latch: owned walkthrough open | — | Minimize button |
| `minimize/groups` | It starts with two groups, accepting and not: the empty word already tells those apart. | Press Play. | latch: index ≥ 1 | 1 | — |
| `minimize/split` | On `1`, «{q_0}» stays out of accepting but «{q_0,q_1}» gets in, so they split. | Press Play to finish. | latch: last index | — | — |
| `minimize/save` | No symbol tells «{q_0,q_2}» and «{q_0,q_1,q_2}» apart, so they merge. | Press Save as new automaton to keep the smaller DFA. | latch: `owned.length > 1` | — | `[data-testid="save-trace-result"]` |

- [ ] **Step 1: Rewrite the tests** in `convert.test.ts` and `minimize.test.ts`: the walk through every step on fixture contexts to the closing card; the trace indices (1 and 4 revealed; split at 1, end at 2); `pauseAt` values; explanations as in the tables; targets; and `it('lands on the first stop when the walkthrough was opened during the idea step')`: Convert: `pacingStep(CONVERT_LESSON, 0)!.pauseAt!(ctxAt0) === 1`, and `advance` with `convert/idea` latched and the walkthrough at index 1 puts the card on `convert/pair`; Minimize: `advance` with `minimize/idea` latched and the walkthrough open at index 0 puts the card on `minimize/groups`.
- [ ] **Step 2: Run** both files. Expected: FAIL.
- [ ] **Step 3: Rewrite `convert.ts` and `minimize.ts`**; remove `Goal.after`, the card's `after` branch, its CSS and tests.
- [ ] **Step 4: Run** `npm run typecheck && npm run lint && npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(lessons): Convert and Minimize open with the idea and explain each stop`.

### Task 6: Share's goal, the caps test, and one way into the lessons

**Files:**
- Modify: `src/ui/tutorial/lessons/share.ts` (goal: drop `automaton` and `description`)
- Modify: `src/ui/tutorial/lessons/index.test.ts`
- Modify: `src/ui/shell/ControlsDialog.tsx` (remove the header Lessons button and `LESSONS_TAB`'s use for it), `src/ui/shell/App.css` (remove `.av-guide-tutorial`)
- Test: `src/ui/shell/ControlsDialog.test.tsx`

- [ ] **Step 1: Update `index.test.ts`:**
  - caps: instruction ≤ 100, or ≤ 240 when `s.idea`; why ≤ 110 (70 Basics); `explain` ≤ 140.
  - `it('follows a step that pauses playback with one whose instruction says what to press')`: `/^Press /`.
  - `it('opens every lesson but Basics and Share with an idea step, and no other step is one')`.
  - `it('shows no goal picture outside Basics')`: `part.goal.automaton` undefined for every lesson but Basics.
  - `it('points at nothing on the word box or the dock outside Basics')`: no target contains `Word` or `data-testid="dock"`.
  - goal examples check runs on `part.goal.automaton ?? lesson.start`.
  - `it('lists the lessons in order')`: ids `['basics','nfa','epsilon','convert','minimize','share']`.
- [ ] **Step 2: Update `ControlsDialog.test.tsx`:** the Tab order test goes dialog → Close controls → Build tab (no header Lessons button), and `ArrowLeft` twice from Arrange still selects the Lessons tab; the test "the header's Lessons button opens the Lessons tab…" becomes "the Lessons tab lists the lessons, a row starts its lesson" (click the tab instead); add `expect(within(d).queryByRole('button', { name: 'Lessons' })).toBeNull()`.
- [ ] **Step 3: Run** both files. Expected: FAIL.
- [ ] **Step 4: Implement:** Share's goal without a picture; remove the header button and its CSS.
- [ ] **Step 5: Run** `npm run typecheck && npm run lint && npm run format:check && npm test`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(lessons): Share's goal without a picture, caps for idea and explain, one way into the lessons`.

### Task 7: End to end, and the docs

**Files:**
- Modify: `e2e/lessons.spec.ts`
- Modify: `docs/superpowers/specs/2026-11-15-lessons-design.md` (point *Playback*, the `after` paragraph and *The first lessons* at the new spec), `CLAUDE.md` (the tutorial bullets: lesson list with `epsilon`, idea steps, `explain`, `pausedRuns`), `PROGRESS.md` (tick the new items under *Lessons*)

- [ ] **Step 1: Rewrite `e2e/lessons.spec.ts`:**
  - first test: open `?`, click the **Lessons tab** (no header button), start Basics, Restart as now.
  - NFAs: start; card shows `tutorial-next`; click Next; run `001`; the player shows Play and `step-counter` "Step 1 / 5"; press → four times, checking after each that the card contains the explanation (`'nothing guessed'`, `'follows both'`, `'that guess died'`, `'reached'`); verdict accepted; closing card; Finish; ✓ in the list.
  - ε-moves: Next; run `b` (opens paused); → three times; Esc; run `ba` plays to a rejected verdict; Finish.
  - Convert: Next; Convert to DFA; it stops at "Step 2 / 10" with the card containing `'{q_0,q_1}'`-explanation text ("After a 0"); Play → stops at "Step 5 / 10" (card contains "accepts too"); Play → "Step 10 / 10"; Save; Finish; history has "Contains 01 → DFA". No `tutorial-goal-picture`.
  - Minimize: Next; Minimize opens at "Step 1 / 3", card contains "two groups"; Play → "Step 2 / 3", card contains "so they split"; Play → "Step 3 / 3"; Save; Finish.
  - Share: as now.
  - One test: in Convert, click Convert to DFA **before** Next; it still stops at "Step 2 / 10"; click Next; the card contains "After a 0".
- [ ] **Step 2: Run** `npm run build && npx playwright test e2e/lessons.spec.ts e2e/tutorial.spec.ts`. Expected: all pass.
- [ ] **Step 3: Update the docs** listed above.
- [ ] **Step 4: Run** the full gate: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run e2e`. Expected: all pass.
- [ ] **Step 5: Commit** `test(e2e): lessons with idea steps, hand-stepped NFA runs and ε-moves; docs follow`.
