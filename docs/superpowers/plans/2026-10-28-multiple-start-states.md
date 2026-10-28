# Multiple Start States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an NFA have several start states (accepting when a run from any of them accepts), and
show the "new start state with ε-transitions" construction as the first step of Convert to DFA.

**Architecture:** `Automaton.start: StateId | null` becomes `starts: StateId[]` everywhere; the file
format goes to version 2 with a migration. Core readers treat `starts` as a set. Subset
construction builds an extended NFA (new `q_s` with ε-edges) when there are several starts and
traces it as a new `'starts'` phase. The canvas draws one start arrow per start state, and the S key
toggles membership on NFAs.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), React 19, zod, Vitest + fast-check
+ Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-28-multiple-start-states-design.md` (read it first).

## Global Constraints

- `src/core/` imports nothing from `layout/`, `store/`, `persistence/` or `ui/`.
- `starts` has no duplicates and is ordered by when each state became a start state.
- A DFA has at most one start state; the only way an automaton gets several is `toggleStart` on an
  NFA (or an imported v2 NFA).
- Exact copy: `"No start state"` (warning), `"A DFA has exactly one start state"` (error),
  `"Set a start state first"` (can\* guards), `"An NFA with several start states can't be a DFA: use Convert to DFA"`
  (DFA button title), `"Set as start"` (DFA menu item), `"Toggle start"` (NFA menu item),
  `"Several start states: add a new start state q_s with ε-transitions to {q0, q2}"` (pattern of
  the `'starts'` step: the new state's raw label, then `formatSet(nfa, oldStarts)`).
- New start state: label `q_s`, else the first free of `q_s'`, `q_s''`, …; placed `START_GAP = 120`
  world px left of the leftmost old start, at their average y.
- `CURRENT_VERSION = 2`. `e2e/fixtures/automata.json` stays at version 1.
- Don't run `npm run format`; format only touched files (`npx prettier --write <files>`).
- Keep existing `data-testid`s; `start-arrow` groups gain `data-state-id`.

## Review Focus

1. **A v1 save whose `start` names no state** (allowed before): must load with `starts: []`, not be
   rejected as corrupt and replaced by a blank automaton. Test in Task 1.
2. **Deleting one of several start states**: the other start states stay. Test in Task 2.
3. **Pressing S twice on the same NFA state**: back to no start, never a duplicate entry. Test in
   Task 2.
4. **Two start states whose ε-closures overlap** (q0 -ε-> q1, starts [q0, q1]): the run's active set
   has each state once, so one token per state. Test in Task 2.
5. **A start id with no state** reaching the canvas (e.g. mid-edit): no arrow and no crash. Test in
   Task 4.

---

### Task 1: `starts` list through model, persistence and every reader

The type change breaks compilation everywhere at once, so this task changes every reader in one go,
treating `starts` as a set wherever the old code read the single start. Single-start behaviour must
be unchanged: the whole existing suite is the regression test.

**Files:**

- Modify: `src/core/model.ts` (`starts: StateId[]`, `emptyAutomaton` → `starts: []`)
- Modify: `src/core/edit.ts` (`removeState`, `setStart`), `src/core/validate.ts`,
  `src/core/analysis.ts`, `src/core/run.ts`, `src/core/subset.ts`, `src/core/minimize.ts`
- Modify: `src/core/testing/fixtures.ts`, `src/core/testing/arbitraries.ts`,
  `src/store/testing/fixtures.ts`
- Modify: `src/layout/layout.ts`, `src/ui/canvas/Diagram.tsx`, `src/ui/canvas/Thumbnail.tsx`,
  `src/ui/canvas/geometry.ts`, `src/ui/canvas/useCanvasEditing.ts`
- Modify: `src/persistence/migrate.ts`, `src/persistence/schema.ts`
- Modify: every test that builds an `Automaton` literal with `start:` (find them with
  `grep -rn "start:" src --include=*.test.ts --include=*.test.tsx`; `fixture({ start })` calls
  stay as they are)
