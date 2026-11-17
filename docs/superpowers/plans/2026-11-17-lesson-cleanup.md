# Lessons Leave No Automata Behind Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finishing a lesson removes all its automata, lesson automata are never autosaved, and the empty-canvas hint never shows on a lesson's automaton.

**Architecture:** A new `lessonIds: string[]` in the app store (never saved, like `readOnly`) holds every automaton the running lesson owns. The tutorial store keeps it equal to `owned`; autosave filters it out; the canvas hides its hint for it. `finishLesson` removes `owned` for every lesson, as `quitLesson` does.

**Tech Stack:** TypeScript strict, React 19, Zustand + immer, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-lesson-cleanup-design.md`

## Global Constraints

- `core/` and `layout/` untouched; `src/store` and `src/persistence` must not import `src/ui`.
- `useCanvasEditing.ts` must not import the tutorial store (Canvas reads `lessonIds` from the app store only).
- `useAppStore` selectors return stable references (a boolean, not a fresh array).
- No file-format change: `automotion:v1`, version 2, `migrate()` untouched.
- Keep every existing `data-testid` and accessible name.
- Run `npm run format` before each commit (CI runs `format:check`).

## Review Focus

1. Reload mid-lesson when the lesson's automata are the only ones (first visit straight into Basics): the app must open on a blank Untitled, not the placeholder canvas with no automaton. Pinned in Task 1 (load) and Task 4 (e2e).
2. The user's own automata edited during a lesson must still be saved. Pinned in Task 1.
3. Starting another lesson (or the same one) from a finished lesson's closing card must not leave the finished one's automata behind. Pinned in Task 2.
4. A walkthrough result saved during a lesson (Convert, Minimize) must be removed on Finish and never saved. Pinned in Task 2 and Task 4.
5. Basics' automaton emptied midway (every state deleted) must still show no hint. Pinned in Task 3.

---

### Task 1: `lessonIds` in the store, kept out of autosave; empty list loads as blank

**Files:**
- Modify: `src/store/store.ts` (field next to `readOnly` ~line 57, setter next to `setReadOnly` ~line 101/418, initial state ~line 139/153)
- Modify: `src/persistence/useAutosave.ts`
- Modify: `src/persistence/storage.ts` (`loadFromStorage`)
- Test: `src/persistence/useAutosave.test.tsx`, `src/persistence/persistence.test.ts`

**Interfaces:**
- Produces: `AppState.lessonIds: string[]` (doc: "Ids of the running lesson's automata: never autosaved, no empty-canvas hint; never saved itself.") and `AppState.setLessonIds(ids: string[]): void`. Both are reset by `resetAppStore`.

- [ ] **Step 1: Write the failing tests**

In `useAutosave.test.tsx`:

```ts
it('does not save the running lesson’s automata, but saves the user’s own', () => {
  renderHook(() => useAutosave());
  add('Mine');
  add('Lesson');
  act(() => appStore.getState().setLessonIds([appStore.getState().activeId!]));
  add('Mine 2'); // a later change triggers the save
  act(() => { vi.advanceTimersByTime(600); });
  const saved = localStorage.getItem(STORAGE_KEY)!;
  expect(saved).toContain('"Mine"');
  expect(saved).toContain('"Mine 2"');
  expect(saved).not.toContain('"Lesson"');
});

