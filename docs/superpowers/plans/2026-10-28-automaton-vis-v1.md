# Automaton Vis v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build automaton-vis v1: a static React app to build, draw, and edit DFAs/NFAs and to step through word runs, NFA→DFA subset construction, and DFA minimization.

**Architecture:** A pure TypeScript `core/` (model, validation, edit ops, algorithms that eagerly produce step-snapshot traces), a `layout/` wrapper around elkjs, a Zustand `store/`, `persistence/` (localStorage + versioned JSON), and React `ui/` (custom SVG canvas, transition table, generic trace player, shell). Dependencies point downward only.

**Tech Stack:** TypeScript (strict), React, Vite, elkjs, Zustand + immer, zod, Vitest, fast-check, React Testing Library, Playwright, ESLint, Prettier, GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-28-automaton-vis-design.md` (read it first; this plan argues from it).

## Global Constraints

- TypeScript `strict: true`; no `any` in `src/core/`.
- `src/core/` imports nothing from `layout/`, `store/`, `persistence/`, or `ui/`, and nothing from React. `layout/` imports only `core/`.
- `EPSILON = 'ε'`; it is never part of `alphabet`. Alphabet symbols are single characters.
- The spec's `Symbol` type is named `Sym` in code (avoids shadowing the global `Symbol`).
- At most one `Transition` per (from, to) pair.
- A DFA may be partial; a missing transition means the run gets stuck and rejects.
- Undo history: per automaton, capped at 100 entries, not persisted.
- Autosave debounce: 500 ms. Storage key: `automaton-vis:v1`.
- File format: `{ "format": "automaton-vis", "version": 1, "automata": Automaton[] }`.
- Editing is view-only while a trace is open.
- Desktop-first; nothing in v1 targets touch editing.
- Deploy to GitHub Pages from `master`; Vite `base` is `/automaton-vis/`.
- Test files are colocated as `*.test.ts(x)` next to the code; Playwright specs live in `e2e/`.
- Every interactive canvas/table/player element carries a stable `data-testid` (named in each task); the design pass (Task 20) must not rename them.

## Review Focus

1. **ε-cycles** (`q0 -ε-> q1 -ε-> q0`): ε-closure, runs, and subset construction must terminate. Test in Task 4.
2. **Corrupted localStorage** at startup (invalid JSON or schema failure): the app must start (with the examples and a warning), not crash, and must keep the unreadable data under a backup key. Test in Task 18.
3. **Typed edge-symbol input** (`"a, b"`, `"ab"`, `"a,a"`, `ε` on a DFA, a symbol not yet in the alphabet): parse it predictably, reject multi-character symbols and ε on DFAs with a message, and add unknown symbols to the alphabet. Tests in Task 3 (parser) and Task 13 (alphabet auto-extend).
4. **Deleting the start state** (or an accepting state): start becomes `null`, accepting is cleaned, and Run/Convert/Minimize are disabled with "Set a start state first". Tests in Task 3 and Task 5.
5. **A word with characters outside the alphabet or with spaces**: Run is disabled with a reason naming the first bad character. Test in Task 5.

---

## File Structure

```
src/
  core/
    model.ts          types, EPSILON, emptyAutomaton
    id.ts             newId()
    format.ts         formatSet(a, ids) for explanation copy
    validate.ts       Issue, validate, hasErrors
    edit.ts           pure edit operations, nextStateLabel, parseSymbolInput
    analysis.ts       epsilonClosure, move, reachable, removeUnreachable, completeWithDeadState, isComplete, accepts
    trace.ts          Highlight, StepBase, RunTrace, SubsetTrace, MinimizeTrace, AnyTrace
    run.ts            canRun, runWord
    subset.ts         canConvert, subsetConstruction
    minimize.ts       canMinimize, minimize
    testing/
      fixtures.ts     fixture() builder
      arbitraries.ts  fast-check arbitraries
  layout/
    layout.ts         layoutAutomaton (elkjs)
  store/
    store.ts          createAppStore, useAppStore, AppState
    traceActions.ts   startRun, startSubset, startMinimize
  persistence/
    schema.ts         zod schemas
    migrate.ts        CURRENT_VERSION, migrate
    fileFormat.ts     serialize, parseFile
    storage.ts        STORAGE_KEY, loadFromStorage, saveToStorage
    useAutosave.ts    autosave hook
    examples.ts       exampleAutomata
  ui/
    canvas/
      geometry.ts     STATE_RADIUS, edge/self-loop/start-arrow geometry
      viewport.ts     Viewport, screenToWorld, zoomAt, fitToView
      Diagram.tsx     SVG renderer (+ StateNode.tsx, EdgeView.tsx)
      diagramStyles.ts  the <style> text embedded in the SVG
      useCanvasEditing.ts  gestures
      InlineInput.tsx, ContextMenu.tsx
      exportDiagram.ts  SVG/PNG export
      Canvas.tsx      store-connected canvas
    table/
      TransitionTable.tsx, IssuesList.tsx
    player/
      TracePlayer.tsx, RunPanel.tsx, RunTraceView.tsx, SubsetTraceView.tsx, MinimizeTraceView.tsx
    shell/
      App.tsx, AutomatonList.tsx, Toolbar.tsx, Toasts.tsx, toastStore.ts, ErrorBoundary.tsx, download.ts
  main.tsx
e2e/
  build-and-run.spec.ts, convert.spec.ts, import-export.spec.ts
.github/workflows/ci.yml, deploy.yml
```

---

### Task 1: Scaffold the project with tooling and CI

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc`, `index.html`, `src/main.tsx`, `src/ui/shell/App.tsx`, `src/test/setup.ts`, `.github/workflows/ci.yml`
- Modify: `.gitignore` (add `node_modules`, `dist`, `playwright-report`, `test-results`)
- Test: `src/ui/shell/App.test.tsx`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `typecheck` (`tsc -b --noEmit`), `lint`, `format`, `test` (`vitest run`), `test:watch`; Vitest config with `environment: 'jsdom'`, `setupFiles: ['src/test/setup.ts']` (imports `@testing-library/jest-dom/vitest`).

- [ ] **Step 1:** Scaffold with `npm create vite@latest . -- --template react-ts` (keep the existing README, CLAUDE.md, PROGRESS.md, docs/). Remove the template's demo assets and CSS. Move `App.tsx` to `src/ui/shell/`.
- [ ] **Step 2:** Install dev/runtime deps: `zustand immer elkjs zod` and `-D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event fast-check prettier eslint-config-prettier`. Set `"strict": true` and `noUncheckedIndexedAccess: true` in the app tsconfig. Set Vite `base: '/automaton-vis/'`.
- [ ] **Step 3: Write the failing test**

```tsx
// src/ui/shell/App.test.tsx
it('renders the app title', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Automaton Vis' })).toBeInTheDocument();
});
```

- [ ] **Step 4:** Run `npm test`. Expected: FAIL (no heading).
- [ ] **Step 5:** Make `App` render `<h1>Automaton Vis</h1>`.
- [ ] **Step 6:** Run `npm test && npm run typecheck && npm run lint && npm run build`. Expected: all pass.
- [ ] **Step 7:** Add `.github/workflows/ci.yml`: on push and pull_request, Node LTS, `npm ci`, then `typecheck`, `lint`, `test`.
- [ ] **Step 8: Commit** — `chore: scaffold Vite React TS app with Vitest, ESLint, Prettier and CI`

---

### Task 2: Core model and validation

**Files:**
- Create: `src/core/model.ts`, `src/core/id.ts`, `src/core/format.ts`, `src/core/validate.ts`, `src/core/testing/fixtures.ts`
- Test: `src/core/validate.test.ts`, `src/core/format.test.ts`