- Test: `src/persistence/persistence.test.ts`

**Interfaces:**

- Produces: `Automaton.starts: StateId[]`; `FixtureSpec.starts?: string[]` (wins over `start`;
  `start: 'q0'` still means `starts: ['q0']`); `setStart(a, id: StateId | null)` → `starts: [id]`
  or `[]`; `CURRENT_VERSION = 2`; `migrate()` returns version-2 JSON.

- [ ] **Step 1: Write the failing persistence tests** in `src/persistence/persistence.test.ts`:

```ts
it('migrates a v1 file: start becomes starts, a missing start becomes []', () => {
  const v1 = (start: string | null) =>
    JSON.stringify({ format: 'automaton-vis', version: 1, automata: [{ ...oneStateV1, start }] });
  expect(parseFile(v1('q0'), new Set())).toMatchObject({ ok: true, automata: [{ starts: ['q0'] }] });
  expect(parseFile(v1(null), new Set())).toMatchObject({ ok: true, automata: [{ starts: [] }] });
  // Review Focus 1: v1 never checked the start; a dangling one is dropped, not fatal.
  expect(parseFile(v1('gone'), new Set())).toMatchObject({ ok: true, automata: [{ starts: [] }] });
});

it('v2 files: round-trip several NFA starts; reject an unknown start or a two-start DFA', () => {
  const nfa = { ...fixture({ kind: 'NFA', alphabet: 'a', states: ['q0', 'q1'], starts: ['q0', 'q1'] }) };
  expect(parseFile(serialize([nfa]), new Set())).toMatchObject({ ok: true, automata: [{ starts: ['q0', 'q1'] }] });
  expect(JSON.parse(serialize([nfa])).version).toBe(2);
  const bad = (a: object) => parseFile(JSON.stringify({ format: 'automaton-vis', version: 2, automata: [a] }), new Set());
  expect(bad({ ...nfa, starts: ['nope'] }).ok).toBe(false);
  expect(bad({ ...nfa, kind: 'DFA', starts: ['q0', 'q1'] }).ok).toBe(false);
});
```

(`oneStateV1` is a v1 automaton literal with one state `q0`; define it in the test file.)

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/persistence/persistence.test.ts`
Expected: FAIL (no `starts` in the parsed automata; `fixture` has no `starts`)

- [ ] **Step 3: Implement the type change and every reader**

- `migrate()`: for `version === 1`, map each automaton `{ start, ...rest }` to
  `{ ...rest, starts: start !== null && rest.states.some((s) => s.id === start) ? [start] : [] }`
  and set `version: 2`. Unknown/odd shapes pass through for the schema to reject.
- `schema.ts`: `starts: z.array(z.string())`; in the existing `superRefine`, an issue when an entry
  is not a state id, and when `kind === 'DFA' && starts.length > 1`.
- Core readers: every `a.start` check becomes "the existing states in `a.starts`" — add
  `export function startStates(a: Automaton): StateId[]` to `src/core/model.ts` returning
  `a.starts.filter((id) => a.states.some((s) => s.id === id))`, and use it in `canRun`,
  `canConvert`, `canMinimize`, `validate` (warning when empty; reachability from all),
  `reachableStates`, `removeUnreachable`, `accepts` (ε-closure of all), `runWord` (start set = all),
  `subsetConstruction` (`epsilonClosure(nfa, startStates(nfa))`; the `'starts'` step is Task 3),
  `minimize` (its single start; the result DFA gets `starts: [id]`).
- `removeState`: drop the id from `starts`.
- UI readers: `Diagram` renders one `av-start-arrow` group per visible start state, each with
  `data-testid="start-arrow"` and `data-state-id`; `StateNode`'s `start` prop is
  `automaton.starts.includes(s.id)`; `geometry.ts` marks the left side occupied when
  `a.starts.includes(from.id)`; `Thumbnail` draws one start arrow per start state; `layout.ts` puts
  every start state in the FIRST layer. `useCanvasEditing` keeps calling `setStart` for now (Task 4
  switches it).
- `arbitraries.ts` keeps `starts: ['q0']` in this task.

- [ ] **Step 4: Run the whole suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS, including the two new persistence tests.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "refactor(core): starts list instead of a single start; file format v2 with migration"
```

