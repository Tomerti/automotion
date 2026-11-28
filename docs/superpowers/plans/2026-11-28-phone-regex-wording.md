# Phones Can Build From a Regex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On touch-only devices, the welcome lists building from a regex as something a phone can
do, and the empty canvas leads with a "Create a DFA from a regex" link instead of desktop
instructions.

**Architecture:** Copy changes in the touch-only branch of `WelcomeCard.tsx`; `Canvas.tsx` picks a
phone or desktop empty-canvas hint with the existing `useTouchOnly()` hook (`ui/shell/touch.ts`).

**Tech Stack:** React 19, Vitest + Testing Library, Playwright (iPhone 13 emulation).

**Spec:** `docs/superpowers/specs/2026-11-28-phone-regex-wording-design.md`

## Global Constraints

- Exact copy (verbatim): headline `Best on a computer`; body `Drawing automata takes a mouse and keyboard. On a phone you can:`; checklist in order `Build one from a regex` (yes), `Open shared automata` (yes), `Run words on them` (yes), `Draw or edit by hand` (no); canvas link `Create a DFA from a regex`; canvas line `Building by hand needs a computer`.
- The phone welcome keeps **Got it** as its only button.
- Desktop welcome and desktop empty-canvas hint unchanged (including `or build one from a regex`).
- Keep `data-testid="canvas-hint"`, `welcome-device-note`, and the existing accessible names.
- Hover styles only inside `@media (hover: hover)`.

## Review Focus

- A tablet that gets a mouse attached while the canvas is empty: the hint switches to the desktop version live (Task 2 test).
- A lesson's empty automaton on a phone: still no hint at all (Task 2 test).
- A laptop with a touch screen (coarse + fine pointers): desktop hint, not the phone one (Task 2 test).
- The phone link must be tappable while the rest of the hint lets pointers through (`pointer-events: auto` only on the link); its taller tap area must not shift the line onto a different dot row (Task 2, inline vertical padding).
- Tapping the link on a real phone viewport opens the dialog and the built DFA runs (Task 2 e2e).

---

### Task 1: Phone welcome wording

