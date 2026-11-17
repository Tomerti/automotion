# Lessons leave no automata behind (2026-11-17)

## Why

Lessons clutter the history: every lesson but Basics keeps its ready-made copy on Finish, plus
whatever was saved from its walkthrough (Convert, Minimize), so going through the lessons leaves
about eight entries the user never made. A reload midway leaves a lesson's automaton for good
(half-built, for Basics), since lesson progress isn't saved but its automata are. Separately,
Basics opens on an empty, editable DFA, so the empty canvas's hint shows, and its "or build one
from a regex" fills the Tutorial automaton in place and breaks the lesson.

## Goals

- Finishing any lesson removes all of its automata, as Quit already does (and as Basics' Finish
  already does). The finish popup then shows on whatever was open before, or a blank Untitled.
- Lesson automata are never autosaved: after a reload midway, they are simply gone.
- The empty-canvas hint (double-click, paste LaTeX, drop a file, build from a regex) doesn't show
  while the open automaton is a lesson's. Basics' card says what to do.

## Non-goals

- Resuming a lesson after a reload.
- Changing Ctrl+V LaTeX or file drop during a lesson: they add a new automaton, which the lesson
  already handles (its card hides until its own automaton is open again).
- Hiding lesson automata from the history bar while the lesson runs (the user needs the entry to
  get back after switching away).

## Approaches

1. **Chosen: a `lessonIds` list in the app store.** The tutorial sets it alongside `readOnly`
   (every automaton the running lesson owns, Basics' editable one included; cleared when the lesson
   ends). Autosave filters them out; the canvas hides its hint when the active automaton is listed.
   One field fixes both bugs, no file-format change.
2. Tag lesson automata in the saved data and drop them on load: needs a format bump, leaves the
   junk in storage until the next load, and the hint needs its own check.
3. Persist lesson progress so a reload resumes: fixes the leak by making lessons durable, far
   larger than the problem.

## Design

- `store.ts`: `lessonIds: string[]` (never saved) and `setLessonIds(ids)`, like `readOnly`.
- `tutorialStore.ts`: wherever `owned` is set (`startLesson`, `setOwned`) also set `lessonIds`;
  `endLesson` clears it. `finishLesson` removes `owned` for every lesson, not only Basics (the
  `noun === 'tutorial'` branch goes, and with it the fit of the kept automata).
- `useAutosave.ts`: saves `automata` without `lessonIds` (the save is debounced, so a lesson's new
  automaton is already listed by the time it is written).
- Loading an empty list gives a blank Untitled (a first visit straight into Basics saves `[]`).
- `Canvas.tsx`: the hint shows only when the automaton is empty and not in `lessonIds`.
- Texts: the CLAUDE.md lesson notes ("Finish keeps them"), the store doc comments, the finish
  popup / quit wording if it says automata stay, README if it mentions it, and `PROGRESS.md`.
- Tests: tutorialStore (Finish removes a lesson's copy and its saved walkthrough result),
  autosave (lesson automata not written; empty list → blank on load), Canvas (no hint on a lesson's
  empty automaton), and the e2e lesson specs that expect automata to stay after Finish.

## Left to the builder

Exact names, where the empty-list case is handled (load or save), and test placement.
