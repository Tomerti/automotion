import { setKind } from '../../core/edit';
import type { AutomatonKind } from '../../core/model';
import { canMinimize } from '../../core/minimize';
import { canConvert } from '../../core/subset';
import { appStore, useAppStore } from '../../store/store';
import { startMinimize, startSubset } from '../../store/traceActions';
import { exportableSvg, svgToPng } from '../canvas/exportDiagram';
import { fitActive, tidyActive } from '../canvas/useCanvasEditing';
import { downloadBlob, downloadText, slug } from './download';
import { FileMenu } from './FileMenu';
import { toast } from './toastStore';

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
  const automaton = automata.find((a) => a.id === activeId);
  const none = automaton === undefined;

  const convertReason = automaton ? canConvert(automaton) : null;
  const minimizeReason = automaton ? canMinimize(automaton) : null;

  const changeKind = (kind: AutomatonKind): void => {
    if (!automaton) return;
    if (automaton.kind === kind) return;
    const result = setKind(automaton, kind);
    if (result.ok) {
      appStore.getState().edit(() => result.automaton);
    } else {
      toast(result.issues[0]?.message ?? 'Cannot change the kind', 'error');
    }
  };

  const exportDiagram = async (format: 'svg' | 'png'): Promise<void> => {
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
      <div className="av-toolbar-group">
        <button
          type="button"
          disabled={undoCount === 0 || tracing}
          onClick={() => {
            appStore.getState().undo();
          }}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={redoCount === 0 || tracing}
          onClick={() => {
            appStore.getState().redo();
          }}
        >
          Redo
        </button>
      </div>
      <div className="av-toolbar-group">
        <button type="button" disabled={none || tracing} onClick={fitActive}>
          Fit
        </button>
        <button type="button" disabled={none || tracing} onClick={() => void tidyActive()}>
          Tidy
        </button>
      </div>
      <div className="av-toolbar-group">
        <button
          type="button"
          disabled={none || convertReason !== null}
          title={convertReason ?? undefined}
          onClick={() => void startSubset()}
        >
          Convert to DFA
        </button>
        <button
          type="button"
          disabled={none || minimizeReason !== null}
          onClick={startMinimize}
          title={minimizeReason ?? undefined}
        >
          Minimize
        </button>
      </div>
      <div className="av-toolbar-group">
        <button type="button" disabled={none || tracing} onClick={() => void exportDiagram('svg')}>
          Export SVG
        </button>
        <button type="button" disabled={none || tracing} onClick={() => void exportDiagram('png')}>
          Export PNG
        </button>
      </div>
      <FileMenu />
    </div>
  );
}
