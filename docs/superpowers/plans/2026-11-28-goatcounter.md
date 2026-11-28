# GoatCounter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Count visits and main-feature use of the live site with GoatCounter (`tomerti`).

**Architecture:** `src/analytics.ts` loads `count.js` only on `tomerti.github.io` and exposes
`track(event)`, a no-op without the script. Each feature calls `track` once where it succeeds.

**Tech Stack:** TypeScript, Vitest (jsdom), GoatCounter `count.js`.

**Spec:** `docs/superpowers/specs/2026-11-28-goatcounter-design.md`

## Global Constraints

- Endpoint `https://tomerti.goatcounter.com/count`, script `https://gc.zgo.at/count.js`, loaded
  `async`, only when `location.hostname === 'tomerti.github.io'`.
- Event payload: `{ path: event, title: event, event: true }`. Event names come only from the
  `AnalyticsEvent` union; nothing user-typed or user-named is ever part of one.
- `core/` and `layout/` never import `analytics.ts`; `store/` and `ui/` may.
- `track` never throws (try/catch) and does nothing when `window.goatcounter` is missing.
- Count on success (after the guards and the toast-worthy outcome), once per user action.

## Review Focus

- Ad blocker / offline: `window.goatcounter` absent or `count` throwing → the action still works.
- A lesson's runs and walkthroughs go through the same functions → counted like any other (fine).
- A refused action (Run disabled, Nothing to export, unreadable link, parse error) → no event.
- The welcome demo run doesn't go through `startRun` → never counted.
- Pageview path: share hash is cleared by `openSharedLink`, and `count.js` ignores the hash anyway.

---

### Task 1: `src/analytics.ts`

**Files:** Create `src/analytics.ts`, `src/analytics.test.ts`; Modify `src/main.tsx`.

**Produces:**
- `type AnalyticsEvent = 'run-dfa' | 'run-nfa' | 'convert' | 'minimize' | 'regex' | 'tidy' |
  'share-link' | 'open-shared-link' | 'import-json' | 'import-latex' | 'paste-latex' |
  'export-json' | 'export-svg' | 'export-png' | 'export-latex' | 'copy-image' | 'copy-latex' |
  \`lesson-${string}-start\` | \`lesson-${string}-finish\`` (lesson ids are `LessonId`s at the
  call site; `ui/` types can't be imported here).
- `startAnalytics(hostname = location.hostname, doc = document): void`
- `track(event: AnalyticsEvent): void`
- `declare global { interface Window { goatcounter?: { count(v: { path: string; title?: string; event?: boolean }): void } } }`

- [ ] Tests: `startAnalytics('tomerti.github.io', doc)` appends one script with the exact `src`,
  `async`, `data-goatcounter`; a second call appends no second one; `'localhost'` and
  `'someone.github.io'` append nothing. `track('run-dfa')` with a mocked `window.goatcounter`
  calls `count({ path: 'run-dfa', title: 'run-dfa', event: true })`; without it, and with a
  throwing `count`, `track` doesn't throw.
- [ ] Run `npx vitest run src/analytics.test.ts` → fails; implement; → passes.
- [ ] `main.tsx`: call `startAnalytics()` after the theme setup.
- [ ] Commit `feat(analytics): load GoatCounter on the live site`.

### Task 2: store events

**Files:** Modify `src/store/traceActions.ts`, `src/store/regexActions.ts` and their tests.

- [ ] Tests (mock `window.goatcounter.count` in `beforeEach`, delete in `afterEach`):
  `startRun` on a DFA → `run-dfa`, on an NFA → `run-nfa`, a refused run → no call;
  `startSubset` that opens its trace → `convert`, a dropped one → none; `startMinimize` →
  `minimize`; `createFromRegex` that returns an id → `regex`, a refused regex → none.
- [ ] Implement: `track` right after each `openTrace(...)` / successful return
  (`run-${a.kind === 'DFA' ? 'dfa' : 'nfa'}`).
- [ ] `npx vitest run src/store` passes. Commit `feat(analytics): count runs, conversions, minimizing and regexes`.

### Task 3: shell events

**Files:** Modify `src/ui/shell/Toolbar.tsx`, `HistoryBar.tsx`, `copyLink.ts`,
`useSharedLink.ts`, `importFile.ts`; tests in the matching `*.test.ts(x)` where one exists.

- [ ] `tidy`: in Toolbar's `tidy()` when `tidyActive()` resolves true (beside `noteTidied`).
- [ ] `share-link`: in `copyLink` after the clipboard write succeeds.
- [ ] `open-shared-link`: in `openSharedLink` after the automaton opens (not on the error toast).
- [ ] `import-json` / `import-latex`: in `importFile` by which parser ran, only when `result.ok`;
  `paste-latex`: `importLatexFromDialog` and `importLatexText` on success. Pass the event into
  `addParsed` so it fires only on `ok`.
- [ ] `export-svg` / `export-png` / `export-latex` / `copy-image` / `copy-latex` in Toolbar after
  the download or clipboard write succeeds; `export-json` / `export-latex` in HistoryBar's
  `exportOne`, `exportLatex` and both Export all items.
- [ ] Tests: `useSharedLink.test.tsx` (opened → `open-shared-link`, unreadable → none);
  importFile JSON → `import-json`, `.tex` → `import-latex`, bad file → none; HistoryBar Export
  JSON → `export-json`; Toolbar Export LaTeX → `export-latex`.
- [ ] `npx vitest run src/ui/shell` passes. Commit `feat(analytics): count tidy, sharing, imports and exports`.

### Task 4: lesson events

**Files:** Modify `src/ui/tutorial/tutorialStore.ts` and its test.

- [ ] `startLesson`: `track(\`lesson-${lesson.id}-start\`)` when `isLessonId(lesson.id)` (tests'
  own lessons aren't counted); `finishLesson`: `lesson-${id}-finish` beside `markLessonFinished`.
- [ ] Test: starting `'nfa'` → `lesson-nfa-start`; finishing it → `lesson-nfa-finish`.
- [ ] Commit `feat(analytics): count lessons started and finished`.

### Task 5: docs and full check

- [ ] README *Good to know*: visits and feature use are counted anonymously with GoatCounter, no
  cookies, nothing typed or drawn is sent. CLAUDE.md: `src/analytics.ts` bullet (layering, the
  hostname gate, fixed names only). PROGRESS.md: Done entry dated 2026-11-28.
- [ ] `npm run typecheck && npm run lint && npm run format:check && npm test && npm run e2e` all pass.
- [ ] Commit `docs: GoatCounter analytics`.
