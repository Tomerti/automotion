import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { appStore, useAppStore } from '../../store/store';
import { LabelText } from '../LabelText';
import { CloseIcon } from '../shell/icons';
import { GoalPicture } from './GoalPicture';
import { COUNTED_STEPS, PART_DONE, PART_GOALS, PART_TITLES, STEPS } from './steps';
import { TutorialPointer } from './TutorialPointer';
import { finishTutorial, quitTutorial, tutorialContext, useTutorial } from './tutorialStore';
import './tutorial.css';

/** The parts with steps (the closing card is not one). */
const PARTS = Object.keys(PART_TITLES).length;

/** A `word` to type, a [Key] to press, or a «state». */
const MARKUP = /(`[^`]*`|\[[^\]\s]+\]|«[^»]*»)/;

/** Punctuation (or a possessive) that belongs with the key or state before it. */
const TRAILING = /^(’s|[.,:;!?]+)/;

/**
 * Words in backticks as <code>, keys in brackets as <kbd> (a digit key in the symbol font, like
 * the words), states in guillemets as a small state with its label; the rest with label
 * subscripts.
 */
function RichText({ text }: { text: string }): React.JSX.Element {
  const parts = text.split(MARKUP);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) {
          // Punctuation right after a key or a state went with it (below).
          const rest = i > 0 ? part.replace(TRAILING, '') : part;
          return <Fragment key={i}>{rest && <LabelText text={rest} />}</Fragment>;
        }
        // A key cap or state is an inline block, which a line may break after: keep the
        // punctuation after it on its line, so a "." never wraps on its own.
        const trailing = TRAILING.exec(parts[i + 1] ?? '')?.[0];
        const markup = <Markup part={part} />;
        return trailing ? (
          <span key={i} className="av-tutorial-nowrap">
            {markup}
            {trailing}
          </span>
        ) : (
          <Fragment key={i}>{markup}</Fragment>
        );
      })}
    </>
  );
}

function Markup({ part }: { part: string }): React.JSX.Element {
  const inner = part.slice(1, -1);
  if (part.startsWith('`')) return <code>{inner}</code>;
  if (part.startsWith('«')) {
    return (
      <span className="av-tutorial-state">
        <LabelText text={inner} />
      </span>
    );
  }
  return <kbd data-symbol={/^\d$/.test(inner) || undefined}>{inner}</kbd>;
}

/**
 * What the part builds, at the top of the card: a picture of the finished automaton, the goal in
 * a few words, and words it accepts (✓) and rejects (✗).
 */