**Interfaces:**
- Produces:
  - `model.ts`: `type StateId = string; type Sym = string; const EPSILON = 'ε'; type AutomatonKind = 'DFA' | 'NFA'; interface State, Transition, Automaton` exactly as spec §4; `emptyAutomaton(name: string, kind: AutomatonKind): Automaton`.
  - `id.ts`: `newId(): string` (`crypto.randomUUID()`).
  - `format.ts`: `formatSet(a: Automaton, ids: StateId[]): string` → labels in the order of `a.states`, `"{q0, q2}"`; empty → `"∅"`.
  - `validate.ts`: `interface Issue { severity: 'error' | 'warning'; message: string; stateId?: StateId; transitionId?: string }`; `validate(a: Automaton): Issue[]`; `hasErrors(issues: Issue[]): boolean`.
  - `testing/fixtures.ts`: `fixture(spec: { kind: AutomatonKind; alphabet: string; states: string[]; start?: string; accepting?: string[]; edges?: [from: string, symbols: string, to: string][]; name?: string }): Automaton`. State ids equal labels; `alphabet` and `symbols` are strings of characters (`'ab'`, `'ε'`, `'a,b'` → split on commas or characters, ignoring commas); transition ids are `${from}->${to}`; positions are `x = 100 * index, y = 0`.

Validation messages (exact copy):

| Severity | Condition | Message |
|---|---|---|
| error | transition from/to missing state | `Transition points to a missing state` |
| error | symbol not in alphabet (ε excepted for NFA) | `'${s}' is not in the alphabet` |
| error | DFA uses ε | `A DFA can't have ε-transitions` |
| error | DFA nondeterminism | `${label} has more than one transition on '${s}'` |
| error | duplicate state label | `Two states are named ${label}` |
| warning | no start | `No start state` |
| warning | no accepting | `No accepting states` |
| warning | unreachable | `${label} is unreachable` |
| warning | partial DFA (one issue total) | `DFA is partial: a missing transition rejects the word` |

- [ ] **Step 1: Write the failing tests**

```ts
// validate.test.ts
const dfa = () => fixture({ kind: 'DFA', alphabet: 'ab', states: ['q0', 'q1'], start: 'q0', accepting: ['q1'],
  edges: [['q0', 'a', 'q1'], ['q0', 'b', 'q0'], ['q1', 'ab', 'q1']] });

it('a complete, reachable DFA has no issues', () => expect(validate(dfa())).toEqual([]));
it('flags DFA nondeterminism on the state', () => {
  const a = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0', 'q1'], start: 'q0', accepting: ['q1'],
    edges: [['q0', 'a', 'q0'], ['q0', 'a', 'q1'], ['q1', 'a', 'q1']] });
  expect(validate(a)).toContainEqual(expect.objectContaining({ severity: 'error', stateId: 'q0',
    message: "q0 has more than one transition on 'a'" }));
});
it('flags ε in a DFA but not in an NFA', ...);           // error with transitionId; NFA: no error
it('flags a symbol missing from the alphabet', ...);     // "'c' is not in the alphabet", transitionId set
it('flags a transition to a missing state', ...);
it('flags duplicate labels', ...);
it('warns: no start, no accepting, unreachable q2, partial DFA (exactly one partial warning)', ...);
it('hasErrors ignores warnings', ...);

// format.test.ts
it('formats in state order with labels', () => expect(formatSet(dfa(), ['q1', 'q0'])).toBe('{q0, q1}'));
it('formats the empty set as ∅', () => expect(formatSet(dfa(), [])).toBe('∅'));
```

- [ ] **Step 2:** Run `npx vitest run src/core`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement `model.ts`, `id.ts`, `format.ts`, `fixtures.ts`, `validate.ts` per the interfaces and message table.
- [ ] **Step 4:** Run `npx vitest run src/core`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(core): automaton model, validation and test fixtures`

---

### Task 3: Core edit operations

**Files:**
- Create: `src/core/edit.ts`
- Test: `src/core/edit.test.ts`

**Interfaces:**
- Consumes: Task 2 types, `newId`, `validate`, `hasErrors`.
- Produces (all pure, never mutate the input):
  - `nextStateLabel(a): string` — `q${lowest unused index}`.
  - `addState(a, pos: { x: number; y: number }, id: StateId = newId()): Automaton` — label from `nextStateLabel`.
  - `removeState(a, id)`, `renameState(a, id, label)`, `moveState(a, id, pos)`, `setStart(a, id: StateId | null)`, `toggleAccepting(a, id)`.
  - `addSymbolToEdge(a, from, to, sym)`, `removeSymbolFromEdge(a, from, to, sym)`, `setEdgeSymbols(a, from, to, syms: Sym[])` — create the edge if missing; delete it when its symbol list becomes empty.
  - `removeTransition(a, transitionId)`.
  - `addAlphabetSymbol(a, sym)` (no-op if present; throws on ε or length ≠ 1), `removeAlphabetSymbol(a, sym)` (also strips it from edges, deleting emptied edges), `renameAlphabetSymbol(a, from, to)` (also renames on edges).
  - `setKind(a, kind): { ok: true; automaton: Automaton } | { ok: false; issues: Issue[] }` — fails with the resulting errors when switching to DFA would produce errors.
  - `renameAutomaton(a, name)`.
  - `parseSymbolInput(text: string, kind: AutomatonKind): { ok: true; symbols: Sym[] } | { ok: false; error: string }` — split on commas, trim, drop empties, dedupe preserving order; the literal `eps` and `ε` both mean ε. Errors: `Symbols must be single characters: ${token}`; for DFA `A DFA can't have ε-transitions`. Empty input → `{ ok: true, symbols: [] }`.

- [ ] **Step 1: Write the failing tests** (use `fixture()`; check ids/labels, not object identity)

```ts
it('labels new states with the lowest free index', () => {
  const a = fixture({ kind: 'DFA', alphabet: 'a', states: ['q0', 'q2'] });
  expect(addState(a, { x: 0, y: 0 }, 'n').states.find(s => s.id === 'n')?.label).toBe('q1');
});
it('removing the start state clears start and accepting and its edges', () => {
  const a = removeState(dfa(), 'q0');            // dfa() from Task 2's test
  expect(a.start).toBeNull();
  expect(a.transitions.every(t => t.from !== 'q0' && t.to !== 'q0')).toBe(true);
});
it('removing an accepting state removes it from accepting', ...);
it('keeps one edge per (from,to) and merges symbols', () => {
  const a = addSymbolToEdge(addSymbolToEdge(base, 'q0', 'q1', 'a'), 'q0', 'q1', 'b');
  expect(a.transitions.filter(t => t.from === 'q0' && t.to === 'q1')).toHaveLength(1);
  expect(a.transitions.find(t => t.from === 'q0' && t.to === 'q1')?.symbols).toEqual(['a', 'b']);
});
it('deletes an edge when its last symbol is removed', ...);
it('removeAlphabetSymbol strips the symbol from edges', ...);
it('renameAlphabetSymbol renames it on edges', ...);
it('setKind to DFA fails when the NFA uses ε', () => {
  const r = setKind(nfaWithEpsilon, 'DFA');
  expect(r.ok).toBe(false);
});
it('does not mutate its input', () => { const a = dfa(); const copy = structuredClone(a); toggleAccepting(a, 'q0'); expect(a).toEqual(copy); });

describe('parseSymbolInput', () => {
  it('splits, trims and dedupes', () => expect(parseSymbolInput(' a, b ,a', 'DFA')).toEqual({ ok: true, symbols: ['a', 'b'] }));
  it('rejects multi-character tokens', () => expect(parseSymbolInput('ab', 'NFA')).toEqual({ ok: false, error: 'Symbols must be single characters: ab' }));
  it('accepts eps/ε on an NFA', () => expect(parseSymbolInput('eps, a', 'NFA')).toEqual({ ok: true, symbols: ['ε', 'a'] }));
  it('rejects ε on a DFA', () => expect(parseSymbolInput('ε', 'DFA')).toEqual({ ok: false, error: "A DFA can't have ε-transitions" }));
  it('empty input is an empty list', () => expect(parseSymbolInput('  ', 'DFA')).toEqual({ ok: true, symbols: [] }));
});
```

- [ ] **Step 2:** Run `npx vitest run src/core/edit.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `src/core/edit.ts` per the interfaces.
- [ ] **Step 4:** Run `npx vitest run src/core`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(core): pure edit operations and symbol input parsing`

---

### Task 4: Core analysis helpers and property-test arbitraries

**Files:**
- Create: `src/core/analysis.ts`, `src/core/testing/arbitraries.ts`
- Test: `src/core/analysis.test.ts`