### Task 2: Multi-start semantics in the core

**Files:**

- Modify: `src/core/edit.ts`, `src/core/validate.ts`, `src/core/testing/arbitraries.ts`
- Test: `src/core/edit.test.ts`, `src/core/validate.test.ts`, `src/core/run.test.ts`,
  `src/core/analysis.test.ts`

**Interfaces:**

- Consumes: `startStates(a)` (Task 1).
- Produces: `toggleStart(a: Automaton, id: StateId): Automaton`.

- [ ] **Step 1: Write the failing tests**

```ts
// edit.test.ts
it('toggleStart adds and removes NFA start states, never duplicating (Review Focus 3)', () => {
  const n = fixture({ kind: 'NFA', alphabet: 'a', states: ['q0', 'q1'], start: 'q0' });
  expect(toggleStart(n, 'q1').starts).toEqual(['q0', 'q1']);
  expect(toggleStart(toggleStart(n, 'q1'), 'q1').starts).toEqual(['q0']);
  expect(toggleStart(n, 'q0').starts).toEqual([]);
});
it('toggleStart on a DFA moves the start, or clears it on the current start', () => {
  const d = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0', 'q1'], start: 'q0' });
  expect(toggleStart(d, 'q1').starts).toEqual(['q1']);
  expect(toggleStart(d, 'q0').starts).toEqual([]);
});
it('removing one of several start states keeps the others (Review Focus 2)', () => {
  const n = fixture({ kind: 'NFA', alphabet: 'a', states: ['q0', 'q1', 'q2'], starts: ['q0', 'q2'] });
  expect(removeState(n, 'q0').starts).toEqual(['q2']);
});

// validate.test.ts
it('a DFA with two start states is an error', () => {
  const d = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0', 'q1'], starts: ['q0', 'q1'] });
  expect(validate(d)).toContainEqual(expect.objectContaining({ severity: 'error', message: 'A DFA has exactly one start state' }));
});
it('states reachable from any start state are not unreachable', () => {
  const n = fixture({ kind: 'NFA', alphabet: 'a', states: ['q0', 'q1'], starts: ['q0', 'q1'] });
  expect(validate(n).some((i) => /unreachable/i.test(i.message))).toBe(false);
});

// run.test.ts
it('a multi-start NFA starts in every start state and accepts via any of them', () => {
  const n = fixture({ kind: 'NFA', alphabet: 'ab', states: ['q0', 'q1', 'q2'], starts: ['q0', 'q1'],
    accepting: ['q2'], edges: [['q1', 'b', 'q2']] });
  const t = runWord(n, 'b');
  expect(t.steps[0]?.active).toEqual(['q0', 'q1']);
  expect(t.accepted).toBe(true);
  expect(accepts(n, 'b')).toBe(true);
});
it('overlapping start closures list each state once (Review Focus 4)', () => {
  const n = fixture({ kind: 'NFA', alphabet: 'a', states: ['q0', 'q1'], starts: ['q0', 'q1'], edges: [['q0', 'ε', 'q1']] });
  const active = runWord(n, '').steps.at(-1)?.active ?? [];
  expect(new Set(active).size).toBe(active.length);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/core`
Expected: FAIL on `toggleStart` (not exported) and the DFA validation error; run/analysis tests may
already pass from Task 1, which is fine.

- [ ] **Step 3: Implement**

- `toggleStart` in `edit.ts`: NFA → add/remove `id` (appending on add); DFA → `[id]`, or `[]` when
  `starts` is already `[id]`.
- `validate.ts`: the `"A DFA has exactly one start state"` error when `kind === 'DFA'` and
  `startStates(a).length > 1`. `setKind(a, 'DFA')` then refuses a multi-start NFA through its
  existing validation path.
