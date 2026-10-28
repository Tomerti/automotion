import { useState } from 'react';
import { renameAutomaton } from '../../core/edit';
import { appStore, useAppStore } from '../../store/store';

/**
 * The open automaton's name; click to rename it in place. Switching, creating, deleting and
 * files live in the history bar.
 */
export function AutomatonName(): React.JSX.Element {
  const current = useAppStore((s) => s.automata.find((a) => a.id === s.activeId));
  const tracing = useAppStore((s) => s.trace !== null);
  const [renaming, setRenaming] = useState(false);

  const commit = (name: string): void => {
    setRenaming(false);
    const trimmed = name.trim();
    if (!current || trimmed === '' || trimmed === current.name) return;
    appStore.getState().edit((a) => renameAutomaton(a, trimmed));
  };

  return (
    <div className="av-switcher">
      {renaming && current ? (
        <input
          className="av-switcher-input"
          aria-label="Automaton name"
          defaultValue={current.name}
          size={Math.max(8, current.name.length + 1)}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            else if (e.key === 'Escape') {
              e.stopPropagation();
              e.currentTarget.value = current.name;
              e.currentTarget.blur();
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="av-switcher-name"
          title={tracing ? undefined : 'Rename'}
          disabled={!current || tracing}
          onClick={() => setRenaming(true)}
        >
          {current?.name ?? 'No automaton'}
        </button>
      )}
    </div>
  );
}