**Interfaces:**
- Produces (state lists are always ordered by `a.states` order, deduplicated):
  - `epsilonClosure(a, ids: Iterable<StateId>): StateId[]`
  - `move(a, ids: Iterable<StateId>, sym: Sym): StateId[]` (no closure)
  - `transitionsTaken(a, ids: Iterable<StateId>, sym: Sym): string[]` (transition ids)
  - `reachableStates(a): StateId[]` (via any symbol incl. ε; `[]` when no start)
  - `removeUnreachable(a): { automaton: Automaton; removed: StateId[] }`
  - `isComplete(a): boolean` (every state has a transition on every alphabet symbol)
  - `completeWithDeadState(a): { automaton: Automaton; deadState: StateId | null }` — adds one state labeled `∅` (or `nextStateLabel` if `∅` is taken) at `x = max x + 120, y = mean y`, with self-loops on all symbols, and fills every missing (state, symbol); `deadState: null` when already complete.
  - `accepts(a, word: string): boolean` — direct simulation with ε-closure, independent of trace code.
  - `arbitraries.ts`: `arbNfa(opts?: { maxStates?: number; alphabet?: string; epsilon?: boolean }): fc.Arbitrary<Automaton>` (defaults 5, `'ab'`, true; always has a start state), `arbDfa(opts?)` (same defaults and guarantees, no ε; partial DFAs allowed), `arbWord(alphabet = 'ab', maxLength = 8): fc.Arbitrary<string>`.

- [ ] **Step 1: Write the failing tests**

```ts
it('ε-closure follows chains', ...);                  // q0-ε->q1-ε->q2 → ['q0','q1','q2']
it('ε-closure terminates on an ε-cycle', () => {
  const a = fixture({ kind: 'NFA', alphabet: 'a', states: ['q0', 'q1'], start: 'q0',
    edges: [['q0', 'ε', 'q1'], ['q1', 'ε', 'q0']] });
  expect(epsilonClosure(a, ['q0'])).toEqual(['q0', 'q1']);
});
it('accepts terminates on an ε-cycle', () => expect(accepts(epsCycleWithAcceptingQ1, '')).toBe(true));
it('removeUnreachable reports removed states', ...);
it('completeWithDeadState fills gaps and loops the dead state', () => {
  const { automaton, deadState } = completeWithDeadState(partialDfa);
  expect(isComplete(automaton)).toBe(true);
  expect(automaton.states.find(s => s.id === deadState)?.label).toBe('∅');
});
it('completeWithDeadState returns null for a complete DFA', ...);
it('accepts: DFA even-zeros', () => { expect(accepts(evenZeros, '00')).toBe(true); expect(accepts(evenZeros, '0')).toBe(false); expect(accepts(evenZeros, '')).toBe(true); });
it('accepts: partial DFA rejects on a missing transition', ...);
it('arbitraries produce valid automata', () => fc.assert(fc.property(arbNfa(), a => !hasErrors(validate(a)))));
```

- [ ] **Step 2:** Run `npx vitest run src/core/analysis.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `analysis.ts` and `arbitraries.ts`. `arbDfa` must generate at most one target per (state, symbol).
- [ ] **Step 4:** Run `npx vitest run src/core`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(core): closure, reachability, dead-state completion, acceptance and arbitraries`

---

### Task 5: Trace types and word runs

**Files:**
- Create: `src/core/trace.ts`, `src/core/run.ts`
- Test: `src/core/run.test.ts`

**Interfaces:**
- Produces:

```ts
// trace.ts
export interface Highlight { states?: StateId[]; transitions?: string[] }
export interface StepBase { explanation: string; focus: Highlight }

export interface RunStep extends StepBase {
  phase: 'start' | 'closure' | 'read' | 'stuck' | 'verdict';
  position: number;            // symbols consumed after this step
  symbol?: Sym;                // for 'read' and 'stuck'
  before: StateId[];
  active: StateId[];
  taken: string[];             // transition ids used in this step
  verdict?: 'accept' | 'reject';  // on 'stuck' and 'verdict'
}
export interface RunTrace { kind: 'run'; source: Automaton; word: string; steps: RunStep[]; accepted: boolean }
// SubsetTrace (Task 6) and MinimizeTrace (Task 7) are added here too.
export type AnyTrace = RunTrace | SubsetTrace | MinimizeTrace;
```

  - `canRun(a, word): string | null` — reason or null. Order of checks and exact copy: no start → `Set a start state first`; errors → `Fix the errors in the automaton first`; first character not in the alphabet → `'${c}' is not in the alphabet ${formatSet-style list}` e.g. `'c' is not in the alphabet {a, b}` (a space counts as a character).
  - `runWord(a, word): RunTrace` — throws `Error(canRun reason)` if `canRun` is non-null.

Explanation copy (sets via `formatSet`):
- start: `Start: {q0}`; closure: `ε-closure: {q0} → {q0, q1}`; read: `Read 'a': {q0, q1} → {q2}`;
- stuck: `Stuck on 'b': no transition from {q1} → reject`;
- verdict: `Accept: {q2} contains an accepting state` / `Reject: no accepting state in {q0, q1}`.

Step rules (spec §6.1): `closure` steps appear only for NFAs and only when the closure adds states. If `move` is empty, emit a final `stuck` step (active `[]`, verdict `reject`) and stop. Otherwise end with a `verdict` step. `focus.states = active`, `focus.transitions = taken`.

- [ ] **Step 1: Write the failing tests**

```ts
it('DFA run on "00" for even-zeros', () => {
  const t = runWord(evenZeros, '00');
  expect(t.steps.map(s => s.phase)).toEqual(['start', 'read', 'read', 'verdict']);
  expect(t.accepted).toBe(true);
  expect(t.steps[1]?.explanation).toBe("Read '0': {even} → {odd}");
});
it('empty word: start then verdict', ...);
it('NFA run shows ε-closure as its own step', () => {
  // q0 -ε-> q1, q1 -a-> q2 (accepting)
  expect(runWord(nfa, 'a').steps.map(s => s.phase)).toEqual(['start', 'closure', 'read', 'verdict']);
});
it('stuck run ends with a stuck reject step', () => {
  const t = runWord(partialDfa, 'ab');
  expect(t.steps.at(-1)).toMatchObject({ phase: 'stuck', verdict: 'reject', active: [] });
  expect(t.accepted).toBe(false);
});
it('records the transitions taken', ...);
it('ε-cycle run terminates', ...);
describe('canRun', () => {
  it('needs a start state (e.g. after deleting it)', () => expect(canRun(removeState(evenZeros, 'even'), '0')).toBe('Set a start state first'));
  it('names the first bad character', () => expect(canRun(abDfa, 'ab c')).toBe("' ' is not in the alphabet {a, b}"));
  it('rejects automata with errors', ...);
});
it('property: verdict equals accepts()', () => fc.assert(fc.property(arbNfa(), arbWord(), (a, w) => runWord(a, w).accepted === accepts(a, w))));
```

- [ ] **Step 2:** Run `npx vitest run src/core/run.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `trace.ts` (run types; leave `AnyTrace` as `RunTrace` until Tasks 6–7 extend it) and `run.ts`.
- [ ] **Step 4:** Run `npx vitest run src/core`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(core): word-run traces with ε-closure steps`

---

### Task 6: Subset construction

**Files:**
- Create: `src/core/subset.ts`
- Modify: `src/core/trace.ts` (add `SubsetStep`, `SubsetTrace`, extend `AnyTrace`)
- Test: `src/core/subset.test.ts`

**Interfaces:**
- Produces:

```ts
export interface SubsetStep extends StepBase {   // focus = highlights in the source NFA
  phase: 'init' | 'expand' | 'done';
  subset: StateId[];          // NFA states of the DFA state being expanded (init: the start closure)
  symbol?: Sym;
  moved?: StateId[];          // move(subset, symbol)
  closure?: StateId[];        // ε-closure(moved)
  target?: StateId;           // DFA state id reached
  isNew?: boolean;
  dfaFocus: Highlight;        // highlights in the result DFA
  revealedStates: StateId[];  // DFA states built so far (cumulative)
  revealedTransitions: string[];
}
export interface SubsetTrace { kind: 'subset'; source: Automaton; result: Automaton; steps: SubsetStep[] }
```

  - `canConvert(a): string | null` — not NFA → `Conversion needs an NFA`; then no start → `Set a start state first`; errors → `Fix the errors in the automaton first`.
  - `subsetConstruction(nfa): SubsetTrace` — throws on a non-null `canConvert`.

