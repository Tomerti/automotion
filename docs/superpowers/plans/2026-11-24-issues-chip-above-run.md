# Issues Chip Above the Run Box Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the "⚠ N issues" chip from the top bar to float, larger and opaque, just above the run pill.

**Architecture:** `IssuesChip` renders inside `App`'s `.av-dock`, before `RunPanel`; CSS positions its
anchor absolutely above the dock so the dock's measured height (`--av-dock-h`) is unchanged; its
popover opens upwards. No logic changes in `IssuesChip`.

**Tech Stack:** React 19, CSS, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-issues-chip-above-run-design.md`

## Global Constraints

- Keep the chip's behaviour: hidden without issues, on a blank automaton and while a trace is open; grey (`data-severity="muted"`) on the tutorial's automaton.
- Keep accessible names (`button` "N issues", dialog "Issues"); hover styles stay inside `@media (hover: hover)`.
- Anchor: `bottom: calc(100% + 8px)`, centred; chip 30 px tall, 13 px text, tint mixed into `--av-surface-raised`, `--av-shadow-float`.

## Review Focus

- The dock's height must not change when issues appear (trace views pad by it): the anchor is out of flow.
- The popover must open upwards and stay on screen at 360 px wide (`min(340px, 100vw - 24px)`, centred).
- 481–760 px: toasts must not cover the chip (`bottom` raised from 72 px).
- Tutorial Basics: the muted chip above the framed run pill must stay readable (check in the browser).
- A long count ("12 issues") must not wrap (`white-space: nowrap`).

---

### Task 1: Chip above the run pill

**Files:**
- Modify: `src/ui/shell/TopBar.tsx` (drop `IssuesChip`), `src/ui/shell/App.tsx` (render it in the dock), `src/ui/shell/App.css` (chip, anchor, popover, 481–760 px toasts)
- Test: `src/ui/shell/App.test.tsx`
- Docs: `README.md` line 71, `PROGRESS.md` (Done entry dated 2026-11-24)

**Interfaces:** Consumes `IssuesChip(): JSX.Element | null` unchanged.

- [ ] **Step 1: Write the failing test** in `App.test.tsx`: `it('the issues chip floats in the dock above the run pill, not in the top bar')`, with an unreachable-state DFA (`q1` unreachable) active: `expect(screen.getByTestId('dock')).toContainElement(screen.getByRole('button', { name: '1 issue' }))` and `expect(screen.getByRole('banner')).not.toContainElement(that button)`.
- [ ] **Step 2: Run** `npx vitest run src/ui/shell/App.test.tsx -t "issues chip"`; expected FAIL (chip is in the banner).
- [ ] **Step 3: Move the chip and restyle** per the Global Constraints; popover `top: auto; bottom: calc(100% + 6px); left: 50%; translate: -50% 0` (`translate`, not `transform`, which `av-pop-in` animates); toasts at 481–760 px `bottom: 112px`.
- [ ] **Step 4: Run** `npx vitest run src/ui/shell`; expected PASS.
- [ ] **Step 5: Docs:** README "The issues chip above the word box lists what is wrong…"; PROGRESS Done entry.
- [ ] **Step 6: Verify** `npm run typecheck && npm run lint && npm run format:check && npm test && npm run e2e`, then look at it in the browser (editing, tutorial, ~600 px wide).
- [ ] **Step 7: Commit** `feat(issues): the issues chip floats above the run box`.
