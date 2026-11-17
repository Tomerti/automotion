# Regex Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From regex creates one minimal DFA directly (no walkthrough), To regex simplifies common
patterns (`a*b*` → `a*b*`), and Create opens a menu (Blank automaton / From regex…).

**Architecture:** A pure `core/regexToDfa.ts` chains the existing Thompson NFA builder,
`subsetConstruction` and `minimize`, then relabels; a store action lays the result out in the
layout worker and adds it. `core/regexSimplify.ts` gains sound rewrites. The Thompson walkthrough
(trace kind, view, layout) is deleted once nothing opens it.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), React 19, Zustand + immer, Vitest +
fast-check + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-regex-rework-design.md` (wins over the first regex spec
`2026-11-17-regex-design.md`, which still describes the syntax, the dialog and To regex).

## Global Constraints

- `core/` imports nothing outside `core/`; no React there. Nothing outside `ui/` imports `ui/`.
- Regex syntax unchanged (`|` `+` `*` juxtaposition `( )` `ε`/`\eps` `∅`/`\emptyset`, no `?`).
- From regex: exactly one automaton added, kind `DFA`, name `printRegex(regex)`, minimal, complete,
  states labelled `q_0`, `q_1`, … breadth-first from the start (targets in alphabet order), no
  `mergedFrom`.
- Refusals (exact text): parse errors as `parseRegex` gives them; over `MAX_REGEX_INPUT = 1000`
  characters (normalised) → `Too long: at most 1000 characters`; DFA past `MAX_DFA_STATES` (64) →
  `Too big: the DFA would have more than 64 states`.
- Create keeps its accessible name `Create` and its title; it opens a menu with menu items
  `Blank automaton` and `From regex…`. The ▾ button ("More ways to create") is gone.
- Existing `data-testid`s (`regex-input`, `regex-build`, `regex-error`) stay. Hover styles inside
  `@media (hover: hover)`; colours via theme tokens.
- Run `npm run typecheck && npm run lint && npm test` and `npm run format` before every commit.

## Review Focus

1. **From regex while a trace is open** (a run, a lesson walkthrough): the new DFA opens, the trace
   closes, nothing stays locked. → Task 3 test `createFromRegex closes an open trace`.
2. **Degenerate regexes `ε`, `∅`, `ε*`, `∅*`**: a valid DFA (no `validate` errors) that lays out and
   can be run. → Task 2 test `degenerate regexes give valid DFAs`.
3. **Non-Latin and astral symbols** (`א|ב`, `😀*`): alphabet and transitions use the right symbols.
   → Task 2 test `astral and non-Latin symbols`.
4. **A read-only lesson automaton is active** when creating from regex: the new automaton is
   editable. → Task 3 test `the new DFA is editable even when a lesson automaton was active`.
5. **Rewrites inside longer unions and concatenations** (`ε|b|aa*`, `ba*a*`): still sound and
   applied. → Task 1 rule table rows and the existing elimination language property.

---

### Task 1: More simplification rewrites for To regex

**Files:**
- Modify: `src/core/regexSimplify.ts`, `src/core/regexSimplify.test.ts`, `src/core/eliminate.test.ts`

**Interfaces:**
- Consumes/produces: the existing `mkUnion`, `mkConcat`, `mkStar`, `EPS`, `EMPTY`, `mkSym` (signatures
  unchanged).

- [ ] **Step 1: Write the failing tests** — extend the rule table in `regexSimplify.test.ts`
  (`A = mkSym('a')`, `B = mkSym('b')`):

```ts
[() => mkUnion(EPS, mkConcat(A, mkStar(A))), 'a*'],      // ε|rr* = r*
[() => mkUnion(EPS, mkConcat(mkStar(A), A)), 'a*'],      // ε|r*r = r*
[() => mkUnion(mkConcat(A, mkStar(A)), EPS), 'a*'],      // order-independent
[() => mkUnion(EPS, mkStar(A)), 'a*'],                   // ε|r* = r*
[() => mkUnion(A, mkStar(A)), 'a*'],                     // r|r* = r*
[() => mkUnion(mkUnion(EPS, B), mkConcat(A, mkStar(A))), 'b|a*'], // inside a longer union
[() => mkStar(mkUnion(EPS, A)), 'a*'],                   // (ε|r)* = r*
[() => mkConcat(mkStar(A), mkStar(A)), 'a*'],            // r*r* = r*
[() => mkConcat(mkConcat(B, mkStar(A)), mkStar(A)), 'ba*'], // adjacent factors inside a chain
[() => mkConcat(mkUnion(EPS, A), mkStar(A)), 'a*'],      // (ε|r)r* = r*
[() => mkConcat(mkStar(A), mkUnion(EPS, A)), 'a*'],      // r*(ε|r) = r*
[() => mkConcat(A, mkStar(A)), 'aa*'],                   // unchanged: no rule
```

  and in `eliminate.test.ts`:

```ts
it('a*b* comes back as a*b*', () => {
  // minimal complete DFA for a*b*: A (start, accepting) a→A b→B; B (accepting) b→B a→D; D a,b→D
  expect(eliminate(aStarBStar).regex).toBe('a*b*');
});
```

- [ ] **Step 2: Run** `npx vitest run src/core/regexSimplify.test.ts src/core/eliminate.test.ts`.
  Expected: the new rows and `a*b*` FAIL.
- [ ] **Step 3: Implement** in `regexSimplify.ts`, comparing expressions by printed text:
  - `mkUnion`: after flattening and dropping `∅`/duplicates, if some branch is a star `r*`, drop `ε`
    and drop any branch equal to `r`; if `ε` is present and a branch is `rr*` or `r*r`, replace that
    branch with `r*` and drop `ε`. A single remaining branch is returned as itself.
  - `mkStar`: a body that is a union containing `ε` loses the `ε` first (`(ε|r)* = r*`).
  - `mkConcat`: look at the adjacent factors (the last factor of `a`, the first of `b`, through
    left-associative concat chains): `r*`·`r*`, `(ε|r)`·`r*` and `r*`·`(ε|r)` collapse to `r*`.
  Keep each rule a small named helper; no other rewrites.
- [ ] **Step 4: Run** both files and `npx vitest run src/core` (the elimination language property
  guards soundness). Expected: PASS. Update the existing ends-in-1 pin only if its output changed,
  and say so in the report.
- [ ] **Step 5: Commit** `feat(core): To regex simplifies ε|rr*, r*r*, (ε|r)* and friends`.

---

### Task 2: Regex → minimal DFA (core)

**Files:**
- Create: `src/core/regexToDfa.ts`, `src/core/regexToDfa.test.ts`
- Modify: `src/core/thompson.ts` (extract the NFA builder)

**Interfaces:**
- Consumes: `parseRegex`, `normalizeRegexText`, `printRegex`, `regexSymbols` (`core/regex.ts`);
  `subsetConstruction`, `MAX_DFA_STATES` (`core/subset.ts`); `minimize` (`core/minimize.ts`);
  `testing/language.ts`.
- Produces:
  ```ts
  // thompson.ts
  export function thompsonNfa(regex: Regex): Automaton; // the construction's NFA, positions 0, no cap
  // regexToDfa.ts
  export const MAX_REGEX_INPUT = 1000;
  export function canBuildFromRegex(input: string): string | null;
  export function regexToMinimalDfa(input: string): Automaton; // throws Error(reason) if refused
  ```
  `thompson(input)` (the trace) is rewritten to use `thompsonNfa` and keeps working until Task 4.

- [ ] **Step 1: Write the failing tests** in `regexToDfa.test.ts`:

```ts
it('(a|b)*abb: 4 states labelled breadth-first', () => {
  const d = regexToMinimalDfa('(a|b)*abb');
  expect(d.kind).toBe('DFA'); expect(d.name).toBe('(a|b)*abb');
  expect(d.states.map((s) => s.label)).toEqual(['q_0', 'q_1', 'q_2', 'q_3']);
  expect(startStates(d).map((s) => s.label)).toEqual(['q_0']);
  expect(d.accepting.map((id) => byId(d, id).label)).toEqual(['q_3']);
  expect(d.states.every((s) => s.mergedFrom === undefined)).toBe(true);
});
it('a*b* is complete: 3 states with a dead one', () => expect(regexToMinimalDfa('a*b*').states).toHaveLength(3));
it('accepts exactly the regex language and is minimal', () => {
  fc.assert(fc.property(arbRegex('ab', 3), (r) => {
    const d = regexToMinimalDfa(printRegex(r)), js = regexToJs(r);
    for (const w of wordsUpTo(['a', 'b'], 6)) expect(accepts(d, w)).toBe(js.test(w));
    expect(minimize(d).result.states).toHaveLength(d.states.length);
  }), { numRuns: 60 });
});
it('degenerate regexes give valid DFAs', () => {
  for (const s of ['ε', '∅', 'ε*', '∅*', '\\eps+']) {
    expect(validate(regexToMinimalDfa(s)).filter((i) => i.severity === 'error')).toEqual([]);
  }
  expect(accepts(regexToMinimalDfa('∅'), '')).toBe(false);
  expect(accepts(regexToMinimalDfa('ε*'), '')).toBe(true);
});
it('astral and non-Latin symbols', () => {
  expect(regexToMinimalDfa('😀*א').alphabet.slice().sort()).toEqual(['א', '😀'].sort());
  expect(accepts(regexToMinimalDfa('א|ב'), 'ב')).toBe(true);
});
it('refusals', () => {
  expect(canBuildFromRegex('')).toBe('Type a regex');
  expect(canBuildFromRegex('a|')).toBe('Nothing after |');
  expect(canBuildFromRegex('a'.repeat(1001))).toBe('Too long: at most 1000 characters');
  expect(canBuildFromRegex('(a|b)*a(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)')).toBe('Too big: the DFA would have more than 64 states');
  expect(canBuildFromRegex('(a|b)*a(a|b)(a|b)(a|b)(a|b)(a|b)')).toBeNull(); // exactly 64
  expect(canBuildFromRegex('a'.repeat(40))).toBeNull(); // long NFA, small DFA: no NFA cap
  expect(() => regexToMinimalDfa('a|')).toThrow('Nothing after |');
});
```

  (Use the helpers the codebase has for `startStates`/finding a state; adjust to `validate`'s field.)
- [ ] **Step 2: Run** `npx vitest run src/core/regexToDfa.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `thompsonNfa` (extracted from the trace's walk; no layout, no cap),
  then `regexToDfa.ts`: length check on the normalised text first, then parse, then
  `subsetConstruction` (catch its throw → the Too big reason), `minimize`, then relabel
  breadth-first (ids may be renamed to fresh `newId()`s or kept; labels must be `q_i`), positions 0.
  `canBuildFromRegex` runs the same pipeline and returns the reason or `null`.
- [ ] **Step 4: Run** the new file and `npx vitest run src/core`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): regex to a minimal DFA in one step`.

---

### Task 3: From regex creates the DFA; Create becomes a menu

**Files:**
- Create: `src/store/regexActions.ts`, `src/store/regexActions.test.ts`
- Modify: `src/ui/shell/RegexDialog.tsx` (+ test), `src/ui/shell/HistoryBar.tsx` (+ test),
  `src/ui/shell/App.test.tsx`, `src/ui/shell/App.css`, `e2e/regex.spec.ts`, `e2e/history.spec.ts`,
  `e2e/copy-paste.spec.ts`, `e2e/lessons.spec.ts`

**Interfaces:**
- Consumes: `canBuildFromRegex`, `regexToMinimalDfa` (Task 2); `layoutInWorker` (`layout/layoutClient.ts`);
  the store's add-automaton action (the one `SaveButton` uses).
- Produces: `createFromRegex(input: string): Promise<string | null>` in `regexActions.ts` — `null` when
  refused; otherwise lays out the DFA, adds it as a new automaton, opens it, returns its id.

- [ ] **Step 1: Write the failing tests:**

```ts
// regexActions.test.ts
it('createFromRegex adds one minimal DFA named after the regex and opens it', async () => {
  const before = appStore.getState().automata.length;
  const id = await createFromRegex('(a|b)*abb');
  expect(appStore.getState().automata).toHaveLength(before + 1);
  expect(appStore.getState().activeId).toBe(id);
  // the active automaton: kind 'DFA', name '(a|b)*abb', 4 states, positions not all 0
});
it('createFromRegex does nothing for a refused regex', async () => { /* 'a|' → null, automata unchanged */ });
it('createFromRegex closes an open trace', async () => { /* startRun on a seeded DFA, then createFromRegex('a') → trace null, an edit applies */ });
it('the new DFA is editable even when a lesson automaton was active', async () => { /* seeded automaton in readOnly, createFromRegex('a') → new id not in readOnly */ });