Rules (spec §6.2): FIFO worklist; symbols in alphabet order; one `expand` step per (DFA state, symbol), including the `∅` state's self-loops; `∅` is an explicit DFA state when reached; result is a complete DFA, `kind: 'DFA'`, same alphabet, name `${nfa.name} → DFA`, labels `{q0,q1}` (no space) / `∅`, positions all `0` (layout happens in the store). DFA transitions are grouped per (from, to). Explanations: init `Start state: ε-closure({q0}) = {q0, q1}`; expand `{q0, q1} on 'a': move = {q2}, ε-closure = {q2} → new state {q2}` (or `→ existing state {q2}`); done `Done: ${n} DFA states`.

- [ ] **Step 1: Write the failing tests**

```ts
it('converts the textbook "ends in ab" NFA', () => {
  // q0 -a,b-> q0, q0 -a-> q1, q1 -b-> q2 (accepting)
  const { result, steps } = subsetConstruction(endsInAb);
  expect(result.states.map(s => s.label).sort()).toEqual(['{q0,q1}', '{q0,q2}', '{q0}']);
  expect(steps[0]?.phase).toBe('init');
  expect(steps.at(-1)?.phase).toBe('done');
  expect(steps.filter(s => s.phase === 'expand')).toHaveLength(3 * 2);
});
it('adds an explicit ∅ dead state when needed', ...);
it('revealedStates grows monotonically and ends with all result states', ...);
it('marks reuse vs new correctly', ...);
it('handles ε-cycles', ...);
it('canConvert rejects DFAs', () => expect(canConvert(evenZeros)).toBe('Conversion needs an NFA'));
it('property: result is a valid complete DFA accepting the same language', () =>
  fc.assert(fc.property(arbNfa(), arbWord(), (n, w) => {
    const { result } = subsetConstruction(n);
    return !hasErrors(validate(result)) && isComplete(result) && accepts(result, w) === accepts(n, w);
  })));
```

- [ ] **Step 2:** Run `npx vitest run src/core/subset.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Key DFA states by the sorted-joined NFA id list.
- [ ] **Step 4:** Run `npx vitest run src/core`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(core): step-by-step subset construction`

---

### Task 7: Minimization

**Files:**
- Create: `src/core/minimize.ts`
- Modify: `src/core/trace.ts` (add `MinimizeStep`, `MinimizeTrace`, extend `AnyTrace`)
- Test: `src/core/minimize.test.ts`

**Interfaces:**
- Produces:

```ts
export interface MinimizeStep extends StepBase {
  phase: 'trim' | 'complete' | 'partition' | 'split' | 'done';
  automaton: Automaton;          // the working DFA to draw at this step
  removed?: StateId[];           // 'trim': states fading out (still present in `automaton`)
  deadState?: StateId;           // 'complete'
  blocks: StateId[][];           // current partition; block i is named String.fromCharCode(65 + i)
  split?: { block: number; parts: StateId[][]; witness: { p: StateId; q: StateId; symbol: Sym } };
}
export interface MinimizeTrace { kind: 'minimize'; source: Automaton; result: Automaton; steps: MinimizeStep[] }
```

  - `canMinimize(a): string | null` — not DFA → `Minimization needs a DFA`; no start → `Set a start state first`; errors → `Fix the errors in the automaton first`.
  - `minimize(dfa): MinimizeTrace`.

Rules (spec §6.3): `trim` step only if unreachable states exist; `complete` only if partial; `partition` always ({F, Q∖F} in that order, empty block dropped); then Moore passes: scan blocks in index order; group a block's states by signature (block index of δ(q, a) for each alphabet symbol, in order); if more than one group, emit one `split` step: the group containing the block's first state stays at index i, the others are appended in first-member order. Repeat passes until one makes no split, then `done`. Witness: the block's first state p, the first state q not in p's group, and the first symbol where their target blocks differ. Explanation: `q1 and q3 differ on 'b': q1 → block A, q3 → block B; block C splits into {q1, q2} and {q3}`. Result: one state per block, label = the member label if singleton else `{q1,q3}` (members in state order, no space), positioned at the centroid of members' positions in the working DFA; name `${dfa.name} (min)`; `done` explanation `Done: ${before} → ${after} states`.

- [ ] **Step 1: Write the failing tests**

```ts
it('merges equivalent states', () => {
  // complete DFA over {a}: q0->q1, q1->q2, q2->q1; accepting q1,q2 → q1 ≡ q2
  const { result } = minimize(redundant);
  expect(result.states).toHaveLength(2);
  expect(result.states.map(s => s.label).sort()).toEqual(['q0', '{q1,q2}']);
});
it('emits trim then complete for an unreachable, partial DFA', () =>
  expect(minimize(partialWithUnreachable).steps.map(s => s.phase).slice(0, 3)).toEqual(['trim', 'complete', 'partition']));
it('drops the empty block when all states accept', ...);
it('split explanation names a witness', () => expect(splitStep.explanation).toMatch(/^q\d+ and q\d+ differ on '.'/));
it('places merged states at the centroid', ...);
it('property: same language and no more states than the trimmed, completed input', () =>
  fc.assert(fc.property(arbDfa(), arbWord(), (d, w) => {
    const trimmed = completeWithDeadState(removeUnreachable(d).automaton).automaton;
    const { result } = minimize(d);
    return accepts(result, w) === accepts(d, w) && result.states.length <= trimmed.states.length;
  })));
it('property: idempotent (state count)', () =>
  fc.assert(fc.property(arbDfa(), d => { const once = minimize(d).result; return minimize(once).result.states.length === once.states.length; })));
```

- [ ] **Step 2:** Run `npx vitest run src/core/minimize.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run src/core`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(core): step-by-step Moore minimization`

---

### Task 8: Auto-layout with elkjs

**Files:**
- Create: `src/layout/layout.ts`
- Test: `src/layout/layout.test.ts`

**Interfaces:**
- Consumes: `Automaton`.
- Produces: `layoutAutomaton(a: Automaton): Promise<Automaton>` — same automaton with new `x`/`y` (state centers), using `elkjs/lib/elk.bundled.js`, `elk.algorithm: 'layered'`, `elk.direction: 'RIGHT'`, node size 2 × `STATE_RADIUS` + 16 (import `STATE_RADIUS` value `24` as a local constant to keep `layout/` independent of `ui/`), self-loops omitted from the elk graph.

- [ ] **Step 1: Write the failing test**

```ts
it('gives every state a distinct finite position', async () => {
  const out = await layoutAutomaton(subsetConstruction(endsInAb).result);
  const keys = out.states.map(s => `${s.x},${s.y}`);
  expect(out.states.every(s => Number.isFinite(s.x) && Number.isFinite(s.y))).toBe(true);
  expect(new Set(keys).size).toBe(keys.length);
});
it('places the start state leftmost', ...);
it('keeps everything except positions', ...);
```

- [ ] **Step 2:** Run `npx vitest run src/layout`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run src/layout`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(layout): elkjs auto-layout`

---

### Task 9: Store with undo/redo and trace lock

**Files:**
- Create: `src/store/store.ts`
- Test: `src/store/store.test.ts`

**Interfaces:**
- Consumes: core types, `emptyAutomaton`, `AnyTrace`.
- Produces:

```ts
export interface Viewport { x: number; y: number; zoom: number }
export interface Selection { states: StateId[]; transitions: string[] }
export interface AppState {
  automata: Automaton[];
  activeId: string | null;
  selection: Selection;
  viewports: Record<string, Viewport>;
  trace: AnyTrace | null;
  stepIndex: number;
  history: Record<string, { past: Automaton[]; future: Automaton[] }>;

