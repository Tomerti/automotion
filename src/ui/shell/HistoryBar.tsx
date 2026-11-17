import { useEffect, useRef, useState } from 'react';
import { renameAutomaton } from '../../core/edit';
import { emptyAutomaton } from '../../core/model';
import type { Automaton } from '../../core/model';
import { serialize } from '../../persistence/fileFormat';
import { appStore, useAppStore } from '../../store/store';
import { latexDocument, latexDocumentAll } from '../canvas/exportLatex';
import { Thumbnail } from '../canvas/Thumbnail';
import { askConfirm } from './confirmStore';
import { isTypingTarget } from './help';
import { isCtrlLetter } from './shortcut';
import { copyLink } from './copyLink';
import { downloadText, slug } from './download';
import { IMPORT_ACCEPT, importFile } from './importFile';
import { PasteLatexDialog } from './PasteLatexDialog';
import { toast } from './toastStore';
import { focusFirstItem, onMenuKeyDown, usePopover } from './usePopover';

/** Thumbnail size in CSS px; keep in sync with .av-history-thumb in App.css. */
const THUMB_WIDTH = 176;
const THUMB_HEIGHT = 92;
const MIME = 'application/json';
/** Room the ⋯ menu needs below its button before it opens upward instead. */
const MENU_ROOM = 215;

/**
 * Delete `list` after one confirm in the app's dialog; false if the user said no. The canvas is
 * never left without an automaton.
 */
async function deleteWithConfirm(list: readonly Automaton[]): Promise<boolean> {
  const [only] = list;
  if (!only) return false;
  const several = list.length > 1;
  const ok = await askConfirm({
    title: several ? `Delete ${list.length} automata?` : `Delete "${only.name}"?`,
    items: several ? list.map((a) => a.name) : undefined,
    note: 'This can’t be undone.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!ok) return false;
  const st = appStore.getState();
  for (const a of list) st.deleteAutomaton(a.id);
  if (appStore.getState().automata.length === 0) st.addAutomaton(emptyAutomaton('Untitled', 'DFA'));
  return true;
}

/** Ctrl+click (⌘-click) adds an entry to the multi-selection or takes it out. */
function isPickClick(e: React.MouseEvent): boolean {
  return e.ctrlKey || e.metaKey;
}

/** Copy `a` for Ctrl+V to add a copy of it, and say so: nothing on screen changes otherwise. */
function copyWithToast(a: Automaton): void {
  if (appStore.getState().copyAutomaton(a.id)) {
    toast(`Copied "${a.name}": Ctrl+V adds a copy of it`, 'info');
  }
}

function exportOne(a: Automaton): void {
  downloadText(`${slug(a.name)}.automaton.json`, serialize([a]), MIME);
}

/** A standalone LaTeX document (TikZ) that compiles to the diagram. */
function exportLatex(a: Automaton): void {
  downloadText(`${slug(a.name)}.tex`, latexDocument(a), 'application/x-tex');
}

/** Export all: every automaton as one JSON file, or as one LaTeX document (a page each). */
function ExportAllMenu(props: { automata: readonly Automaton[] }): React.JSX.Element {
  const { automata } = props;
  const { open, setOpen, rootRef, triggerRef } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) focusFirstItem(menuRef.current);
  }, [open]);
  const item = (label: string, run: () => void): React.JSX.Element => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        run();
      }}
    >
      {label}
    </button>
  );
  return (
    <div className="av-menu-anchor av-history-export" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Export every automaton as JSON, or as one LaTeX (TikZ) document"
        onClick={() => setOpen(!open)}
      >
        Export all
      </button>
      {open && (
        <div
          ref={menuRef}
          className="av-popover av-menu av-menu-end av-menu-up"
          role="menu"
          aria-label="Export all"
          onKeyDown={onMenuKeyDown}
        >
          {item('Export all as JSON', () =>
            downloadText('automata.automaton.json', serialize([...automata]), MIME),
          )}
          {item('Export all as LaTeX', () => {
            if (!automata.some((a) => a.states.length > 0)) {
              toast('Nothing to export: no automaton has states', 'error');
              return;
            }
            downloadText('automata.tex', latexDocumentAll(automata), 'application/x-tex');
          })}
        </div>
      )}
    </div>
  );
}