function GoalRow({ part }: { part: 1 | 2 | 3 }): React.JSX.Element {
  const goal = PART_GOALS[part];
  return (
    <div className="av-tutorial-goal" data-testid="tutorial-goal" data-part={part}>
      <GoalPicture automaton={goal.automaton} description={goal.description} />
      <div className="av-tutorial-goal-body">
        <p className="av-tutorial-goal-text">
          <b>Part {part} goal:</b> <RichText text={goal.text} />
        </p>
        <ul className="av-tutorial-examples" aria-label="For example">
          {goal.examples.map((e) => (
            <li key={e.word} data-accepted={e.accepted}>
              <code>{e.word}</code>
              <span
                className="av-tutorial-mark"
                role="img"
                aria-label={e.accepted ? 'accepted' : 'rejected'}
              >
                {e.accepted ? '✓' : '✗'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * The hand-over between the parts, while the run that ended `part` is still open: what it
 * achieved, and what the next part is.
 */
function PartDone({ part }: { part: 1 | 2 }): React.JSX.Element {
  const next = (part + 1) as 2 | 3;
  return (
    <div className="av-tutorial-part-done" data-testid="tutorial-part-done" role="status">
      <p className="av-tutorial-part-done-title">
        <span className="av-tutorial-part-done-mark" aria-hidden="true">
          ✓
        </span>
        Part {part} complete!
      </p>
      <p className="av-tutorial-part-done-text">{PART_DONE[part]}</p>
      <p className="av-tutorial-next">
        Next:{' '}
        <b>
          Part {next} · {PART_TITLES[next]}
        </b>
      </p>
    </div>
  );
}

/** One segment per step, filled up to the step on the card; a wider gap between the parts. */
function ProgressBar({ done }: { done: number }): React.JSX.Element {
  const counted = STEPS.slice(0, COUNTED_STEPS);
  return (
    <div
      className="av-tutorial-progress"
      data-testid="tutorial-progress"
      role="progressbar"
      aria-label="Tutorial progress"
      aria-valuemin={0}
      aria-valuemax={COUNTED_STEPS}
      aria-valuenow={done}
    >
      {counted.map((s, i) => (
        <span
          key={s.id}
          data-done={i < done}
          data-part-start={i > 0 && counted[i - 1]!.part !== s.part ? true : undefined}
        />
      ))}
    </div>
  );
}

/**
 * Tells the canvas area how far down the card reaches (`--av-tutorial-pad`), so trace views
 * start below it: the run's tape and verdict sit where the card is otherwise.
 */
function useCardPad(ref: React.RefObject<HTMLElement | null>, shown: boolean): void {
  const measure = useCallback((): void => {
    const el = ref.current;
    const area = el?.parentElement;
    if (!el || !area) return;
    area.style.setProperty('--av-tutorial-pad', `${el.offsetTop + el.offsetHeight + 4}px`);
  }, [ref]);
  // After every commit, before the paint, so a run opening under the card starts below it.
  useLayoutEffect(measure);
  useEffect(() => {
    const el = ref.current;
    const area = el?.parentElement;
    if (!shown || !el || !area) return;
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      area.style.removeProperty('--av-tutorial-pad');
    };
  }, [ref, measure, shown]);
}

/**
 * The tutorial's coach card, floating at the top centre of the canvas under the DFA/NFA switch:
 * the part's goal, a progress bar, and the one step to do now, in a short sentence with a few
 * words of why under it, and what's off. It takes no keys and never takes focus, so the canvas
 * shortcuts keep working.
 */
export function TutorialCard(): React.JSX.Element | null {
  const active = useTutorial((s) => s.active);
  const automatonId = useTutorial((s) => s.automatonId);
  const derivedId = useTutorial((s) => s.derivedId);
  const current = useTutorial((s) => s.current);
  // The tutorial automaton X was clicked for, so a restart never opens on the question.
  const [quitFor, setQuitFor] = useState<string | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Subscribed so the card follows every edit, run step and switch.
  useAppStore((s) => s.automata);
  useAppStore((s) => s.trace);
  useAppStore((s) => s.stepIndex);
  useAppStore((s) => s.selection);
  const openName = useAppStore((s) => s.automata.find((a) => a.id === s.activeId)?.name);
  const tutorialName = useAppStore((s) => s.automata.find((a) => a.id === automatonId)?.name);
  useCardPad(cardRef, active && STEPS[current] !== undefined);

  if (!active) return null;
  const step = STEPS[current];
  if (!step) return null;
  const ctx = tutorialContext(appStore.getState(), automatonId, derivedId);
  const hint = step.hint(ctx);
  const last = step.part === 4;
  // Finishing behind the question makes it moot: nothing to lose any more.
  const quitting = quitFor !== null && quitFor === automatonId && !last;

  const keepGoing = (): void => {
    setQuitFor(null);
    closeRef.current?.focus();
  };
  // The run that ended a part is still open: the card says so until Esc starts the next part.
  const partDone = hint?.kind === 'part-done' ? hint.part : null;
  const shownPart = partDone ?? step.part;
  const why = partDone ? null : step.why(ctx);
  // Steps are numbered within their part.
  const inPart = STEPS.filter((s) => s.part === step.part);
  const stepInPart = inPart.indexOf(step) + 1;

  return (
    <section
      ref={cardRef}
      className="av-tutorial"
      aria-label="Tutorial"
      data-testid="tutorial-card"
      data-step={current + 1}
    >
      <header className="av-tutorial-head">
        <span className="av-tutorial-count">
          {last
            ? 'Tutorial · Done'
            : partDone
              ? `Part ${partDone} of ${PARTS} · Complete`
              : `Part ${step.part} of ${PARTS} · Step ${stepInPart} of ${inPart.length}`}
        </span>
        <button
          ref={closeRef}
          type="button"
          className="av-icon-button"
          aria-label="End tutorial"
          title="End tutorial"
          // Nothing to lose once it's done: close it like Finish. Midway, ask first.
          onClick={last ? finishTutorial : () => setQuitFor(automatonId)}
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
          {partDone ? (
            <PartDone part={partDone} />
          ) : (
            // Keyed by part, so each new part's goal comes in with its own entrance.
            shownPart !== 4 && <GoalRow key={shownPart} part={shownPart} />
          )}
          {!last && <ProgressBar done={current} />}
          {/* One live region that stays mounted, so screen readers announce each new step and
              hint as it appears. */}
          <div className="av-tutorial-now" data-testid="tutorial-step" aria-live="polite">
            {hint?.kind === 'first' && (
              <p className="av-tutorial-first" data-testid="tutorial-first">
                <RichText text={hint.text} />
              </p>
            )}
            <p
              key={partDone ? `${step.id}-part-done` : step.id}
              className="av-tutorial-text"
              data-testid="tutorial-instruction"
            >
              <RichText
                text={
                  partDone ? `Press [Esc] to start part ${partDone + 1}.` : step.instruction(ctx)
                }
              />
            </p>
            {why && (
              <p className="av-tutorial-why" data-testid="tutorial-why">
                <RichText text={why} />
              </p>
            )}
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
              hint?.kind === 'text' && (
                <p className="av-tutorial-hint">
                  <RichText text={hint.text} />
                </p>
              )
            )}
          </div>
          {last && (
            <div className="av-tutorial-actions">
              <button type="button" className="av-go" onClick={finishTutorial}>
                Finish
              </button>
            </div>
          )}
        </>
      )}
      {!quitting && hint?.kind !== 'elsewhere' && (
        <TutorialPointer selector={partDone ? null : step.target(ctx)} />
      )}
    </section>
  );
}