**Files:**
- Modify: `src/ui/tutorial/WelcomeCard.tsx` (`PHONE_CAN`, the callout's head and body)
- Test: `src/ui/tutorial/WelcomeCard.test.tsx` (`on a touch-only device offers Got it instead of the tutorial`)
- Test: `e2e/phone.spec.ts` (welcome assertions only)

**Interfaces:** none shared.

- [ ] **Step 1: Update the unit test's expectations**

In `on a touch-only device offers Got it instead of the tutorial`:
```ts
expect(within(d).getByText(/Drawing automata takes a mouse and keyboard/)).toBeInTheDocument();
expect(note).toHaveTextContent('Best on a computer');
expect(rows).toEqual([
  'Yes: Build one from a regex',
  'Yes: Open shared automata',
  'Yes: Run words on them',
  'No: Draw or edit by hand',
]);
```
Keep its other assertions (no Start tutorial / Not now, Got it closes it).

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/ui/tutorial/WelcomeCard.test.tsx`
Expected: FAIL on the body text / headline / rows.

- [ ] **Step 3: Change the copy in `WelcomeCard.tsx`** to the Global Constraints' welcome strings.

- [ ] **Step 4: Run it and see it pass** (same command; PASS).

- [ ] **Step 5: Update `e2e/phone.spec.ts`'s welcome checks**: `toContainText('Drawing automata takes a mouse and keyboard')`, listitems `['Build one from a regex', 'Open shared automata', 'Run words on them', 'Draw or edit by hand']`, note `toContainText('Best on a computer')`. Rename the test to `the phone welcome says what a phone can do, then a shared link opens and runs`.

- [ ] **Step 6: Commit**

```bash
git add src/ui/tutorial/WelcomeCard.tsx src/ui/tutorial/WelcomeCard.test.tsx e2e/phone.spec.ts
git commit -m "feat(phone): the welcome lists building from a regex"
```

### Task 2: Phone empty-canvas hint

**Files:**
- Modify: `src/ui/canvas/Canvas.tsx` (the `automaton.states.length === 0 && !inLesson` hint, ~line 194)
- Modify: `src/ui/canvas/Canvas.css` (a phone link modifier next to `.av-canvas-hint-link`)
- Modify: `src/ui/shell/RegexDialog.tsx:28` (doc comment: name both ways in)
- Test: `src/ui/canvas/Canvas.test.tsx`
- Test: `e2e/phone.spec.ts`
- Docs: `README.md:122`, `PROGRESS.md`

**Interfaces:**
- Consumes: `useTouchOnly(): boolean` from `src/ui/shell/touch.ts`; `openRegexDialog` (already imported in `Canvas.tsx`).

- [ ] **Step 1: Write the failing tests** in `Canvas.test.tsx`, with a local `stubPointers(coarse, fine)` copied from `WelcomeCard.test.tsx` (and `vi.unstubAllGlobals()` in `finally`):

- `on a phone the empty canvas leads with the regex link`: `stubPointers(true, false)`; empty DFA; the hint's button named `Create a DFA from a regex` opens the regex dialog (`useRegexDialog.getState().open === true`); the hint has text `Building by hand needs a computer`; `not.toHaveTextContent('Double-click')`, `not.toHaveTextContent('Ctrl+V')`; no button named `or build one from a regex`.
- `a laptop with a touch screen keeps the desktop hint`: `stubPointers(true, true)`; hint has `Double-click to add a state · Press ? for controls` and the button `or build one from a regex`.
- `the hint follows a mouse being attached`: a matchMedia stub with listeners and a mutable `fine` (as in WelcomeCard's `switches to the tutorial offer…` test); starts with `Create a DFA from a regex`, after `fine = true` and firing listeners in `act`, shows `Double-click to add a state`.
- `shows no hint on a lesson's empty automaton on a phone`: `stubPointers(true, false)` plus `setLessonIds`, `queryByTestId('canvas-hint')` is null.

- [ ] **Step 2: Run them and see the first and third fail**

Run: `npx vitest run src/ui/canvas/Canvas.test.tsx -t "phone|touch screen|mouse being attached"`
Expected: FAIL (no `Create a DFA from a regex` button).

- [ ] **Step 3: Implement** in `EditableCanvas`: `const touchOnly = useTouchOnly();` and, inside the existing `canvas-hint` div, render for `touchOnly`:
  - `<p><button type="button" className="av-canvas-hint-link av-canvas-hint-tap" onClick={openRegexDialog}>Create a DFA from a regex</button></p>`
  - `<p className="av-canvas-hint-small">Building by hand needs a computer</p>`

  else today's three paragraphs unchanged. CSS: `.av-canvas-hint-tap { padding: 12px 0; }`. The button is `display: inline`, so vertical padding grows the tap area to 44 px (20 px line + 24) without moving the line off its dot row. Add a comment saying so.

- [ ] **Step 4: Run the whole file and see it pass**

Run: `npx vitest run src/ui/canvas/Canvas.test.tsx`
Expected: PASS (existing desktop hint tests included).

- [ ] **Step 5: Extend `e2e/phone.spec.ts`** with a new test `a phone builds a DFA from a regex on the empty canvas`: go to `./`, tap **Got it**; tap the button `Create a DFA from a regex`; the dialog `Create a DFA from a regex` is visible; fill `regex-input` with `(a|b)*ab`; tap `regex-build`; `state-q_0` is visible inside the viewport (same box check the existing test uses); the link's `boundingBox().height` is at least 44; fill Word `bab`, Enter, tap Last, `verdict` has `data-accepted="true"`.

- [ ] **Step 6: Run e2e for the phone spec**

Run: `npm run build && npx playwright test e2e/phone.spec.ts`
Expected: 2 passed.

- [ ] **Step 7: Docs**
  - README line 122: `- **Phones** can build an automaton from a regex, open share links and run words; drawing by hand needs a mouse and keyboard.`
  - PROGRESS.md: a new dated section `### Phones build from a regex (2026-11-28)` at the top of the done sections, ticked items for the welcome copy and the phone canvas hint (with the 44 px tap area), in the file's existing style.
  - `RegexDialog.tsx:28` comment: "The empty canvas's regex link (“or build one from a regex”, on a phone “Create a DFA from a regex”)".

- [ ] **Step 8: Full check**

Run: `npm run typecheck && npm run lint && npm run format:check && npm test`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/ui/canvas/Canvas.tsx src/ui/canvas/Canvas.css src/ui/canvas/Canvas.test.tsx src/ui/shell/RegexDialog.tsx e2e/phone.spec.ts README.md PROGRESS.md
git commit -m "feat(phone): the empty canvas leads with Create a DFA from a regex"
```