/** Import: a file (JSON or LaTeX) through the picker, or LaTeX pasted into a dialog. */
function ImportMenu(props: { onPickFile: () => void; onPasteLatex: () => void }) {
  const { onPickFile, onPasteLatex } = props;
  const { open, setOpen, rootRef, triggerRef } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) focusFirstItem(menuRef.current);
  }, [open]);
  const item = (label: string, hint: string, run: () => void): React.JSX.Element => (
    <button
      type="button"
      role="menuitem"
      title={hint}
      onClick={() => {
        setOpen(false);
        run();
      }}
    >
      {label}
    </button>
  );
  return (
    <div className="av-menu-anchor av-history-export" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Import automata from a JSON or LaTeX (TikZ) file, or paste LaTeX"
        onClick={() => setOpen(!open)}
      >
        Import
      </button>
      {open && (
        <div
          ref={menuRef}
          className="av-popover av-menu av-menu-up"
          role="menu"
          aria-label="Import"
          onKeyDown={onMenuKeyDown}
        >
          {item(
            'Import file…',
            'An AutoMotion JSON file, or a .tex file with LaTeX (TikZ) automata',
            onPickFile,
          )}
          {item(
            'Paste LaTeX…',
            'Paste an automaton’s LaTeX (TikZ) code, from Overleaf, notes, …',
            onPasteLatex,
          )}
        </div>
      )}
    </div>
  );
}