  createAutomaton(kind: AutomatonKind): string;   // name "Untitled DFA" / "Untitled NFA" (+ " 2", " 3"… if taken); becomes active
  addAutomaton(a: Automaton): void;                // becomes active
  deleteAutomaton(id: string): void;               // active falls back to the next, else previous, else null
  setActive(id: string): void;                     // clears selection
  replaceAll(automata: Automaton[]): void;         // load; clears history and trace
  edit(fn: (a: Automaton) => Automaton, opts?: { record?: boolean }): void; // active automaton; record defaults true; no-op while a trace is open
  checkpoint(): void;                              // push current active snapshot (for gestures)
  undo(): void; redo(): void;
  select(sel: Selection): void;
  setViewport(id: string, vp: Viewport): void;
  openTrace(trace: AnyTrace): void;                // stepIndex 0, clears selection
  setStep(i: number): void;                        // clamped to [0, steps.length - 1]
  closeTrace(): void;
}
export function createAppStore(initial?: Partial<Pick<AppState, 'automata' | 'activeId'>>): StoreApi<AppState>;
export const useAppStore: <T>(selector: (s: AppState) => T) => T;   // bound to a module-level store
export const appStore: StoreApi<AppState>;                          // that module-level store (for non-React code)
export function resetAppStore(initial?: Partial<Pick<AppState, 'automata' | 'activeId'>>): void; // tests only
```

History: `edit` with `record: true` pushes the pre-edit snapshot to `past` (cap 100, dropping the oldest) and clears `future`. A drag calls `checkpoint()` on pointer-down and `edit(fn, { record: false })` while moving.

- [ ] **Step 1: Write the failing tests** (each uses a fresh `createAppStore()`)

```ts
it('edit then undo then redo', ...);
it('a new edit clears redo', ...);
it('caps history at 100', () => { for (let i = 0; i < 105; i++) s.edit(a => moveState(a, 'q0', { x: i, y: 0 })); expect(s.history[id].past).toHaveLength(100); });
it('checkpoint + unrecorded edits undo as one step', ...);
it('edits are ignored while a trace is open', () => { s.openTrace(trace); s.edit(a => renameAutomaton(a, 'x')); expect(active().name).not.toBe('x'); });
it('setStep clamps', ...);
it('createAutomaton picks a free name', () => { s.createAutomaton('DFA'); s.createAutomaton('DFA'); expect(names()).toEqual(['Untitled DFA', 'Untitled DFA 2']); });
it('deleteAutomaton picks a new active automaton', ...);
```

- [ ] **Step 2:** Run `npx vitest run src/store`. Expected: FAIL.
- [ ] **Step 3:** Implement with `createStore` from `zustand/vanilla` + `immer` middleware; `useAppStore` via `useStore`.
- [ ] **Step 4:** Run `npx vitest run src/store`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(store): app store with per-automaton undo/redo and trace lock`

---

### Task 10: Canvas geometry and viewport math

**Files:**
- Create: `src/ui/canvas/geometry.ts`, `src/ui/canvas/viewport.ts`
- Test: `src/ui/canvas/geometry.test.ts`, `src/ui/canvas/viewport.test.ts`

**Interfaces:**
- Produces:

```ts
// geometry.ts
export type Point = { x: number; y: number };
export const STATE_RADIUS = 24, ACCEPT_INSET = 4, RING_WIDTH = 8, CURVE_OFFSET = 32, LOOP_SIZE = 28;
export function edgeGeometry(from: Point, to: Point, curved: boolean): { d: string; label: Point; end: Point; endAngle: number };
export function selfLoopGeometry(center: Point, angle: number): { d: string; label: Point; end: Point; endAngle: number };
export function bestLoopAngle(center: Point, neighbors: Point[]): number;   // radians; −π/2 (up) when no neighbors
export function startArrowGeometry(center: Point): { d: string };          // from the left
export function hitRing(center: Point, p: Point): 'body' | 'ring' | null;  // body: ≤ R, ring: R < d ≤ R + RING_WIDTH
// viewport.ts (Viewport type from store)
export function screenToWorld(p: Point, rect: { left: number; top: number }, vp: Viewport): Point;
export function zoomAt(vp: Viewport, screenPoint: Point, factor: number): Viewport;   // zoom clamped to [0.25, 4], keeps the point fixed
export function fitToView(points: Point[], size: { width: number; height: number }, padding = 48): Viewport;
```

