import { useState } from 'react';
import { validate } from '../../core/validate';
import { appStore, useAppStore } from '../../store/store';
import { IssuesList } from '../table/IssuesList';
import { TransitionTable } from '../table/TransitionTable';
import '../table/table.css';

/** Collapsible side panel: transition table plus the issues list for the active automaton. */
export function RightPanel(): React.JSX.Element | null {
  const automaton = useAppStore((s) => s.automata.find((a) => a.id === s.activeId));
  const readOnly = useAppStore((s) => s.trace !== null);
  const [open, setOpen] = useState(true);
  if (!automaton) return null;
  return (
    <>
      <button type="button" aria-pressed={open} onClick={() => setOpen(!open)}>
        Table
      </button>
      {open && (
        <>
          <TransitionTable
            automaton={automaton}
            readOnly={readOnly}
            onEdit={(fn) => appStore.getState().edit(fn)}
          />
          <IssuesList
            issues={validate(automaton)}
            onSelect={(sel) => appStore.getState().select(sel)}
          />
        </>
      )}
    </>
  );
}