/** The name input that replaces an entry while it is renamed; Enter or blur commits. */
function RenameInput(props: { name: string; onDone: (name: string | null) => void }) {
  const { name, onDone } = props;
  return (
    <input
      className="av-history-rename"
      aria-label="Automaton name"
      defaultValue={name}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => onDone(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') {
          e.stopPropagation();
          e.currentTarget.value = name;
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/**
 * An entry's ⋯ button and its menu. The menu is fixed to the viewport (the list scrolls and
 * would clip it) and opens upward near the bottom of the window.
 */
function EntryMenu(props: {
  automaton: Automaton;
  canRename: boolean;
  onRename: () => void;
}): React.JSX.Element {
  const { automaton, canRename, onRename } = props;
  const { open, setOpen, rootRef, triggerRef } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (open) focusFirstItem(menuRef.current);
  }, [open]);

  const toggle = (): void => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      setPlace(
        r.bottom + MENU_ROOM > window.innerHeight
          ? { left: r.left, bottom: window.innerHeight - r.top + 4 }
          : { left: r.left, top: r.bottom + 4 },
      );
    }
    setOpen(!open);
  };

  const item = (
    label: string,
    action: () => void,
    opts: { disabled?: boolean; danger?: boolean } = {},
  ) => (
    <button
      type="button"
      role="menuitem"
      className={opts.danger ? 'av-menu-danger' : undefined}
      disabled={opts.disabled}
      onClick={() => {
        setOpen(false);
        action();
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="av-history-more" ref={rootRef} data-open={open ? 'true' : undefined}>
      <button
        ref={triggerRef}
        type="button"
        className="av-icon-button"
        aria-label={`More actions for ${automaton.name}`}
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <svg className="av-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle className="av-icon-fill" cx="5" cy="10" r="1.4" />
          <circle className="av-icon-fill" cx="10" cy="10" r="1.4" />
          <circle className="av-icon-fill" cx="15" cy="10" r="1.4" />
        </svg>
      </button>
      {open && (
        <div
          ref={menuRef}
          className="av-popover av-menu av-history-menu"
          role="menu"
          aria-label={`Actions for ${automaton.name}`}
          style={place}
          onKeyDown={onMenuKeyDown}
        >
          {item('Rename', onRename, { disabled: !canRename })}
          {item('Duplicate', () => appStore.getState().duplicateAutomaton(automaton.id))}
          <div role="separator" className="av-menu-sep" />
          {item('Share link', () => void copyLink(automaton))}
          {item('Export JSON', () => exportOne(automaton))}
          {item('Export LaTeX', () => exportLatex(automaton))}
          <div role="separator" className="av-menu-sep" />
          {item('Delete', () => void deleteWithConfirm([automaton]), { danger: true })}
        </div>
      )}
    </div>
  );
}

/**
 * The left bar: every automaton, most recently edited first, with a picture of its diagram.
 * Clicking one opens it; Delete on it, or its ⋯ menu, deletes it after asking; the menu also
 * renames, duplicates and exports (JSON or LaTeX). Ctrl+click (⌘-click) picks several entries,
 * starting from the open one, without opening them, and Ctrl+A on an entry picks them all;
 * Delete then deletes the picked ones after one confirm, and a plain click, Escape or a click
 * outside the list drops the selection. Ctrl+C on one copies it, and Ctrl+V (anywhere) adds a copy. Create sits at the top, Import and Export all at the bottom.
 */
export function HistoryBar(): React.JSX.Element {
  const automata = useAppStore((s) => s.automata);
  const activeId = useAppStore((s) => s.activeId);
  const tracing = useAppStore((s) => s.trace !== null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pastingLatex, setPastingLatex] = useState(false);
  /** The Ctrl+click multi-selection; may hold ids deleted since, so read `picked`. */
  const [pickedIds, setPickedIds] = useState<ReadonlySet<string>>(() => new Set());
  const navRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  /** The pointer is over the bar (clicking its empty space focuses nothing, so hover counts). */
  const hoveredRef = useRef(false);
  const picked = automata.filter((a) => pickedIds.has(a.id));
  const picking = picked.length > 0;

  const clearPicked = (): void => setPickedIds((prev) => (prev.size === 0 ? prev : new Set()));

  /** Add `id` to the selection or take it out; a new selection starts from the open automaton. */
  const togglePicked = (id: string): void => {
    const next = new Set(picking ? picked.map((a) => a.id) : activeId ? [activeId] : []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPickedIds(next);
  };

  // A click anywhere outside the list drops the selection.
  useEffect(() => {
    if (!picking) return;
    const onPointerDown = (e: PointerEvent): void => {
      if (!(e.target instanceof Element)) return;
      // Inside the list, or answering the delete dialog (Cancel keeps the selection).
      if (listRef.current?.contains(e.target) || e.target.closest('.av-modal-backdrop')) return;
      setPickedIds(new Set());
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [picking]);

  // Ctrl+A picks every automaton while the focus is in the bar or the pointer is over it, so it
  // also works after clicking the bar's empty space. The open entry then takes the focus, so
  // Delete deletes them.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!isCtrlLetter(e, 'a') || e.defaultPrevented || isTypingTarget(e.target)) return;
      const nav = navRef.current;
      if (!nav || document.querySelector('[aria-modal="true"]')) return;
      const inside = e.target instanceof Node && nav.contains(e.target);
      if (!inside && !hoveredRef.current) return;
      e.preventDefault();
      setPickedIds(new Set(appStore.getState().automata.map((a) => a.id)));
      if (!inside) {
        const entries = Array.from(
          nav.querySelectorAll<HTMLElement>('button[data-testid="history-item"]'),
        );
        (entries.find((el) => el.getAttribute('aria-current') === 'page') ?? entries[0])?.focus();
      }
    };
    // Capture: before the canvas's window listener, whose Ctrl+A selects every state instead.
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  /** Rename edits the open automaton, so open it first (never while a trace is open). */
  const startRename = (id: string): void => {
    const st = appStore.getState();
    if (st.activeId === id && st.trace) return;
    st.setActive(id);
    setRenamingId(id);
  };

  const finishRename = (name: string | null): void => {
    setRenamingId(null);
    const trimmed = name?.trim() ?? '';
    const current = automata.find((a) => a.id === renamingId);
    if (!current || trimmed === '' || trimmed === current.name) return;
    appStore.getState().edit((a) => renameAutomaton(a, trimmed));
  };

  return (
    <nav
      ref={navRef}
      className="av-history"
      aria-label="History"
      onPointerEnter={() => (hoveredRef.current = true)}
      onPointerLeave={() => (hoveredRef.current = false)}
    >
      <div className="av-history-actions">
        <button
          type="button"
          title="Create a new automaton (switch it between DFA and NFA above the canvas)"
          onClick={() => appStore.getState().createAutomaton()}
        >
          Create
        </button>
      </div>
      <ul ref={listRef} className="av-history-list" data-picking={picking ? 'true' : undefined}>
        {automata.map((a) => {
          const n = a.states.length;
          const current = a.id === activeId;
          const thumb = (
            <span className="av-history-thumb">
              {n === 0 ? (
                <span className="av-history-empty">Empty</span>
              ) : (
                <Thumbnail automaton={a} width={THUMB_WIDTH} height={THUMB_HEIGHT} />
              )}
            </span>
          );
          const meta = (
            <span className="av-history-meta">{`${a.kind} · ${n} ${n === 1 ? 'state' : 'states'}`}</span>
          );
          return (
            <li key={a.id} className="av-history-entry">
              {renamingId === a.id ? (
                <div
                  className="av-history-item"
                  data-testid="history-item"
                  aria-current={current ? 'page' : undefined}
                >
                  <RenameInput name={a.name} onDone={finishRename} />
                  {thumb}
                  {meta}
                </div>
              ) : (
                <button
                  type="button"
                  className="av-history-item"
                  data-testid="history-item"
                  data-selected={pickedIds.has(a.id) ? 'true' : undefined}
                  aria-current={current ? 'page' : undefined}
                  onClick={(e) => {
                    // Safari doesn't focus a clicked button; Delete needs it focused.
                    e.currentTarget.focus();
                    if (isPickClick(e)) {
                      togglePicked(a.id);
                      return;
                    }
                    clearPicked();
                    appStore.getState().setActive(a.id);
                  }}
                  onDoubleClick={(e) => {
                    if (!isPickClick(e)) startRename(a.id);
                  }}
                  onKeyDown={(e) => {
                    // Ctrl+A is the bar's window listener (it also works over the empty space).
                    if (isCtrlLetter(e, 'c')) {
                      // Handled here: the canvas would copy its selection, the toolbar a picture.
                      e.preventDefault();
                      copyWithToast(a);
                    } else if (e.key === 'Delete' || e.key === 'Backspace') {
                      e.preventDefault();
                      void deleteWithConfirm(picking ? picked : [a]).then((ok) => {
                        if (ok) clearPicked();
                      });
                    } else if (e.key === 'Escape' && picking) {
                      // Only drops the selection, not an open trace too.
                      e.stopPropagation();
                      clearPicked();
                    }
                  }}
                >
                  <span className="av-history-name">{a.name}</span>
                  {thumb}
                  {meta}
                </button>
              )}
              <EntryMenu automaton={a} canRename={!tracing} onRename={() => startRename(a.id)} />
            </li>
          );
        })}
      </ul>
      <div className="av-history-actions av-history-files">
        <ImportMenu
          onPickFile={() => fileInput.current?.click()}
          onPasteLatex={() => setPastingLatex(true)}
        />
        <ExportAllMenu automata={automata} />
      </div>
      <input
        ref={fileInput}
        type="file"
        accept={IMPORT_ACCEPT}
        aria-label="Import file"
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          for (const f of files) void importFile(f);
        }}
      />
      {pastingLatex && <PasteLatexDialog onClose={() => setPastingLatex(false)} />}
    </nav>
  );
}