Curved edges bend to the left of the from→to direction, so a pair of opposite edges separates. The label sits `14px` outside the curve (or the line's left normal).

- [ ] **Step 1: Write the failing tests**

```ts
it('straight edges start and end on the circle boundaries', () => {
  const g = edgeGeometry({ x: 0, y: 0 }, { x: 200, y: 0 }, false);
  expect(g.end.x).toBeCloseTo(200 - STATE_RADIUS);
});
it('opposite curved edges put labels on opposite sides', () => {
  const ab = edgeGeometry(A, B, true), ba = edgeGeometry(B, A, true);
  expect(Math.sign(ab.label.y)).toBe(-Math.sign(ba.label.y));
});
it('bestLoopAngle defaults to up and avoids neighbors', () => {
  expect(bestLoopAngle(O, [])).toBeCloseTo(-Math.PI / 2);
  expect(Math.abs(bestLoopAngle(O, [{ x: 100, y: 0 }]))).toBeCloseTo(Math.PI);
});
it('hitRing distinguishes body and ring', ...);
it('screenToWorld inverts pan and zoom', ...);
it('zoomAt keeps the screen point fixed and clamps zoom', ...);
it('fitToView contains all points', ...);
```

- [ ] **Step 2:** Run `npx vitest run src/ui/canvas`. Expected: FAIL.
- [ ] **Step 3:** Implement (quadratic Bézier for curves; cubic for loops).
- [ ] **Step 4:** Run `npx vitest run src/ui/canvas`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(canvas): edge, self-loop and viewport geometry`

---

### Task 11: Static SVG renderer

**Files:**
- Create: `src/ui/canvas/Diagram.tsx`, `src/ui/canvas/StateNode.tsx`, `src/ui/canvas/EdgeView.tsx`, `src/ui/canvas/diagramStyles.ts`
- Test: `src/ui/canvas/Diagram.test.tsx`

**Interfaces:**
- Consumes: geometry, `Viewport`, `Automaton`.
- Produces:

```ts
export interface DiagramHighlight {
  active?: StateId[]; taken?: string[];             // run / focus
  faded?: StateId[];                                // minimization trim
  tints?: Record<StateId, number>;                  // partition block index
  visibleStates?: StateId[]; visibleTransitions?: string[];  // subset reveal; undefined = all
  errorStates?: StateId[]; errorTransitions?: string[];
  selectedStates?: StateId[]; selectedTransitions?: string[];
}
export interface DiagramProps {
  automaton: Automaton; viewport: Viewport; highlight?: DiagramHighlight;
  svgRef?: React.Ref<SVGSVGElement>;
  children?: React.ReactNode;    // overlay layer (e.g. a rubber-band edge while drawing)
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;  // interaction hooks attach here (Task 12)
  onDoubleClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  onContextMenu?: (e: React.MouseEvent<SVGSVGElement>) => void;
}
export function Diagram(props: DiagramProps): JSX.Element;
```

DOM contract (relied on by later tasks and e2e): `<svg data-testid="diagram">`; each state `<g data-testid="state-${label}" data-state-id={id} data-active data-accepting data-start data-selected data-error data-tint>`; each edge `<g data-testid="edge-${fromLabel}-${toLabel}" data-transition-id={id} data-taken ...>` with a `<text data-testid="edge-label">` showing symbols joined by `,`; start arrow `data-testid="start-arrow"`. Styling uses classes defined in a `<style>` element inside the `<svg>` (from `diagramStyles.ts`) and CSS custom properties with fallbacks, so an exported SVG is self-contained. Highlights animate with CSS transitions.

- [ ] **Step 1: Write the failing tests**

```tsx
it('draws states, accepting rings, start arrow and edge labels', () => {
  render(<Diagram automaton={abDfa} viewport={{ x: 0, y: 0, zoom: 1 }} />);
  expect(screen.getByTestId('state-q1')).toHaveAttribute('data-accepting', 'true');
  expect(screen.getByTestId('start-arrow')).toBeInTheDocument();
  expect(within(screen.getByTestId('edge-q1-q1')).getByTestId('edge-label')).toHaveTextContent('a,b');
});
it('marks active states and taken edges', ...);
it('hides states and edges outside visibleStates/visibleTransitions', ...);
it('applies tints and faded flags', ...);
it('embeds its stylesheet in the svg', () => expect(container.querySelector('svg style')).not.toBeNull());
```

- [ ] **Step 2:** Run `npx vitest run src/ui/canvas/Diagram.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement. Curved iff the reverse edge exists; self-loop angle from `bestLoopAngle` over the state's neighbors; arrowheads as a `<marker>` or a small path at `end`/`endAngle`. Minimal neutral styling only (Task 20 does the visual design).
- [ ] **Step 4:** Run `npx vitest run src/ui/canvas`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(canvas): static SVG state-diagram renderer`

---

### Task 12: App shell with automaton list and toolbar

**Files:**
- Create: `src/ui/shell/AutomatonList.tsx`, `src/ui/shell/Toolbar.tsx`, `src/ui/canvas/Canvas.tsx`
- Modify: `src/ui/shell/App.tsx`, `src/ui/shell/App.test.tsx`
- Test: `src/ui/shell/AutomatonList.test.tsx`, `src/ui/shell/Toolbar.test.tsx`

**Interfaces:**
- Consumes: `useAppStore`, `Diagram`, `validate`, `setKind`, `canRun`/`canConvert`/`canMinimize`.
- Produces:
  - Layout: left sidebar `AutomatonList`, top `Toolbar`, center `Canvas`, right slot for the table (Task 14), bottom slot for the player (Task 15).
  - `AutomatonList`: buttons `New DFA` / `New NFA`; one item per automaton (`data-testid="automaton-item"`, active marked `aria-current="true"`); double-click the name to rename (via `renameAutomaton`); a delete button that asks `Delete "${name}"?` with `window.confirm`.
  - `Toolbar`: kind toggle `DFA | NFA` (on failure, shows the first issue message inline with `role="alert"`; Task 18 turns it into a toast), `Undo`, `Redo`, `Fit`, `Tidy` (Task 13 wires Tidy), `Convert to DFA`, `Minimize` (disabled with `title` = the `can*` reason). Run lives in the player panel (Task 15).
  - `Canvas`: renders the active automaton with its viewport (default `{0,0,1}`), with `errorStates`/`errorTransitions` from `validate`; empty state text `Create an automaton to get started` when there is none.

- [ ] **Step 1: Write the failing tests**

```tsx
it('New DFA creates and activates an automaton', async () => { await user.click(screen.getByRole('button', { name: 'New DFA' })); expect(screen.getByTestId('automaton-item')).toHaveAttribute('aria-current', 'true'); });
it('delete asks for confirmation', ...);
it('Minimize is disabled with a reason on an NFA', () => expect(screen.getByRole('button', { name: 'Minimize' })).toHaveAttribute('title', 'Minimization needs a DFA'));
it('switching an NFA with ε to DFA shows an alert', ...);
it('Undo/Redo call the store', ...);
```

- [ ] **Step 2:** Run `npx vitest run src/ui/shell`. Expected: FAIL.
- [ ] **Step 3:** Implement. Components take the store from `useAppStore`; tests call `resetAppStore()` (Task 9) in `beforeEach`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS. Run `npm run dev` and click through New DFA / New NFA manually.
- [ ] **Step 5: Commit** — `feat(shell): app layout, automaton list and toolbar`

---

### Task 13: Canvas editing interactions

**Files:**
- Create: `src/ui/canvas/useCanvasEditing.ts`, `src/ui/canvas/InlineInput.tsx`, `src/ui/canvas/ContextMenu.tsx`
- Modify: `src/ui/canvas/Canvas.tsx`, `src/ui/shell/Toolbar.tsx` (wire Fit and Tidy)
- Test: `src/ui/canvas/Canvas.test.tsx`

**Interfaces:**
- Consumes: edit ops, `parseSymbolInput`, `hitRing`, `screenToWorld`, `zoomAt`, `fitToView`, `layoutAutomaton`, store `edit`/`checkpoint`/`select`/`setViewport`.
- Produces the gesture table from spec §7:
  - Double-click empty space → `addState` at the world point.
  - Pointer-down on a state body → select + `checkpoint()`; move → `edit(moveState, { record: false })`.
  - Pointer-down on the ring → rubber-band to the pointer; release over a state (or the same state) → `InlineInput` (`data-testid="symbol-input"`) at the edge midpoint. Enter parses with `parseSymbolInput`: an error shows under the input and keeps it open; unknown symbols are added with `addAlphabetSymbol` first; then `setEdgeSymbols`, merged with any existing symbols on that edge; an empty list cancels. Escape cancels.
  - Double-click a state → inline rename (duplicate label → message `Two states are named ${label}` and stays open); double-click an edge label → inline symbol edit (replaces the symbols; empty deletes the edge).
  - Context menu on a state: `Set as start`, `Toggle accepting`, `Delete`; on an edge: `Edit symbols`, `Delete`.
  - Keys with a selection: `S` setStart, `A` toggleAccepting, `Delete`/`Backspace` remove; `Ctrl+Z` / `Ctrl+Shift+Z` undo/redo (ignored while an input is focused).
  - Background drag or Space+drag pans; wheel zooms via `zoomAt` (factor `1.1` per notch).
  - `Fit` → `fitToView`; `Tidy` → `checkpoint()`, `await layoutAutomaton`, `edit(..., { record: false })`; positions animate with a CSS transition on the state transform.
  - All of the above is disabled while a trace is open.

- [ ] **Step 1: Write the failing tests** (jsdom; `getBoundingClientRect` returns 0s, so world = screen at the default viewport)

```tsx
it('double-click on empty space adds q0', ...);
it('S and A keys set start and accepting on the selected state', ...);
it('Delete removes the selected state', ...);
it('dragging from the ring to another state opens the symbol input; "a, b" creates an edge', ...);
it('a new symbol typed on an edge is added to the alphabet', async () => {
  // DFA with alphabet "a"; draw q0→q1, type "c", Enter
  expect(active().alphabet).toEqual(['a', 'c']);
});
it('an invalid symbol shows the parse error and keeps the input open', ...);  // "ab" → "Symbols must be single characters: ab"
it('a state drag undoes in one step', ...);
it('editing is disabled while a trace is open', ...);
```

- [ ] **Step 2:** Run `npx vitest run src/ui/canvas/Canvas.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement, using pointer capture during drags.
- [ ] **Step 4:** Run `npm test`. Expected: PASS. Run `npm run dev` and build a 3-state DFA by mouse only.
- [ ] **Step 5: Commit** — `feat(canvas): direct-manipulation editing, pan/zoom, fit and tidy`

---

### Task 14: Transition table and issues list

**Files:**
- Create: `src/ui/table/TransitionTable.tsx`, `src/ui/table/IssuesList.tsx`
- Modify: `src/ui/shell/App.tsx` (right panel, collapsible with a `Table` toggle button)
- Test: `src/ui/table/TransitionTable.test.tsx`, `src/ui/table/IssuesList.test.tsx`

**Interfaces:**
- Consumes: edit ops, `validate`, `parseSymbolInput`, store.
- Produces:
  - `TransitionTable({ automaton, readOnly, onEdit: (fn) => void })`: rows = states (`→` start, `*` accepting markers, as buttons that toggle); columns = alphabet + `ε` for NFA; DFA cell = `<select aria-label="δ(${state}, ${sym})">` with `—` for none; NFA cell = checkbox chip list (`aria-label="${target}"` per chip in a group labeled `δ(${state}, ${sym})`). Header: `+ symbol` input (validated with `parseSymbolInput`, one character), per-column rename/delete; row header rename/delete. Cells touched by an error issue have `data-error="true"`.
  - `IssuesList({ issues, onSelect: (sel: Selection) => void })`: errors first, then warnings; clicking an item selects its `stateId`/`transitionId`.

- [ ] **Step 1: Write the failing tests**

```tsx
it('choosing a target in a DFA cell adds the transition', async () => {
  await user.selectOptions(screen.getByLabelText('δ(q0, a)'), 'q1');
  expect(onEdit).toHaveBeenCalled();   // apply the fn to the automaton and check the q0→q1 edge has 'a'
});
it('toggling NFA chips adds and removes targets', ...);
it('shows an ε column only for NFAs', ...);
it('adds an alphabet symbol from the header', ...);
it('marks cells involved in nondeterminism', ...);
it('is read-only while readOnly', ...);
it('IssuesList orders errors first and selects on click', ...);
```

- [ ] **Step 2:** Run `npx vitest run src/ui/table`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(table): synced transition table and issues list`

---

### Task 15: Trace player and word runs

**Files:**
- Create: `src/ui/player/TracePlayer.tsx`, `src/ui/player/RunPanel.tsx`, `src/ui/player/RunTraceView.tsx`, `src/store/traceActions.ts`
- Modify: `src/ui/shell/App.tsx` (bottom panel; while a trace is open, the canvas renders the trace view instead of the editable canvas)
- Test: `src/ui/player/TracePlayer.test.tsx`, `src/ui/player/RunPanel.test.tsx`

**Interfaces:**
- Consumes: `canRun`, `runWord`, store `openTrace`/`setStep`/`closeTrace`.
- Produces:
  - `traceActions.ts`: `startRun(word: string): void`; Tasks 16–17 add `startSubset(): Promise<void>` and `startMinimize(): void`.
  - `TracePlayer({ stepCount, index, onIndex, explanation, onClose, extraActions?: ReactNode })`: buttons `Previous`, `Next`, `Play`/`Pause`, speed select `0.5×`/`1×`/`2×` (base interval 800 ms), a range scrubber `aria-label="Step"`, a step counter `Step ${i + 1} / ${n}`, the explanation in `aria-live="polite"`, and `Close`. Keys: ←/→ step, Space play/pause, Esc close. Autoplay stops at the last step.
  - `RunPanel`: a word input (`aria-label="Word"`, placeholder `Word (empty = ε)`) and `Run` button disabled with `title` = `canRun` reason.
  - `RunTraceView({ trace, stepIndex })`: the word with consumed characters marked and the current one emphasized (`data-testid="word-char"`, `data-state="consumed|current|pending"`), plus a `Diagram` with `active`/`taken`; on the final step a verdict badge `Accepted` / `Rejected` (`data-testid="verdict"`).

- [ ] **Step 1: Write the failing tests**

```tsx
it('Next/Previous/scrubber move the index and clamp', ...);
it('autoplay advances and stops at the end', () => { vi.useFakeTimers(); /* Play → advance 800ms × n → index n-1 and Play label back */ });
it('keyboard: arrows, space and Esc', ...);
it('Run is disabled with the reason for a bad word', async () => {
  await user.type(screen.getByLabelText('Word'), 'ac');
  expect(screen.getByRole('button', { name: 'Run' })).toHaveAttribute('title', "'c' is not in the alphabet {a, b}");
});
it('running shows the verdict on the last step', ...);
```

- [ ] **Step 2:** Run `npx vitest run src/ui/player`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: PASS. Run `npm run dev`, build "even zeros", run `0010`.
- [ ] **Step 5: Commit** — `feat(player): generic trace player and word-run walkthrough`

---

### Task 16: Subset-construction walkthrough

**Files:**
- Create: `src/ui/player/SubsetTraceView.tsx`
- Modify: `src/store/traceActions.ts`, `src/ui/shell/Toolbar.tsx`, `src/ui/shell/App.tsx`
- Test: `src/ui/player/SubsetTraceView.test.tsx`, `src/store/traceActions.test.ts`

**Interfaces:**
- Consumes: `canConvert`, `subsetConstruction`, `layoutAutomaton`, `Diagram`, `TracePlayer`, store `addAutomaton`.
- Produces:
  - `startSubset(): Promise<void>` — computes the trace, lays out `trace.result` with `layoutAutomaton`, stores the laid-out result in the trace, `openTrace`.
  - `SubsetTraceView({ trace, stepIndex })`: split view; left `Diagram` of `trace.source` with `active = step.focus.states`; right `Diagram` of `trace.result` with `visibleStates = step.revealedStates`, `visibleTransitions = step.revealedTransitions`, `active = step.dfaFocus.states`, `taken = step.dfaFocus.transitions`. Each pane has its own fitted viewport.
  - On the `done` step, the player's `extraActions` shows `Save as new automaton`, which calls `addAutomaton(trace.result)` and closes the trace (the result's ids are freshly generated per trace, so no remapping is needed).

- [ ] **Step 1: Write the failing tests**

```ts
it('startSubset opens a subset trace with laid-out, distinct positions', async () => { await startSubset(); /* trace.kind === 'subset'; positions distinct */ });
```
```tsx
it('reveals DFA states step by step', ...);   // count [data-testid^="state-"] in the right pane grows
it('Save as new automaton adds "N → DFA" and closes the trace', ...);
```

- [ ] **Step 2:** Run `npx vitest run src/ui/player src/store`. Expected: FAIL.
- [ ] **Step 3:** Implement; wire `Convert to DFA` in the toolbar.
- [ ] **Step 4:** Run `npm test`. Expected: PASS. Manually convert an NFA and step through.
- [ ] **Step 5: Commit** — `feat(player): subset-construction walkthrough`

---

### Task 17: Minimization walkthrough

**Files:**
- Create: `src/ui/player/MinimizeTraceView.tsx`
- Modify: `src/store/traceActions.ts`, `src/ui/shell/Toolbar.tsx`, `src/ui/shell/App.tsx`
- Test: `src/ui/player/MinimizeTraceView.test.tsx`

**Interfaces:**
- Consumes: `canMinimize`, `minimize`, `Diagram`, `TracePlayer`, `addAutomaton`.
- Produces:
  - `startMinimize(): void`.
  - `MinimizeTraceView({ trace, stepIndex })`: `Diagram` of `step.automaton` with `tints` from `step.blocks` (state → block index), `faded = step.removed`, `active` = the split block's states on `split` steps; a legend listing blocks `A: {q0, q2}`…; on `done`, it shows the result diagram and `Save as new automaton`.

- [ ] **Step 1: Write the failing tests**

```tsx
it('tints states by block', ...);              // data-tint values match block indices
it('fades removed states on the trim step', ...);
it('shows the block legend', ...);
it('done step shows the minimized automaton and Save adds "D (min)"', ...);
```

- [ ] **Step 2:** Run `npx vitest run src/ui/player`. Expected: FAIL.
- [ ] **Step 3:** Implement; wire `Minimize` in the toolbar.
- [ ] **Step 4:** Run `npm test`. Expected: PASS. Manually minimize the redundant example.
- [ ] **Step 5: Commit** — `feat(player): minimization walkthrough`

---

### Task 18: Persistence, examples, import/export, toasts

**Files:**
- Create: `src/persistence/schema.ts`, `migrate.ts`, `fileFormat.ts`, `storage.ts`, `useAutosave.ts`, `examples.ts`, `src/ui/shell/toastStore.ts`, `src/ui/shell/Toasts.tsx`, `src/ui/shell/download.ts`
- Modify: `src/main.tsx` (load at startup), `src/ui/shell/App.tsx` (window drop target), `src/ui/shell/Toolbar.tsx` (Import, Export current, Export all; replace the Task 12 inline alert with a toast)
- Test: `src/persistence/*.test.ts`

**Interfaces:**
- Produces:
  - `schema.ts`: zod `automatonSchema`, `fileSchema` (`format: z.literal('automaton-vis')`, `version: z.number().int()`), with a refinement giving `Transition ${id} points to unknown state ${stateId}` and `Symbols must be single characters` errors.
  - `migrate.ts`: `CURRENT_VERSION = 1`; `migrate(json: unknown): unknown` — passes v1 through; version > current → throws `This file is from a newer version of Automaton Vis`.
  - `fileFormat.ts`: `serialize(automata: Automaton[]): string` (2-space JSON); `parseFile(text: string, existingIds: Set<string>): { ok: true; automata: Automaton[] } | { ok: false; error: string }` — `Not a valid JSON file`, `Not an Automaton Vis file`, or the first zod issue message; automata whose id is in `existingIds` get `newId()`. All-or-nothing.
  - `storage.ts`: `STORAGE_KEY = 'automaton-vis:v1'`, `BACKUP_KEY = 'automaton-vis:v1:corrupt-backup'`; `loadFromStorage(storage: Storage | null): { automata: Automaton[]; warning?: string }` — nothing stored → `exampleAutomata()`; unreadable → copy the raw string to `BACKUP_KEY`, return examples and warning `Saved data could not be read; a backup was kept and the examples were loaded`; `storage` null or throwing → examples + warning `Changes won't persist — export to save`. `saveToStorage(storage, automata): boolean`.
  - `useAutosave()`: subscribes to `automata`, debounces 500 ms, calls `saveToStorage`; on the first `false`, one toast `Changes won't persist — export to save`.
  - `examples.ts`: `exampleAutomata(): Automaton[]` — `Ends in ab (NFA)` with an ε-transition, `Even number of 0s (DFA)`, `Redundant states (DFA)` that minimizes to fewer states; hand-placed positions.
  - `toastStore.ts`: `toast(message: string, kind?: 'info' | 'error'): void`; `Toasts` renders them (`role="status"`), auto-dismiss after 5 s.
  - `download.ts`: `downloadText(filename, text, mime)`, `downloadBlob(filename, blob)`. Export filenames: `${slug(name)}.automaton.json` / `automata.automaton.json`.

- [ ] **Step 1: Write the failing tests**

```ts
it('round-trips serialize → parseFile', ...);
it('renames colliding ids on import', ...);
it('rejects a dangling transition with a specific message', () => expect(parseFile(bad, new Set())).toEqual({ ok: false, error: 'Transition t3 points to unknown state q9' }));
it('rejects non-JSON and foreign JSON', ...);
it('rejects a newer version', ...);
it('loads the examples on first launch', ...);
it('survives corrupted storage and keeps a backup', () => {
  const s = memoryStorage({ [STORAGE_KEY]: '{oops' });
  const r = loadFromStorage(s);
  expect(r.automata.length).toBe(3);
  expect(r.warning).toMatch(/backup/);
  expect(s.getItem(BACKUP_KEY)).toBe('{oops');
});
it('survives a storage that throws', ...);
it('examples: languages and minimization', () => {
  const [endsInAb, evenZeros, redundant] = exampleAutomata();
  expect(['ab', 'aab', 'bab'].every(w => accepts(endsInAb, w))).toBe(true);
  expect(['', 'a', 'ba'].some(w => accepts(endsInAb, w))).toBe(false);
  expect(minimize(redundant).result.states.length).toBeLessThan(redundant.states.length);
  expect(exampleAutomata().every(a => !hasErrors(validate(a)))).toBe(true);
});
```

- [ ] **Step 2:** Run `npx vitest run src/persistence`. Expected: FAIL.
- [ ] **Step 3:** Implement and wire into `main.tsx`, the toolbar, and the drop target.
- [ ] **Step 4:** Run `npm test`. Expected: PASS. Manually: reload keeps edits; export then import a file.
- [ ] **Step 5: Commit** — `feat(persistence): autosave, examples, versioned JSON import/export`

---

### Task 19: Diagram export and error boundary

**Files:**
- Create: `src/ui/canvas/exportDiagram.ts`, `src/ui/shell/ErrorBoundary.tsx`
- Modify: `src/ui/shell/Toolbar.tsx` (`Export SVG`, `Export PNG`), `src/main.tsx` (wrap `App`)
- Test: `src/ui/canvas/exportDiagram.test.ts`, `src/ui/shell/ErrorBoundary.test.tsx`

**Interfaces:**
- Produces:
  - `diagramToSvgString(svg: SVGSVGElement, automaton: Automaton): string` — clones the SVG, resets the viewport transform, sets `viewBox` to the automaton's bounds plus 32 px padding, adds `xmlns`, and resolves CSS custom properties used by `diagramStyles.ts` to their current computed values.
  - `svgToPng(svgText: string, scale = 2): Promise<Blob>` — via `Image` + `canvas.toBlob`.
  - `ErrorBoundary`: on error shows `Something went wrong` with buttons `Export your data` (serializes the store's automata with `serialize` and downloads) and `Reload`.

- [ ] **Step 1: Write the failing tests**

```ts
it('exported SVG is standalone with a fitted viewBox', () => {
  const text = diagramToSvgString(svgEl, abDfa);
  expect(text).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(text).toMatch(/viewBox="-?\d/);
  expect(text).toContain('<style');
});
it('ErrorBoundary offers data export after a crash', ...);
```

- [ ] **Step 2:** Run `npx vitest run src/ui/canvas/exportDiagram.test.ts src/ui/shell/ErrorBoundary.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement. (PNG is verified manually in the browser; jsdom has no canvas.)
- [ ] **Step 4:** Run `npm test`. Expected: PASS. Manually export an SVG and PNG and open them.
- [ ] **Step 5: Commit** — `feat: SVG/PNG diagram export and crash recovery`

---

### Task 20: Visual design pass

**Files:**
- Modify: styles and markup across `src/ui/**` and `src/ui/canvas/diagramStyles.ts`; add `src/ui/theme.css`

**Interfaces:**
- Consumes: the whole UI. Must not change behavior, `data-testid`s, ARIA labels, or button names used by tests.

- [ ] **Step 1:** Invoke the `frontend-design` skill and settle an aesthetic direction (typography, palette, light/dark, motion) for a polished portfolio piece. Record the direction in a short comment at the top of `theme.css`.
- [ ] **Step 2:** Apply it: the app shell, list, toolbar, table, player, toasts, and the diagram (state/edge styling, highlight and tint colors, the run animation, the verdict badge). Diagram colors go through CSS custom properties consumed by `diagramStyles.ts` so SVG export keeps working. Make the layout usable for viewing and running at phone width (panels stack; editing need not work).
- [ ] **Step 3:** Run `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 4:** Run `npm run dev` and check every view (edit, run, subset, minimize, empty state, error toast) in light and dark mode and at 390 px width.
- [ ] **Step 5: Commit** — `style: visual design pass`

---

### Task 21: End-to-end smoke tests and deploy

**Files:**
- Create: `playwright.config.ts`, `e2e/build-and-run.spec.ts`, `e2e/convert.spec.ts`, `e2e/import-export.spec.ts`, `.github/workflows/deploy.yml`
- Modify: `package.json` (`e2e` script), `.github/workflows/ci.yml` (run e2e), `README.md` (live link, screenshot, dev commands), `PROGRESS.md`

**Interfaces:**
- Consumes: the `data-testid`s and ARIA names from Tasks 11–18.

- [ ] **Step 1: Write the e2e specs** (Playwright `webServer: npm run build && npm run preview`, `baseURL` ending in `/automaton-vis/` to match the Vite `base`, Chromium only)
  - `build-and-run`: clear storage; `New DFA`; double-click twice to add `q0`, `q1`; ring-drag q0→q1, type `a`, Enter; select q0 and press `S`, select q1 and press `A`; type `a` in Word, `Run`, click `Next` until the last step; expect `verdict` to have text `Accepted`.
  - `convert`: select the `Ends in ab (NFA)` example, `Convert to DFA`, step to the end, `Save as new automaton`; expect an automaton item named `Ends in ab (NFA) → DFA`.
  - `import-export`: `Export all` (capture the download), clear storage and reload, import the file; expect the same automaton names.
- [ ] **Step 2:** Run `npx playwright install chromium && npm run e2e`. Expected: 3 passed.
- [ ] **Step 3:** Add `.github/workflows/deploy.yml`: on push to `master`, build and deploy `dist/` with `actions/upload-pages-artifact` + `actions/deploy-pages` (needs Pages enabled with source "GitHub Actions" in the repo settings: tell the user). Add the e2e job to `ci.yml`.
- [ ] **Step 4:** Update `README.md` (live URL `https://tomerti.github.io/automaton-vis/`, a screenshot, `npm` scripts) and tick everything done in `PROGRESS.md`.
- [ ] **Step 5:** Run `npm test && npm run typecheck && npm run lint && npm run build && npm run e2e`. Expected: all pass.
- [ ] **Step 6: Commit** — `test: e2e smoke tests; ci: deploy to GitHub Pages`
