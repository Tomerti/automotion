import { Fragment, useEffect, useRef, useState } from 'react';
import { appStore, useAppStore } from '../../store/store';
import { LabelText } from '../LabelText';
import { GestureChip } from '../shell/GestureChip';
import { CloseIcon } from '../shell/icons';
import { COUNTED_STEPS, PART_TITLES, STEPS } from './steps';
import { TutorialPointer } from './TutorialPointer';
import { endTutorial, quitTutorial, tutorialContext, useTutorial } from './tutorialStore';
import './tutorial.css';

/** Words in backticks as <code>; the rest with label subscripts. */
function RichText({ text }: { text: string }): React.JSX.Element {
  return (
    <>
      {text
        .split('`')
        .map((part, i) =>
          i % 2 === 1 ? (
            <code key={i}>{part}</code>
          ) : (
            <Fragment key={i}>{part && <LabelText text={part} />}</Fragment>
          ),
        )}
    </>
  );
}

/** A checklist box: empty while the step is to do, a green ✓ once it is done. */
function Box({ done }: { done: boolean }): React.JSX.Element {
  return (
    <span className="av-tutorial-box" data-done={done}>
      {done ? '✓' : ''}
    </span>
  );
}

/**
 * The tutorial's coach card, floating in the top-right corner of the canvas: a checklist that
 * grows as the user goes. Each finished step of the current part is a ticked line saying what it
 * did, earlier parts fold into one ticked line, and the step to do now comes last, with how to
 * do it and what's off. It takes no keys and never takes focus, so the canvas shortcuts keep
 * working.
 */
export function TutorialCard(): React.JSX.Element | null {
  const active = useTutorial((s) => s.active);
  const automatonId = useTutorial((s) => s.automatonId);
  const current = useTutorial((s) => s.current);
  // The tutorial automaton X was clicked for, so a restart never opens on the question.
  const [quitFor, setQuitFor] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Subscribed so the card follows every edit, run step and switch.
  useAppStore((s) => s.automata);
  useAppStore((s) => s.trace);
  useAppStore((s) => s.stepIndex);
  const openName = useAppStore((s) => s.automata.find((a) => a.id === s.activeId)?.name);
  const tutorialName = useAppStore((s) => s.automata.find((a) => a.id === automatonId)?.name);

  const step = STEPS[current];
  const ctx = tutorialContext(appStore.getState(), automatonId);
  const hint = step?.hint(ctx) ?? null;
  const last = step?.part === 3;
  // Finishing behind the question makes it moot: nothing to lose any more.
  const quitting = quitFor !== null && quitFor === automatonId && !last;
  const hintKey = hint === null ? '' : hint.kind === 'text' ? hint.text : hint.kind;

  // A long part scrolls; keep the step to do (and its hint) in view.
  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView?.({ block: 'nearest' });
  }, [current, quitting, hintKey]);

  if (!active || !step) return null;

  const gesture = step.gesture(ctx);
  const keepGoing = (): void => {
    setQuitFor(null);
    closeRef.current?.focus();
  };
  // Every step before the current one in its part is done (`advance` stops at the first that isn't).
  const ticked = STEPS.slice(0, current).filter((s) => s.part === step.part);
  const finishedParts = ([1, 2] as const).filter((p) => p < step.part);

  return (
    <section
      className="av-tutorial"
      aria-label="Tutorial"
      data-testid="tutorial-card"
      data-step={current + 1}
    >
      <header className="av-tutorial-head">
        <span className="av-tutorial-count">
          {last ? 'Tutorial · Done' : `Tutorial · ${current + 1} of ${COUNTED_STEPS}`}
        </span>
        <button
          ref={closeRef}
          type="button"
          className="av-icon-button"
          aria-label="End tutorial"
          title="End tutorial"
          // Nothing to lose once it's done: close it like Finish. Midway, ask first.
          onClick={last ? endTutorial : () => setQuitFor(automatonId)}
        >
          <CloseIcon />
        </button>
      </header>
      {quitting ? (
        <div className="av-tutorial-quit" role="group" aria-label="Quit the tutorial?">
          <p className="av-tutorial-text">
            Quit the tutorial? <b>{tutorialName ?? 'Its automaton'}</b> will be removed from your
            history.
          </p>
          <div className="av-tutorial-actions">
            {/* Focus moves here from X, so screen readers read the question out. */}
            <button type="button" autoFocus onClick={keepGoing}>
              Keep going
            </button>
            <button type="button" className="av-tutorial-quit-button" onClick={quitTutorial}>
              Quit
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* One live region that stays mounted, so screen readers announce each ✓ and each new
              step and hint as it appears. */}
          <ol ref={listRef} className="av-tutorial-steps" aria-live="polite">
            {finishedParts.map((p) => (
              <li key={`part-${p}`} className="av-tutorial-step" data-testid="tutorial-step">
                <Box done />
                <span className="av-tutorial-part-done">{PART_TITLES[p]}</span>
              </li>
            ))}
            {step.part !== 3 && (
              <li className="av-tutorial-part" aria-hidden="true">
                Part {step.part} · {PART_TITLES[step.part]}
              </li>
            )}
            {ticked.map((s) => (
              <li
                key={s.id}
                className="av-tutorial-step"
                data-testid="tutorial-step"
                data-done="true"
              >
                <Box done />
                <span className="av-tutorial-step-text">
                  <RichText text={s.confirmation(ctx)} />
                </span>
              </li>
            ))}
            <li
              key={step.id}
              className="av-tutorial-step av-tutorial-now"
              data-testid="tutorial-step"
              data-done="false"
            >
              {!last && <Box done={false} />}
              <div className="av-tutorial-body">
                <p className="av-tutorial-text">
                  <RichText text={step.instruction(ctx)} />
                </p>
                {gesture && <GestureChip gesture={gesture} />}
                {hint?.kind === 'elsewhere' ? (
                  <p className="av-tutorial-hint">
                    You’re on {openName ?? 'another automaton'}.{' '}
                    <button
                      type="button"
                      className="av-tutorial-link"
                      onClick={() => automatonId && appStore.getState().setActive(automatonId)}
                    >
                      Back to Tutorial
                    </button>
                  </p>
                ) : (
                  hint && (
                    <p className="av-tutorial-hint">
                      <RichText text={hint.text} />
                    </p>
                  )
                )}
              </div>
            </li>
          </ol>
          {last && (
            <div className="av-tutorial-actions">
              <button type="button" className="av-go" onClick={endTutorial}>
                Finish
              </button>
            </div>
          )}
        </>
      )}
      {!quitting && hint?.kind !== 'elsewhere' && <TutorialPointer selector={step.target(ctx)} />}
    </section>
  );
}
