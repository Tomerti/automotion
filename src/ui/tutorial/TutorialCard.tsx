import { Fragment } from 'react';
import { appStore, useAppStore } from '../../store/store';
import { LabelText } from '../LabelText';
import { GestureChip } from '../shell/GestureChip';
import { CloseIcon } from '../shell/icons';
import { COUNTED_STEPS, STEPS } from './steps';
import { TutorialPointer } from './TutorialPointer';
import { endTutorial, tutorialContext, useTutorial } from './tutorialStore';
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

/**
 * The tutorial's coach card, floating in the top-right corner of the canvas: the current step,
 * how to do it, and what's off or what the last step did. It takes no keys and never takes focus,
 * so the canvas shortcuts keep working.
 */
export function TutorialCard(): React.JSX.Element | null {
  const active = useTutorial((s) => s.active);
  const automatonId = useTutorial((s) => s.automatonId);
  const current = useTutorial((s) => s.current);
  const confirmation = useTutorial((s) => s.confirmation);
  // Subscribed so the card follows every edit, run step and switch.
  useAppStore((s) => s.automata);
  useAppStore((s) => s.trace);
  useAppStore((s) => s.stepIndex);
  const openName = useAppStore((s) => s.automata.find((a) => a.id === s.activeId)?.name);
  const step = STEPS[current];
  if (!active || !step) return null;

  const ctx = tutorialContext(appStore.getState(), automatonId);
  const hint = step.hint(ctx);
  const gesture = step.gesture(ctx);
  const last = step.part === 3;

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
          type="button"
          className="av-icon-button"
          aria-label="End tutorial"
          title="End tutorial"
          onClick={endTutorial}
        >
          <CloseIcon />
        </button>
      </header>
      {/* Keyed by step so each new one fades in. */}
      <div key={step.id} className="av-tutorial-body">
        <p className="av-tutorial-text" aria-live="polite">
          <RichText text={step.instruction(ctx)} />
        </p>
        {gesture && <GestureChip gesture={gesture} />}
      </div>
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
      ) : hint ? (
        <p className="av-tutorial-hint">
          <RichText text={hint.text} />
        </p>
      ) : (
        confirmation &&
        !last && (
          <p className="av-tutorial-done" data-testid="tutorial-confirmation">
            ✓ <RichText text={confirmation} />
          </p>
        )
      )}
      {last && (
        <div className="av-tutorial-actions">
          <button type="button" className="av-primary" onClick={endTutorial}>
            Finish
          </button>
        </div>
      )}
      {hint?.kind !== 'elsewhere' && <TutorialPointer selector={step.target(ctx)} />}
    </section>
  );
}
