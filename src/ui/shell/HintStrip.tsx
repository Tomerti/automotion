import { canMinimize } from '../../core/minimize';
import { canConvert } from '../../core/subset';
import { selectedStates, useAppStore } from '../../store/store';
import { startMinimize, startSubset } from '../../store/traceActions';
import { useTutorial } from '../tutorial/tutorialStore';
import { GestureChip } from './GestureChip';
import { pickHint } from './hints';
import type { HintPart } from './hints';
import { dismiss, useLearned } from './hintsLearned';
import { CloseIcon } from './icons';
import { toast } from './toastStore';

function Part({ part }: { part: HintPart }): React.JSX.Element {
  if (part.kind === 'gesture') {
    return (
      <span className="av-hint-part">
        <GestureChip gesture={part.gesture} />
        <span className="av-hint-action">{part.action}</span>
      </span>
    );
  }
  return (
    <span className="av-hint-part">
      <span className="av-hint-action">{part.lead}</span>
      <button
        type="button"
        className="av-hint-go"
        onClick={() =>
          part.run === 'convert' ? void startSubset((m) => toast(m, 'error')) : startMinimize()
        }
      >
        {part.label}
      </button>
    </span>
  );
}

/**
 * The line of tips just above "Test a word" (`hints.ts` picks it): what the selection can do,
 * how to build on, or a walkthrough to try. Hidden during the tutorial, which has its own card;
 * the shell leaves it out while a trace is open.
 */
export function HintStrip(): React.JSX.Element | null {
  const automaton = useAppStore((s) => s.automata.find((a) => a.id === s.activeId));
  const selected = useAppStore((s) => selectedStates(s).length);
  const learned = useLearned();
  const tutorial = useTutorial((s) => s.active);
  if (!automaton || tutorial) return null;
  const hint = pickHint({
    automaton,
    selected,
    learned,
    convertReason: canConvert(automaton),
    minimizeReason: canMinimize(automaton),
  });
  if (!hint) return null;
  return (
    <div className="av-hints" data-testid="hint-strip" data-hint={hint.id} aria-label="Tip">
      {hint.parts.map((p, i) => (
        <span key={p.learn} className="av-hint-item">
          {i > 0 && (
            <span className="av-hint-sep" aria-hidden="true">
              ·
            </span>
          )}
          <Part part={p} />
        </span>
      ))}
      <button
        type="button"
        className="av-hint-close"
        aria-label="Hide this tip"
        title="Got it: hide this tip"
        onClick={() => dismiss(hint.teaches)}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
