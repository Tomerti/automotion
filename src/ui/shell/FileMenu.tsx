import { useRef } from 'react';
import { serialize } from '../../persistence/fileFormat';
import { useAppStore } from '../../store/store';
import { downloadText, slug } from './download';
import { importFile } from './importFile';

const MIME = 'application/json';

export function FileMenu(): React.JSX.Element {
  const automata = useAppStore((s) => s.automata);
  const activeId = useAppStore((s) => s.activeId);
  const input = useRef<HTMLInputElement>(null);
  const current = automata.find((a) => a.id === activeId);

  return (
    <div className="av-file" role="group" aria-label="File">
      <button type="button" onClick={() => input.current?.click()}>
        Import
      </button>
      <input
        ref={input}
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
      <button
        type="button"
        disabled={current === undefined}
        onClick={() => {
          if (current) {
            downloadText(`${slug(current.name)}.automaton.json`, serialize([current]), MIME);
          }
        }}
      >
        Export
      </button>
      <button
        type="button"
        disabled={automata.length === 0}
        onClick={() => downloadText('automata.automaton.json', serialize(automata), MIME)}
      >
        Export all
      </button>
    </div>
  );
}
