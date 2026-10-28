import { useEffect, useRef, useState } from 'react';
import { renameAutomaton } from '../../core/edit';
import { emptyAutomaton } from '../../core/model';
import type { Automaton } from '../../core/model';
import { serialize } from '../../persistence/fileFormat';
import { appStore, useAppStore } from '../../store/store';
import { downloadText, slug } from './download';
import { ChevronIcon } from './icons';
import { importFile } from './importFile';
import { focusFirstItem, onMenuKeyDown, usePopover } from './usePopover';

const MIME = 'application/json';

/** Delete the active automaton after confirming; the canvas is never left without one. */
function deleteActive(current: Automaton): void {
  if (!window.confirm(`Delete "${current.name}"?`)) return;
  const st = appStore.getState();
  st.deleteAutomaton(current.id);
  if (appStore.getState().automata.length === 0) st.addAutomaton(emptyAutomaton('Untitled', 'DFA'));
}

/** Current automaton name (click to rename) and a menu of automata and file actions. */
export function AutomatonSwitcher(): React.JSX.Element {
  const automata = useAppStore((s) => s.automata);
  const activeId = useAppStore((s) => s.activeId);
  const tracing = useAppStore((s) => s.trace !== null);
  const current = automata.find((a) => a.id === activeId);
  const [renaming, setRenaming] = useState(false);
  const { open, setOpen, rootRef, triggerRef } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) focusFirstItem(menuRef.current);
  }, [open]);

  const commit = (name: string): void => {
    setRenaming(false);
    const trimmed = name.trim();
    if (!current || trimmed === '' || trimmed === current.name) return;
    appStore.getState().edit((a) => renameAutomaton(a, trimmed));
  };

  /** A menu item: runs `action` and closes the menu. */
  const item = (label: string, action: () => void, disabled = false): React.JSX.Element => (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        setOpen(false);
        action();
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="av-switcher" ref={rootRef}>
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
      <button
        ref={triggerRef}
        type="button"
        className="av-icon-button av-switcher-toggle"
        aria-label="Automata"
        title="Automata"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <ChevronIcon />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="av-popover av-menu av-switcher-menu"
          role="menu"
          aria-label="Automata"
          onKeyDown={onMenuKeyDown}
        >
          <div role="group" aria-label="Your automata" className="av-menu-list">
            {automata.map((a) => (
              <button
                key={a.id}
                type="button"
                role="menuitemradio"
                aria-checked={a.id === activeId}
                data-testid="automaton-item"
                onClick={() => {
                  setOpen(false);
                  appStore.getState().setActive(a.id);
                }}
              >
                <span className="av-menu-name">{a.name}</span>
                <span className="av-menu-kind">{a.kind}</span>
              </button>
            ))}
          </div>
          <div role="separator" className="av-menu-sep" />
          {item('New DFA', () => appStore.getState().createAutomaton('DFA'))}
          {item('New NFA', () => appStore.getState().createAutomaton('NFA'))}
          <div role="separator" className="av-menu-sep" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              fileInput.current?.click();
            }}
          >
            Import…
          </button>
          {item(
            'Export JSON',
            () => {
              if (current) {
                downloadText(`${slug(current.name)}.automaton.json`, serialize([current]), MIME);
              }
            },
            current === undefined,
          )}
          {automata.length > 1 &&
            item('Export all', () =>
              downloadText('automata.automaton.json', serialize(automata), MIME),
            )}
          <div role="separator" className="av-menu-sep" />
          <button
            type="button"
            role="menuitem"
            className="av-menu-danger"
            disabled={current === undefined}
            onClick={() => {
              setOpen(false);
              if (current) deleteActive(current);
            }}
          >
            Delete
          </button>
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        aria-label="Import file"
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          for (const f of files) void importFile(f);
        }}
      />
    </div>
  );
}
