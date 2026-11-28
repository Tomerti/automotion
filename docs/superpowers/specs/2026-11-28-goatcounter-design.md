# GoatCounter analytics

## Why

Tomer wants to know whether people use AutoMotion and which parts of it they use: visits, plus
counts of the main features. GoatCounter (site code `tomerti`, dashboard
https://tomerti.goatcounter.com) is cookie-free and keeps no personal data.

## Goals

- Count visits to the live site (GoatCounter's pageview: referrer, country, browser, screen size).
- Count uses of the main features as GoatCounter events.

## Non-goals and anti-goals

- No cookies, no consent banner, no user ids, nothing per person.
- **Never send what the user made or typed:** no words, regexes, automaton or state names, file
  names, share-link contents. Event names are fixed strings from a closed list. The share hash
  (`#a=…`) is never part of the counted path (GoatCounter counts `pathname` + `search` only).
- Dev, unit tests, e2e, CI and copies hosted anywhere else send nothing and load nothing from
  GoatCounter.
- Analytics never breaks or slows the app: blocked, missing or late scripts are silent no-ops.

## Approaches

- **A. Load `count.js` only on `tomerti.github.io`, events through a `track()` helper (chosen).**
  Nothing reaches GoatCounter off the live site, and tests never depend on a third-party host.
  Events fired before the script has loaded are dropped (negligible).
- B. GoatCounter's standard `<script>` tag in `index.html`. Simpler, but dev and every e2e run fetch
  `gc.zgo.at`, and forks would report to this dashboard.
- C. One store listener inferring events from state changes. No scattered calls, but fragile
  (a run or export isn't reliably visible in a state diff). Dropped.

## Design

- `src/analytics.ts` (top level, so both `store/` and `ui/` may import it; `core/` and `layout/`
  never do):
  - `startAnalytics()`, called once from `main.tsx`: when `location.hostname` is
    `tomerti.github.io`, appends `<script async data-goatcounter="https://tomerti.goatcounter.com/count"
    src="https://gc.zgo.at/count.js">`. Otherwise does nothing.
  - `track(event: AnalyticsEvent)`: calls `window.goatcounter?.count({ path: event, title: event,
    event: true })` inside try/catch; no-op when the script is absent.
  - `AnalyticsEvent` is a string-literal union, so only listed names can be sent.
- Events (called where the action actually happens, once per user action):

  | Event | When |
  | --- | --- |
  | `run-dfa`, `run-nfa` | a word's run opens (`startRun`) |
  | `convert` | a Convert to DFA walkthrough opens (`startSubset`) |
  | `minimize` | a Minimize walkthrough opens (`startMinimize`) |
  | `regex` | From regex builds a DFA (`createFromRegex` succeeds) |
  | `tidy` | Tidy is applied |
  | `share-link` | Share link copied |
  | `open-shared-link` | the app opens a shared link |
  | `import-json`, `import-latex`, `paste-latex` | an import succeeds |
  | `export-json`, `export-svg`, `export-png`, `export-latex`, `copy-image`, `copy-latex` | an export |
  | `lesson-<id>-start`, `lesson-<id>-finish` | a lesson (Basics included) starts / is finished |

  The welcome screen's demo run is not a user action and is not counted.
- README, *Good to know*: say visits and feature use are counted anonymously with GoatCounter, with
  no cookies and nothing typed or drawn sent. CLAUDE.md: a line on `src/analytics.ts` and the
  no-user-content rule. PROGRESS.md: a Done entry.

## Left to the builder

- Exact call sites for each event (existing choke points: `store/traceActions.ts`,
  `store/regexActions.ts`, `ui/shell/copyLink.ts`, `useSharedLink.ts`, `importFile.ts`,
  `pasteLatex.ts`, the Toolbar/HistoryBar export items, `tutorial/tutorialStore.ts`).
- Tests: unit tests for `analytics.ts` (hostname gate, no-op without the script, payload shape)
  and that the main actions call `track` with the right name.