// RegexDialog.test.tsx (update)
it('Enter creates the DFA and closes', async () => { /* type '(a|\\eps)*{Enter}' → await: a DFA named '(a|ε)*' added; dialog closed; no trace */ });
it('the build button is Create DFA, disabled with the reason', () => { /* name 'Create DFA'; 'a|' → title 'Nothing after |' */ });
it('a too-big regex shows its reason under the box', () => { /* the 7th-from-end regex → regex-error has 'Too big: the DFA would have more than 64 states', no caret */ });

// HistoryBar.test.tsx (update)
it('Create opens a menu with Blank automaton and From regex…', async () => {
  // click 'Create' → menuitem 'Blank automaton' creates an automaton; again → menuitem 'From regex…' opens the dialog
  // queryByRole('button', { name: 'More ways to create' }) is null
});
```

- [ ] **Step 2: Run** the three files. Expected: FAIL.
- [ ] **Step 3: Implement** `createFromRegex`; the dialog's button `Create DFA` using
  `canBuildFromRegex` (memoised on the text) for `disabled`/`title` and the visible reason (parse
  errors keep the caret, the other reasons show without it), Enter → `void createFromRegex(text)` and
  close. Create becomes a menu button (copy `ImportMenu`'s pattern: `usePopover`, `role="menu"`,
  keyboard), items `Blank automaton` (what Create did) and `From regex…` (`openRegexDialog`); delete
  `CreateMoreMenu` and its CSS. Every test or e2e step that pressed Create to make a blank automaton
  now picks `Blank automaton` after it (keep `exact: true`).
- [ ] **Step 4: Rewrite** `e2e/regex.spec.ts` test `from regex to a saved NFA` as `from regex to a
  minimal DFA`: Create → From regex… → type `(a|b)*abb` → Enter → the history's first entry is named
  `(a|b)*abb` with 4 states and no trace player is open. Keep the parse-error and canvas-link tests;
  drop `from regex to DFA` (Save and convert is gone in Task 4; if it still passes, delete it anyway).
- [ ] **Step 5: Run** the unit tests, then the full `npm run e2e`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(ui): From regex creates the minimal DFA; Create opens a menu`.

