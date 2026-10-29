import { setKind } from '../../core/edit';
import { startStates } from '../../core/model';
import type { AutomatonKind } from '../../core/model';
import { appStore, useAppStore } from '../../store/store';
import { toast } from './toastStore';

const KINDS: AutomatonKind[] = ['DFA', 'NFA'];

/**
 * The floating DFA/NFA switch at the top of the canvas, the counterpart of the run pill at the
 * bottom. It is only there while the editable canvas is: not without an automaton, nor while a
 * trace is open (edits are locked then anyway).
 */
export function KindPill(): React.JSX.Element | null {
  const automaton = useAppStore((s) => s.automata.find((a) => a.id === s.activeId));
  const tracing = useAppStore((s) => s.trace !== null);
  if (!automaton || tracing) return null;

  /** An NFA with several start states only becomes a DFA through Convert to DFA. */
  const manyStarts = automaton.kind === 'NFA' && startStates(automaton).length > 1;

  const changeKind = (kind: AutomatonKind): void => {
    if (automaton.kind === kind) return;
    const result = setKind(automaton, kind);
    if (result.ok) {
      appStore.getState().edit(() => result.automaton);
    } else {
      toast(result.issues[0]?.message ?? 'Cannot change the kind', 'error');
    }
  };

  return (
    <div className="av-kindpill" role="group" aria-label="Kind" data-testid="kind-pill">
      {KINDS.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={automaton.kind === k}
          disabled={k === 'DFA' && manyStarts}
          title={
            k === 'DFA' && manyStarts
              ? "An NFA with several start states can't be a DFA: use Convert to DFA"
              : undefined
          }
          onClick={() => changeKind(k)}
        >
          {k}
        </button>
      ))}
    </div>
  );
}
