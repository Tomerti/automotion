import { useState } from 'react';
import { canRun } from '../../core/run';
import { useAppStore } from '../../store/store';
import { startRun } from '../../store/traceActions';

/**
 * The floating "test a word" pill at the bottom of the canvas; Enter runs. The shell keeps it
 * mounted but `hidden` while a trace is open, so the word survives for the next run.
 */
export function RunPanel({ hidden = false }: { hidden?: boolean }): React.JSX.Element {
  const automaton = useAppStore((s) => s.automata.find((a) => a.id === s.activeId));
  const [word, setWord] = useState('');
  const reason = automaton ? canRun(automaton, word) : 'Create an automaton first';

  const run = (): void => {
    if (reason === null) startRun(word);
  };

  return (
    <form
      className="av-runpill"
      hidden={hidden}
      onSubmit={(e) => {
        e.preventDefault();
        run();
      }}
    >
      <input
        aria-label="Word"
        placeholder="Test a word…"
        title="Leave empty to test ε, the empty word"
        autoComplete="off"
        spellCheck={false}
        value={word}
        onChange={(e) => setWord(e.target.value)}
      />
      <button
        type="submit"
        className="av-primary"
        disabled={reason !== null}
        title={reason ?? 'Run the word, step by step'}
      >
        Run
      </button>
    </form>
  );
}
