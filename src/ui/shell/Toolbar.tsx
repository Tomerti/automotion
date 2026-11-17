import { useEffect, useRef } from 'react';
import { canEliminate } from '../../core/eliminate';
import type { Automaton } from '../../core/model';
import { canMinimize } from '../../core/minimize';
import { canConvert } from '../../core/subset';
import { appStore, selectedStates, useAppStore } from '../../store/store';
import { startEliminate, startMinimize, startSubset } from '../../store/traceActions';
import { withEmbeddedFont } from '../canvas/embedFont';
import { canCopyImage, copyPng, exportableSvg, svgToPng } from '../canvas/exportDiagram';
import { latexDocument, latexSnippet } from '../canvas/exportLatex';
import { fitActive, tidyActive } from '../canvas/useCanvasEditing';
import { noteLessonAction } from '../tutorial/tutorialStore';
import { copyLink } from './copyLink';
import { downloadBlob, downloadText, slug } from './download';
import { isTypingTarget } from './help';
import {
  ConvertIcon,
  CopyIcon,
  DownloadIcon,
  FitIcon,
  LinkIcon,
  MinimizeIcon,
  RedoIcon,
  RegexIcon,
  ShareIcon,
  TidyIcon,
  UndoIcon,
} from './icons';
import { isCtrlLetter } from './shortcut';
import { toast } from './toastStore';
import { focusFirstItem, onMenuKeyDown, usePopover } from './usePopover';

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
  if (automaton) noteLessonAction(format === 'svg' ? 'export-svg' : 'export-png');
  const raw = automaton ? exportableSvg(automaton) : null;
  if (!automaton || raw === null) {
    toast('Nothing to export', 'error');
    return;
  }
  const text = await withEmbeddedFont(raw);
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

/**
 * Copy the diagram as the same PNG that Export PNG downloads. Must run straight from the click
 * or key press (no await before it), or Safari refuses the clipboard write.
 */
function copyDiagram(automaton: Automaton | undefined): void {
  if (automaton) noteLessonAction('copy-image');
  const text = automaton ? exportableSvg(automaton) : null;
  if (text === null) {
    toast('Nothing to copy', 'error');
    return;
  }
  if (!canCopyImage()) {
    toast('This browser can’t copy images: use Export PNG instead', 'error');
    return;
  }
  copyPng(withEmbeddedFont(text)).then(
    () => toast('Image copied'),
    () => toast('Could not copy the image: use Export PNG instead', 'error'),
  );
}

/** Copy the diagram as a TikZ picture, to paste into a LaTeX document. */
function copyLatex(automaton: Automaton | undefined): void {
  if (automaton) noteLessonAction('copy-latex');
  if (!automaton || automaton.states.length === 0) {
    toast('Nothing to copy', 'error');
    return;
  }
  if (typeof navigator.clipboard?.writeText !== 'function') {
    toast('This browser can’t copy text: use Export LaTeX instead', 'error');
    return;
  }
  navigator.clipboard.writeText(latexSnippet(automaton)).then(
    () => toast('LaTeX copied'),
    () => toast('Could not copy the LaTeX: use Export LaTeX instead', 'error'),
  );
}

function exportLatex(automaton: Automaton | undefined): void {
  if (automaton) noteLessonAction('export-latex');
  if (!automaton || automaton.states.length === 0) {
    toast('Nothing to export', 'error');
    return;
  }
  downloadText(`${slug(automaton.name)}.tex`, latexDocument(automaton), 'application/x-tex');
}

/**
 * Ctrl+C (⌘C) copies the diagram, unless there is text to copy, a field has the keyboard or
 * states are selected (then the canvas copies those).
 */
function useCopyShortcut(automaton: Automaton | undefined, disabled: boolean): void {
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent): void => {
      if (!isCtrlLetter(e, 'c') || e.defaultPrevented || isTypingTarget(e.target)) return;
      if (window.getSelection()?.isCollapsed === false) return;
      if (selectedStates(appStore.getState()).length > 0) return;
      e.preventDefault();
      copyDiagram(automaton);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [automaton, disabled]);
}

function ExportMenu(props: { automaton?: Automaton; disabled: boolean }): React.JSX.Element {
  const { automaton, disabled } = props;
  const { open, setOpen, rootRef, triggerRef } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);
  useCopyShortcut(automaton, disabled);
  useEffect(() => {
    if (open) focusFirstItem(menuRef.current);
  }, [open]);
  /** Share link shows a link icon, copies a clipboard icon, exports (file downloads) a download icon. */
  const item = (
    label: string,
    how: 'link' | 'copy' | 'download',
    run: () => void,
    shortcut?: { aria: string; text: string },
  ): React.JSX.Element => (
    <button
      type="button"
      role="menuitem"
      aria-keyshortcuts={shortcut?.aria}
      onClick={() => {
        setOpen(false);
        run();
      }}
    >
      {how === 'link' ? <LinkIcon /> : how === 'copy' ? <CopyIcon /> : <DownloadIcon />}
      {label}
      {shortcut && (
        <kbd className="av-menu-shortcut" aria-hidden="true">
          {shortcut.text}
        </kbd>
      )}
    </button>
  );
  return (
    <div className="av-menu-anchor" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="av-icon-button"
        aria-label="Share, copy or export"
        title="Share a link, or copy or export the picture or its LaTeX"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <ShareIcon />
      </button>
      {open && !disabled && (
        <div
          ref={menuRef}
          className="av-popover av-menu av-menu-end av-export-menu"
          role="menu"
          aria-label="Share, copy or export"
          onKeyDown={onMenuKeyDown}
        >
          {item('Share link', 'link', () => {
            if (automaton) {
              noteLessonAction('share-link');
              void copyLink(automaton);
            } else toast('Nothing to share', 'error');
          })}
          <div role="separator" className="av-menu-sep" />
          {item('Copy image', 'copy', () => copyDiagram(automaton), {
            aria: 'Control+C',
            text: 'Ctrl+C',
          })}
          {item('Copy LaTeX', 'copy', () => copyLatex(automaton))}
          <div role="separator" className="av-menu-sep" />
          {item('Export SVG', 'download', () => void exportDiagram(automaton, 'svg'))}
          {item('Export PNG', 'download', () => void exportDiagram(automaton, 'png'))}
          {item('Export LaTeX', 'download', () => exportLatex(automaton))}
        </div>
      )}
    </div>
  );
}

/** The automaton tools on the right of the top bar (the DFA/NFA switch floats on the canvas). */
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
  const eliminateReason = automaton ? canEliminate(automaton) : null;

  return (
    <div className="av-toolbar" role="toolbar" aria-label="Automaton tools">
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
          title={convertReason ?? 'Convert to DFA: watch the subset construction, step by step'}
          icon={<ConvertIcon />}
          disabled={none || convertReason !== null}
          onClick={() => void startSubset((m) => toast(m, 'error'))}
        />
        <IconButton
          label="Minimize"
          text
          title={minimizeReason ?? 'Minimize: merge equivalent states, step by step'}
          icon={<MinimizeIcon />}
          disabled={none || minimizeReason !== null}
          onClick={startMinimize}
        />
        <IconButton
          label="To regex"
          text
          title={eliminateReason ?? 'To regex: remove states one at a time, step by step'}
          icon={<RegexIcon />}
          disabled={none || eliminateReason !== null}
          onClick={() => startEliminate((m) => toast(m, 'error'))}
        />
      </div>
      <ExportMenu automaton={automaton} disabled={none || tracing} />
    </div>
  );
}
