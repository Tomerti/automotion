import { useState } from 'react';
import { renameAutomaton } from '../../core/edit';
import { appStore, useAppStore } from '../../store/store';

export function AutomatonList(): React.JSX.Element {
  const automata = useAppStore((s) => s.automata);
  const activeId = useAppStore((s) => s.activeId);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const commit = (id: string, name: string): void => {
    setRenamingId(null);
    const trimmed = name.trim();
    const current = appStore.getState().automata.find((a) => a.id === id);
    if (trimmed === '' || !current || trimmed === current.name) return;
    appStore.getState().setActive(id);
    appStore.getState().edit((a) => renameAutomaton(a, trimmed));
  };

  const remove = (id: string, name: string): void => {
    if (window.confirm(`Delete "${name}"?`)) appStore.getState().deleteAutomaton(id);
  };

  return (
    <nav className="av-list" aria-label="Automata">
      <div className="av-list-actions">
        <button type="button" onClick={() => appStore.getState().createAutomaton('DFA')}>
          New DFA
        </button>
        <button type="button" onClick={() => appStore.getState().createAutomaton('NFA')}>
          New NFA
        </button>
      </div>
      <ul>
        {automata.map((a) => (
          <li
            key={a.id}
            data-testid="automaton-item"
            aria-current={a.id === activeId ? 'true' : undefined}
            onClick={() => appStore.getState().setActive(a.id)}
          >
            {renamingId === a.id ? (
              <input
                aria-label="Automaton name"
                defaultValue={a.name}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => commit(a.id, e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  else if (e.key === 'Escape') {
                    e.currentTarget.value = a.name;
                    e.currentTarget.blur();
                  }
                }}
              />
            ) : (
              <span className="av-list-name" onDoubleClick={() => setRenamingId(a.id)}>
                {a.name}
              </span>
            )}
            <span className="av-list-kind">{a.kind}</span>
            <button
              type="button"
              aria-label={`Delete ${a.name}`}
              onClick={(e) => {
                e.stopPropagation();
                remove(a.id, a.name);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