---

### Task 4: Remove the Thompson walkthrough

**Files:**
- Delete: `src/core/thompsonLayout.ts`, `src/core/thompsonLayout.test.ts`,
  `src/ui/player/ThompsonTraceView.tsx`, `src/ui/player/ThompsonTraceView.test.tsx`
- Modify: `src/core/thompson.ts` (+ test), `src/core/trace.ts`, `src/store/traceActions.ts` (+ test),
  `src/ui/player/TraceView.tsx`, `src/ui/player/traceExtraActions.tsx`, `src/ui/player/player.css`,
  `src/ui/shell/App.tsx`, `src/ui/shell/Toolbar.tsx` (+ test), `src/ui/LabelText.test.tsx`,
  and any other reference `grep -rn "thompson\|Thompson" src e2e` finds.

**Interfaces:**
- Consumes: nothing new. Produces: `thompson.ts` exports only `thompsonNfa` (and what it needs);
  `AnyTrace = RunTrace | SubsetTrace | MinimizeTrace | EliminateTrace`; `traceSourceId(t): string`
  (every kind has a source again; keep the helper and its callers, drop the `null` branch).

- [ ] **Step 1: Delete** the files above and remove: `ThompsonStep`/`ThompsonTrace`, `thompson()`,
  `canThompson`, `MAX_THOMPSON_STATES`, `Piece`, `thompsonStateCount` (unless still used),
  `startThompson` and its tests, `SaveAndConvertButton` and the `'thompson'` cases, App's `autoPlay`
  `'thompson'`, the Toolbar's "Save the NFA first" lock and its test, the regex strip / piece frame CSS,
  the Thompson cases in `LabelText.test.tsx` (keep the eliminate one). Keep `quoteRegex` (eliminate
  uses it).
