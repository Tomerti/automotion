import { useState } from 'react';
import { canRun } from '../../core/run';
import { useAppStore } from '../../store/store';
import { startRun } from '../../store/traceActions';

export function RunPanel(): React.JSX.Element {
  const automaton = useAppStore((s) => s.automata.find((a) => a.id === s.activeId));
  const [word, setWord] = useState('');
  const reason = automaton ? canRun(automaton, word) : 'Create an automaton first';

  const run = (): void => {
    if (reason === null) startRun(word);
  };

  return (
    <div className="av-runpanel">
      <input
        aria-label="Word"
        placeholder="Word (empty = ε)"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') run();
        }}
      />
      <button type="button" disabled={reason !== null} title={reason ?? undefined} onClick={run}>
        Run
      </button>
    </div>
  );
}
