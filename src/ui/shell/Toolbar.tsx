import { useEffect, useRef } from 'react';
import { setKind } from '../../core/edit';
import type { Automaton, AutomatonKind } from '../../core/model';
import { canMinimize } from '../../core/minimize';
import { canConvert } from '../../core/subset';
import { appStore, useAppStore } from '../../store/store';
import { startMinimize, startSubset } from '../../store/traceActions';
import { exportableSvg, svgToPng } from '../canvas/exportDiagram';
import { fitActive, tidyActive } from '../canvas/useCanvasEditing';
import { downloadBlob, downloadText, slug } from './download';
import {
  ConvertIcon,
  ExportIcon,
  FitIcon,
  MinimizeIcon,
  RedoIcon,
  TidyIcon,
  UndoIcon,
} from './icons';
import { toast } from './toastStore';
import { focusFirstItem, onMenuKeyDown, usePopover } from './usePopover';

const KINDS: AutomatonKind[] = ['DFA', 'NFA'];

interface IconButtonProps {
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  /** Tooltip; defaults to the label. */
  title?: string;
  /** Show the label next to the icon (hidden again on narrow screens). */
  text?: boolean;
}

function IconButton(props: IconButtonProps): React.JSX.Element {
  const { label, icon, disabled, onClick, title, text } = props;
  return (
    <button
      type="button"
      className={text ? 'av-icon-button av-has-text' : 'av-icon-button'}
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {text && <span className="av-button-text">{label}</span>}
    </button>
  );
}

async function exportDiagram(
  automaton: Automaton | undefined,
  format: 'svg' | 'png',
): Promise<void> {
  const text = automaton ? exportableSvg(automaton) : null;
  if (!automaton || text === null) {
    toast('Nothing to export', 'error');
    return;
  }
  const filename = `${slug(automaton.name)}.${format}`;
  if (format === 'svg') {
    downloadText(filename, text, 'image/svg+xml');
    return;
  }
  try {
    downloadBlob(filename, await svgToPng(text));
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Could not export the PNG', 'error');
  }
}

function ExportMenu(props: { automaton?: Automaton; disabled: boolean }): React.JSX.Element {
  const { automaton, disabled } = props;
  const { open, setOpen, rootRef, triggerRef } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) focusFirstItem(menuRef.current);
  }, [open]);
  const item = (format: 'svg' | 'png', label: string): React.JSX.Element => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        void exportDiagram(automaton, format);
      }}
    >
      {label}
    </button>
  );
  return (
    <div className="av-menu-anchor" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="av-icon-button"
        aria-label="Export image"
        title="Export image"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <ExportIcon />
      </button>
      {open && !disabled && (
        <div
          ref={menuRef}
          className="av-popover av-menu av-menu-end"
          role="menu"
          aria-label="Export image"
          onKeyDown={onMenuKeyDown}
        >
          {item('svg', 'Export SVG')}
          {item('png', 'Export PNG')}
        </div>
      )}
    </div>
  );
}

/** Kind switch and the automaton tools on the right of the top bar. */
export function Toolbar(): React.JSX.Element {
  const automaton = useAppStore((s) => s.automata.find((a) => a.id === s.activeId));
  const undoCount = useAppStore((s) =>
    s.activeId ? (s.history[s.activeId]?.past.length ?? 0) : 0,
  );
  const redoCount = useAppStore((s) =>
    s.activeId ? (s.history[s.activeId]?.future.length ?? 0) : 0,
  );
  const tracing = useAppStore((s) => s.trace !== null);
  const none = automaton === undefined;

  const convertReason = automaton ? canConvert(automaton) : null;
  const minimizeReason = automaton ? canMinimize(automaton) : null;

  const changeKind = (kind: AutomatonKind): void => {
    if (!automaton || automaton.kind === kind) return;
    const result = setKind(automaton, kind);
    if (result.ok) {
      appStore.getState().edit(() => result.automaton);
    } else {
      toast(result.issues[0]?.message ?? 'Cannot change the kind', 'error');
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
            disabled={none || tracing}
            onClick={() => changeKind(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="av-tool-group">
        <IconButton
          label="Undo"
          title="Undo (Ctrl+Z)"
          icon={<UndoIcon />}
          disabled={undoCount === 0 || tracing}
          onClick={() => appStore.getState().undo()}
        />
        <IconButton
          label="Redo"
          title="Redo (Ctrl+Y)"
          icon={<RedoIcon />}
          disabled={redoCount === 0 || tracing}
          onClick={() => appStore.getState().redo()}
        />
      </div>
      <div className="av-tool-group">
        <IconButton
          label="Fit"
          title="Fit to view"
          icon={<FitIcon />}
          disabled={none || tracing}
          onClick={fitActive}
        />
        <IconButton
          label="Tidy"
          title="Tidy the layout"
          icon={<TidyIcon />}
          disabled={none || tracing}
          onClick={() => void tidyActive()}
        />
      </div>
      <div className="av-tool-group">
        <IconButton
          label="Convert to DFA"
          text
          title={convertReason ?? 'Convert to DFA, step by step'}
          icon={<ConvertIcon />}
          disabled={none || convertReason !== null}
          onClick={() => void startSubset((m) => toast(m, 'error'))}
        />
        <IconButton
          label="Minimize"
          text
          title={minimizeReason ?? 'Minimize, step by step'}
          icon={<MinimizeIcon />}
          disabled={none || minimizeReason !== null}
          onClick={startMinimize}
        />
      </div>
      <ExportMenu automaton={automaton} disabled={none || tracing} />
    </div>
  );
}
