import { useMemo } from 'react';
import type { Issue } from '../../core/validate';
import { validate } from '../../core/validate';
import { appStore, useAppStore } from '../../store/store';
import { WarningIcon } from './icons';
import { IssuesList } from './IssuesList';
import { usePopover } from './usePopover';

function IssuesPopover({ issues }: { issues: Issue[] }): React.JSX.Element {
  const { open, setOpen, rootRef, triggerRef } = usePopover();
  const n = issues.length;
  const hasError = issues.some((i) => i.severity === 'error');
  return (
    <div className="av-issues-anchor" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="av-chip"
        data-severity={hasError ? 'error' : 'warning'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <WarningIcon />
        {n === 1 ? '1 issue' : `${n} issues`}
      </button>
      {open && (
        <div className="av-popover av-issues-popover" role="dialog" aria-label="Issues">
          <IssuesList
            issues={issues}
            onSelect={(sel) => {
              appStore.getState().select(sel);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * "⚠ N issues" for the active automaton. Hidden when it has none, while a trace is open, and
 * on a blank automaton (its missing start and accepting states are obvious and only noise).
 */
export function IssuesChip(): React.JSX.Element | null {
  const automaton = useAppStore((s) => s.automata.find((a) => a.id === s.activeId));
  const tracing = useAppStore((s) => s.trace !== null);
  const issues = useMemo(() => (automaton ? validate(automaton) : []), [automaton]);
  if (tracing || issues.length === 0 || automaton?.states.length === 0) return null;
  // Unmounted while there are no issues, so the popover starts closed when some appear.
  return <IssuesPopover issues={issues} />;
}
