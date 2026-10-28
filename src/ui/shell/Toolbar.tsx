import { useState } from 'react';
import { setKind } from '../../core/edit';
import type { AutomatonKind } from '../../core/model';
import { canMinimize } from '../../core/minimize';
import { canConvert } from '../../core/subset';
import { appStore, useAppStore } from '../../store/store';
import { fitActive, tidyActive } from '../canvas/useCanvasEditing';

const KINDS: AutomatonKind[] = ['DFA', 'NFA'];

export function Toolbar(): React.JSX.Element {
  const automata = useAppStore((s) => s.automata);
  const activeId = useAppStore((s) => s.activeId);
  const undoCount = useAppStore((s) =>
    s.activeId ? (s.history[s.activeId]?.past.length ?? 0) : 0,
  );
  const redoCount = useAppStore((s) =>
    s.activeId ? (s.history[s.activeId]?.future.length ?? 0) : 0,
  );
  const tracing = useAppStore((s) => s.trace !== null);
  const [error, setError] = useState<string | null>(null);
  const automaton = automata.find((a) => a.id === activeId);
  const none = automaton === undefined;

  const convertReason = automaton ? canConvert(automaton) : null;
  const minimizeReason = automaton ? canMinimize(automaton) : null;

  const changeKind = (kind: AutomatonKind): void => {
    if (!automaton) return;
    setError(null);
    if (automaton.kind === kind) return;
    const result = setKind(automaton, kind);
    if (result.ok) {
      setError(null);
      appStore.getState().edit(() => result.automaton);
    } else {
      setError(result.issues[0]?.message ?? 'Cannot change the kind');
    }
  };

  return (
    <div className="av-toolbar" role="toolbar" aria-label="Automaton tools">
      <div className="av-kind" role="group" aria-label="Kind">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={automaton?.kind === k}
            disabled={none}
            onClick={() => changeKind(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={undoCount === 0}
        onClick={() => {
          setError(null);
          appStore.getState().undo();
        }}
      >
        Undo
      </button>
      <button
        type="button"
        disabled={redoCount === 0}
        onClick={() => {
          setError(null);
          appStore.getState().redo();
        }}
      >
        Redo
      </button>
      <button type="button" disabled={none} onClick={fitActive}>
        Fit
      </button>
      <button type="button" disabled={none || tracing} onClick={() => void tidyActive()}>
        Tidy
      </button>
      <button
        type="button"
        disabled={none || convertReason !== null}
        title={convertReason ?? undefined}
      >
        Convert to DFA
      </button>
      <button
        type="button"
        disabled={none || minimizeReason !== null}
        title={minimizeReason ?? undefined}
      >
        Minimize
      </button>
      {error !== null && <span role="alert">{error}</span>}
    </div>
  );
}