- `arbitraries.ts`: `arbNfa` draws `starts` as a non-empty, duplicate-free subset of at most 3 of
  its states (`fc.subarray` of the state ids with `minLength: 1, maxLength: 3`); DFA arbitraries
  keep `['q0']`.

- [ ] **Step 4: Run the core suite, property tests included**

Run: `npx vitest run src/core`
Expected: PASS, including `subset.test.ts`'s "result … accepting the same language" property over
multi-start NFAs (correct already, since Task 1 starts the construction from all starts).

- [ ] **Step 5: Commit**

```bash
git add src/core
git commit -m "feat(core): several start states on an NFA (toggleStart, DFA rule, runs from all starts)"
```

### Task 3: Convert to DFA shows the new start state first

**Files:**

- Modify: `src/core/subset.ts`, `src/core/trace.ts` (`SubsetStep.phase` gains `'starts'`)
- Test: `src/core/subset.test.ts`, `src/ui/player/SubsetTraceView.test.tsx`

**Interfaces:**

- Consumes: `startStates(a)`, `toggleStart` (Tasks 1–2).
- Produces: `export function withSingleStart(nfa: Automaton): { nfa: Automaton; added: StateId | null }`
  in `subset.ts` (`added` is the new state's id, `null` when there was at most one start), and
  `export const START_GAP = 120`.

- [ ] **Step 1: Write the failing tests**

```ts
const twoStarts = fixture({ kind: 'NFA', alphabet: 'ab', states: ['q0', 'q1', 'q2'], starts: ['q0', 'q2'],
  accepting: ['q1'], edges: [['q0', 'a', 'q1'], ['q2', 'b', 'q1']] });

it('withSingleStart adds q_s with ε-edges to the old starts, left of them', () => {
  const { nfa, added } = withSingleStart(twoStarts);
  const s = nfa.states.find((x) => x.id === added)!;
  expect(s.label).toBe('q_s');
  expect(nfa.starts).toEqual([added]);
  expect(s.x).toBe(0 - START_GAP); // leftmost old start q0 is at x 0
  expect(s.y).toBe(0);
  expect(nfa.transitions.filter((t) => t.from === added).map((t) => [t.to, t.symbols]))
    .toEqual([['q0', ['ε']], ['q2', ['ε']]]);
  expect(withSingleStart(fixture({ kind: 'NFA', alphabet: 'a', states: ['q0'], start: 'q0' })).added).toBeNull();
});
it('picks q_s\' when q_s is taken', () => {
  const taken = { ...twoStarts, states: twoStarts.states.map((s, i) => (i === 1 ? { ...s, label: 'q_s' } : s)) };
  expect(withSingleStart(taken).nfa.states.at(-1)?.label).toBe("q_s'");
});
it('a multi-start conversion opens with the starts step on the extended NFA', () => {
  const t = subsetConstruction(twoStarts);
  expect(t.steps[0]).toMatchObject({ phase: 'starts', revealedStates: [],
    explanation: 'Several start states: add a new start state q_s with ε-transitions to {q0, q2}' });
  expect(t.source.states).toHaveLength(4);
  expect(t.steps[1]?.phase).toBe('init');
  expect(twoStarts.states).toHaveLength(3); // the saved NFA is untouched
});
```

In `SubsetTraceView.test.tsx`: at step 0 of `subsetConstruction(twoStarts)`, the NFA pane shows 4
states and the `q_s` state is `data-active="true"`; the DFA pane shows no states.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/core/subset.test.ts src/ui/player/SubsetTraceView.test.tsx`
Expected: FAIL (`withSingleStart` not exported).

- [ ] **Step 3: Implement** `withSingleStart` (ε-edges as `Transition`s with `symbols: ['ε']`, ids
  via `newId()`), then in `subsetConstruction`: when `added !== null`, run everything on the
  extended NFA, push the `'starts'` step first (`focus`: the new state and its ε-transitions;
  `dfaFocus: {}`; empty `revealedStates`/`revealedTransitions`), and return it as `source`.
  `canConvert` stays on the original NFA. The view needs no change (it already renders whatever a
  step reveals).

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/core src/ui/player`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core src/ui/player
git commit -m "feat(core): Convert to DFA adds a single start state q_s first when there are several"
```

### Task 4: Canvas, menus and the kind toggle

**Files:**

- Modify: `src/ui/canvas/useCanvasEditing.ts`, `src/ui/shell/Toolbar.tsx`
- Test: `src/ui/canvas/Canvas.test.tsx`, `src/ui/canvas/Diagram.test.tsx`,
  `src/ui/shell/HistoryBar.test.tsx`, `src/ui/shell/Toolbar.test.tsx`

**Interfaces:**

- Consumes: `toggleStart`, `setStart` (Tasks 1–2); `start-arrow` with `data-state-id` (Task 1).

- [ ] **Step 1: Write the failing tests**

- `Canvas.test.tsx`: on an NFA, select `q0` (start) then `q1`, press `s` on each → `starts` is
  `['q0', 'q1']` and two `start-arrow`s render; press `s` on `q1` again → `['q0']`. On a DFA,
  `s` on `q1` → `['q1']`. Right-click a state: the item reads `"Toggle start"` on an NFA and
  `"Set as start"` on a DFA; on the DFA's current start, "Set as start" leaves `starts` as is.
- `Diagram.test.tsx`: an automaton with `starts: ['q0', 'q1']` renders two `start-arrow`s with
  `data-state-id` `q0` and `q1`; one with `starts: ['ghost']` renders none and doesn't throw
  (Review Focus 5).
- `HistoryBar.test.tsx`: a two-start NFA's thumbnail has two `.av-thumb-start` groups.
- `Toolbar.test.tsx`: for a two-start NFA the `DFA` button is disabled with title
  `"An NFA with several start states can't be a DFA: use Convert to DFA"`; with one start it is
  enabled.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/ui/canvas src/ui/shell`
Expected: FAIL on the S key (moves instead of adding), the menu label and the DFA button.

- [ ] **Step 3: Implement**: the `s` key calls `toggleStart`; the state menu's first item is
  `"Toggle start"` → `toggleStart` on an NFA, `"Set as start"` → `setStart` on a DFA; the `DFA`
  kind button gets `disabled` and that `title` when `kind === 'NFA' && startStates(a).length > 1`.

- [ ] **Step 4: Run the full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui
git commit -m "feat(canvas): S toggles start states on an NFA; one start arrow per start; DFA toggle guard"
```

### Task 5: End to end, docs

**Files:**

- Create: `e2e/multi-start.spec.ts`
- Modify: `CLAUDE.md` (model bullet: `starts`, file format v2), `PROGRESS.md`

- [ ] **Step 1: Write the e2e spec**: import `e2e/fixtures/automata.json` (v1, so the migration
  runs), open "Ends in ab (NFA)", select a second state and press `s` → two `start-arrow`s; run a
  word only that second start accepts → verdict `data-accepted="true"`; Convert to DFA → the step
  counter shows step 1 and the explanation starts with `Several start states: add a new start state`.
  Use `clickState` / `item` from `e2e/helpers.ts`; pick the state and word from the fixture's
  transitions.

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/multi-start.spec.ts`
Expected: PASS

- [ ] **Step 3: Update docs**: in `CLAUDE.md`'s `model.ts` bullet, say an automaton has a `starts`
  list (one for a DFA, any number for an NFA) and that the file format is version 2; add a
  "Multiple start states" section to `PROGRESS.md` with the spec's items ticked.

- [ ] **Step 4: Full verification**

Run: `npm run typecheck && npm run lint && npm test && npm run e2e`
Expected: all PASS; `npx prettier --check` on every touched file passes.

- [ ] **Step 5: Commit**

```bash
git add e2e CLAUDE.md PROGRESS.md
git commit -m "test(e2e): two start states, a run from the second, and the q_s step; docs"
```
