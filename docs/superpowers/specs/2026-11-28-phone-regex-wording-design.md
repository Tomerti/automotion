# Phones can build from a regex

## Intent

On a touch-only device the welcome says "✗ Build or edit automata", which stopped being true once
From regex landed: a phone can type a regex, get its minimal DFA and run words on it. The phone
welcome talks visitors out of the one thing they can make, and the empty canvas then shows only
desktop instructions (double-click, `?`, Ctrl+V, drop a file), with the working regex link last and
smallest. Say what a phone can do, and make the empty canvas the place a phone visitor starts.

## Goals, non-goals

- Goal: the phone welcome lists building from a regex as something a phone can do, and names the
  real limit (drawing by hand).
- Goal: on a phone the empty canvas leads with the regex link and says why drawing doesn't work, so
  a returning visitor (who never sees the welcome again) or one who taps Create isn't left
  double-tapping.
- Non-goals: touch drawing (tap to add a state, long-press for transitions); any change to the
  desktop welcome or the desktop empty-canvas hint; checking the Convert/Minimize walkthroughs on
  phones (not verified, so not listed).
- Anti-goal: the welcome turning into a call to action. It stays a notice with one **Got it**
  button (a Build from a regex button there was considered and declined).

## Approaches

1. **`useTouchOnly()` in `Canvas.tsx` (picked).** The hint picks its phone or desktop version from
   the hook the welcome and Controls already use; it follows attaching or detaching a mouse, and
   jsdom tests can fake the media queries.
2. CSS only: render both hints, hide one with `@media (pointer: coarse)`. Both texts would be in
   the DOM (tests would find the hidden one) and phones would be told apart differently here than
   everywhere else.

## Design

### Welcome (`ui/tutorial/WelcomeCard.tsx`, touch-only branch)

Amber callout, laptop icon and placement above the demo unchanged; **Got it** stays the only button.

```
Best on a computer
Drawing automata takes a mouse and keyboard. On a phone you can:
✓ Build one from a regex
✓ Open shared automata
✓ Run words on them
✗ Draw or edit by hand          (muted)
```

- Headline "Open this on a computer" → **Best on a computer**.
- Body "AutoMotion is made for a mouse and keyboard." → **Drawing automata takes a mouse and
  keyboard.** (names what needs a computer instead of implying the whole app does).
- Checklist: regex first (the only item a fresh visitor can do from nothing; link visitors skip the
  welcome), ✗ line **Draw or edit by hand** (a phone can still Tidy, undo, minimize and rename).

### Empty canvas (`ui/canvas/Canvas.tsx`, touch-only)

```
Create a DFA from a regex                  (accent link, opens the regex dialog)
Building by hand needs a computer          (muted, small)
```

- A text link, not a button; wording matches the dialog's title "Create a DFA from a regex". No
  leading "or" (it is the main line here).
- The link's tap area is about 44 px tall (padding, not larger text).
- Same conditions as today: shown when the automaton has no states and no lesson is running;
  `data-testid="canvas-hint"` kept.
- On a computer the hint is unchanged, including "or build one from a regex".

### Tests and docs

- `e2e/phone.spec.ts`: the new checklist and headline; then from the empty canvas tap **Create a DFA
  from a regex**, enter a regex, get the DFA, run a word to a verdict.
- Unit tests: the welcome's phone checklist; the canvas hint's phone and desktop versions.
- README "Phones" line: phones can build an automaton from a regex, open share links and run words;
  drawing by hand needs a mouse and keyboard. PROGRESS.md entry.

## Left to the builder

The exact accent/muted classes and spacing, as long as they match the existing hint's look.