- [ ] **Step 2: Keep** `thompson.test.ts` as tests of `thompsonNfa` (state counts `(a|b)*abb` → 14,
  `a|b|c` → 8, `ab` → 4 with one ε-arrow, one arrow per (from, to) pair, the language property over
  `arbRegex('ab', 3)`, degenerate regexes valid).
- [ ] **Step 3: Run** `npm run typecheck && npm run lint && npm test`. Expected: PASS, and
  `grep -rn "ThompsonTrace\|thompsonLayout\|startThompson\|save-and-convert" src e2e` finds nothing.
- [ ] **Step 4: Run** the full `npm run e2e`. Expected: PASS.
- [ ] **Step 5: Commit** `refactor: remove the Thompson walkthrough`.

---

### Task 5: Docs and full check

**Files:**
- Modify: `README.md`, `src/ui/shell/ControlsDialog.tsx` (+ test), `CLAUDE.md`, `PROGRESS.md`,
  `docs/superpowers/specs/2026-11-17-regex-design.md` (one note at the top pointing to the rework spec)

- [ ] **Step 1: Update** the Controls test, then the row: "Build a DFA from a regex", gesture
  `Create → From regex…`, hint unchanged (the syntax). Run it (FAIL, then PASS).
- [ ] **Step 2: README** "Regular expressions": From regex… (in Create's menu) creates the minimal DFA
  for the regex; To regex unchanged plus "simplified"; syntax bullet unchanged. Tagline stays.
- [ ] **Step 3: CLAUDE.md**: replace the Thompson walkthrough / layout / source-less trace lines with
  `regexToDfa.ts` (regex → Thompson NFA → subset → minimize → relabel, `MAX_REGEX_INPUT`) and
  `store/regexActions.ts`; keep the `eliminate` lines; mention the new simplification rules briefly.
- [ ] **Step 4: PROGRESS.md**: a dated "Regex rework (2026-11-17)" Done section above "Regex
  (2026-11-17)" with one line per change (minimal DFA straight from a regex, simpler To regex, Create
  menu, Thompson walkthrough removed); correct the earlier Regex lines that describe the walkthrough
  (strike nothing silently: say it was replaced). Remove the Next item about the 20k-character paste
  if `MAX_REGEX_INPUT` closed it (it should: the length check runs before any recursion).
- [ ] **Step 5: Full check:** `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build && npm run e2e`. Expected: all PASS.
- [ ] **Step 6: Commit** `docs: regex rework in README, Controls, CLAUDE.md and PROGRESS`.