it('saves an empty list when every automaton is a lesson’s', () => {
  renderHook(() => useAutosave());
  add('Lesson');
  act(() => appStore.getState().setLessonIds([appStore.getState().activeId!]));
  act(() => { vi.advanceTimersByTime(600); });
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).automata).toEqual([]);
});
```

In `persistence.test.ts`, replace `a stored empty list stays empty` with:

```ts
it('a stored empty list loads as one blank DFA', () => {
  const s = memoryStorage();
  saveToStorage(s, []);
  const { automata } = loadFromStorage(s);
  expect(automata).toHaveLength(1);
  expect(automata[0]).toMatchObject({ name: 'Untitled', kind: 'DFA', states: [] });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/persistence`
Expected: FAIL (`setLessonIds is not a function`; the empty list loads as `[]`).

- [ ] **Step 3: Implement**

- `store.ts`: add `lessonIds` / `setLessonIds` exactly like `readOnly` / `setReadOnly`.
- `useAutosave.ts`: `save` writes `automata.filter((a) => !lessonIds.includes(a.id))`, both read from `appStore.getState()` at save time. Update its doc comment ("…the automata, less the running lesson's…").
- `storage.ts` `loadFromStorage`: when the parsed list is empty, return `blank()` (after the old-example cleanup, so the `dropOldExamples` path is unchanged).

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/persistence src/store`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/store/store.ts src/persistence
git commit -m "feat(persistence): never autosave the running lesson's automata; an empty list loads blank"
```

### Task 2: The tutorial keeps `lessonIds` in step; Finish removes every lesson's automata

**Files:**
- Modify: `src/ui/tutorial/tutorialStore.ts` (`setOwned` ~117, `startLesson` ~210, `finishLesson` ~339, `endLesson` ~365, and the doc comments that say Finish keeps automata)
- Modify: `src/ui/tutorial/FinishedCard.tsx` (drop the "Its automata stay in your history." note, ~line 96)
- Modify: `src/ui/tutorial/tutorial.css` (drop the now-unused `.av-welcome-note.av-finished-note` rule, ~line 631; keep the `.av-finished .av-welcome-actions` rule)
- Test: `src/ui/tutorial/tutorialStore.test.ts`, `src/ui/tutorial/TutorialCard.test.tsx`

**Interfaces:**
- Consumes: `appStore.getState().setLessonIds(ids: string[])` from Task 1.
- Produces: while a lesson runs, `appStore.getState().lessonIds` equals `tutorialStore.getState().owned`; `[]` once it ends.

- [ ] **Step 1: Write the failing tests** (in `tutorialStore.test.ts`; `TEST_LESSON` has a `start` automaton; reuse the file's `app`, `tut`, `loop` helpers)

```ts
it('lessonIds follows owned and clears when the lesson ends', () => {
  startLesson('basics');
  expect(app().lessonIds).toEqual([tut().automatonId]);
  endLesson();
  expect(app().lessonIds).toEqual([]);
});

it('Finish of a lesson removes its copy and what was saved from its walkthrough', () => {
  resetAppStore({ automata: [loop()] });
  startLesson(TEST_LESSON);
  const copy = tut().automatonId;
  // Simulate a saved walkthrough result joining `owned`, as follow() does.
  const saved = { ...loop(), id: 'saved', name: 'saved' };
  app().addAutomaton(saved);
  tutorialStore.setState({ owned: [copy!, 'saved'] });
  app().setLessonIds([copy!, 'saved']);
  finishLesson();
  expect(app().automata.map((a) => a.id)).toEqual(['mine']);
  expect(app().activeId).toBe('mine');
  expect(app().lessonIds).toEqual([]);
});
```

If the codebase already has a way to run a real walkthrough save from a lesson in these tests (check `traceActions` / `follow` usage in the file), use that instead of setting `owned` by hand.

Change `starting again from the closing card keeps the finished one` to `starting again from the closing card removes the finished one`: assert `app().automata.some((a) => a.id === first)` is `false` and `active()?.name` is `'Tutorial'`.

In `TutorialCard.test.tsx` `finishes with lesson wording`: assert `expect(popup).not.toHaveTextContent('stay in your history')`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/ui/tutorial`
Expected: FAIL on the four tests above.

- [ ] **Step 3: Implement**

- `setOwned(owned)`: also `appStore.getState().setLessonIds(owned)` (always, editable or not).
- `startLesson`: drop the closing-card branch: always `quitLesson()` (it ends any lesson and removes its automata; on no lesson it's a no-op). After setting the tutorial state, call `setOwned([automatonId])` instead of the bare `setReadOnly`. Update its doc comment ("Starting removes the previous lesson's automata, finished or not").
- `finishLesson`: remove `owned` for every lesson (the `noun === 'tutorial'` branch and the `requestAnimationFrame` fit of kept automata go); then set `celebrating` and play the fanfare. Doc comment: "A lesson leaves nothing behind: its automata are removed, leaving the user's own, or a blank Untitled."
- `endLesson`: when it was active, also `setLessonIds([])`. Its doc comment no longer says the automata "stay like any other" unconditionally: say they become ordinary automata (only reached directly by tests and `quitLesson`/`finishLesson`, which then remove them).
- `requestLesson`: unchanged (no confirm on the closing card: nothing unfinished is lost).
- `FinishedCard.tsx` / `tutorial.css`: drop the note and its rule.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/ui/tutorial`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/ui/tutorial
git commit -m "feat(lessons): Finish removes a lesson's automata, and starting another removes a finished one's"
```

### Task 3: No empty-canvas hint on a lesson's automaton

**Files:**
- Modify: `src/ui/canvas/Canvas.tsx` (the `automaton.states.length === 0 &&` hint, ~line 184)
- Test: `src/ui/canvas/Canvas.test.tsx`

**Interfaces:**
- Consumes: `AppState.lessonIds` from Task 1.

- [ ] **Step 1: Write the failing test** (next to `shows a hint while the automaton has no states`, same `load` helper)

```ts
it('shows no hint on a lesson’s empty automaton', () => {
  load(fixture({ kind: 'DFA', alphabet: 'a', states: [], name: 'm' }));
  act(() => appStore.getState().setLessonIds([appStore.getState().activeId!]));
  render(<Canvas />);
  expect(screen.queryByTestId('canvas-hint')).toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/ui/canvas/Canvas.test.tsx -t "lesson"`
Expected: FAIL (hint found).

- [ ] **Step 3: Implement**

`const inLesson = useAppStore((s) => s.activeId !== null && s.lessonIds.includes(s.activeId));` beside the other selectors (before the early `!automaton` return, hooks order), and show the hint only when `automaton.states.length === 0 && !inLesson`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ui/canvas`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/ui/canvas
git commit -m "feat(canvas): no empty-canvas hint on a lesson's automaton"
```

### Task 4: e2e, docs, full verification

**Files:**
- Modify: `e2e/lessons.spec.ts`, `e2e/tutorial.spec.ts`
- Modify: `CLAUDE.md`, `PROGRESS.md`
- Check: `README.md` (no line says lesson automata stay; change one if found)

- [ ] **Step 1: Update and add e2e tests**

- `lessons.spec.ts`, Convert test: after `finish(...)`, assert the History navigation `not.toContainText('Contains 01 → DFA')` and `not.toContainText('Contains 01')` (the lesson copy's name).
- `lessons.spec.ts`, new test `a reload midway leaves no lesson automaton behind`: `openApp(page, { clear: true })`, `startLesson(page, 'lesson-nfa')`, `page.reload()`, then the card has count 0 and the History navigation does not contain `Ends in 01`, and `canvas-hint` is visible (the blank Untitled).
- `tutorial.spec.ts`, new test `Basics opens on a canvas without the hint`: `openApp(page, { clear: true })`, start Basics from the Controls Lessons tab (`lesson-basics`, same steps as `startLesson` in `lessons.spec.ts`), expect `tutorial-card` visible and `canvas-hint` count 0, and no button named `or build one from a regex`.

- [ ] **Step 2: Run e2e**

Run: `npm run e2e` (first time: `npx playwright install chromium`)
Expected: all pass.

- [ ] **Step 3: Docs**

- `CLAUDE.md` (`src/ui/` lesson notes): "automata saved from their walkthroughs belong to the lesson (Quit removes them, Finish keeps them)" → "…belong to the lesson; Quit and Finish both remove them, and none are autosaved (the store's `lessonIds`, which also hides the empty-canvas hint)". Also the Basics sentence "a lesson's Finish keeps its automata and offers Next" → "a lesson's Finish offers Next". In the `src/store/` section add one bullet: "`lessonIds` (set by the tutorial, never saved): the running lesson's automata, left out of the autosave."
- `PROGRESS.md`: new `### Lessons leave no automata behind (2026-11-17)` at the top of Done with ticked items: Finish removes a lesson's automata (copy and saved walkthrough results), as Quit does; starting a lesson from a finished one's closing card removes it too; lesson automata are never autosaved, so a reload midway leaves nothing (an empty saved list opens a blank Untitled); no empty-canvas hint on a lesson's automaton (Basics' regex link filled the Tutorial automaton).

- [ ] **Step 4: Full verification**

Run: `npm run typecheck && npm run lint && npm run format:check && npm test`
Expected: all succeed, no failures.

- [ ] **Step 5: Commit**

```bash
git add e2e CLAUDE.md PROGRESS.md README.md
git commit -m "test(e2e): lessons leave nothing behind; docs"
```
