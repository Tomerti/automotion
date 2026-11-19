import { useState } from 'react';
import { normalizeSymbolText } from '../../core/edit';
import { canRun, readWord } from '../../core/run';
import { useAppStore } from '../../store/store';
import { startRun } from '../../store/traceActions';
import { playRunSound } from './sound';

/**
 * The floating "test a word" pill at the bottom of the canvas; Enter runs, with a chime, and the
 * player starts playing at once. ε (or `\eps`) is the empty word. The shell keeps it
 * mounted but `hidden` while a trace is open, so the word survives for the next run.
 */
export function RunPanel({ hidden = false }: { hidden?: boolean }): React.JSX.Element {
  const automaton = useAppStore((s) => s.automata.find((a) => a.id === s.activeId));
  const [word, setWord] = useState('');
  const reason = automaton ? canRun(automaton, readWord(word)) : 'Create an automaton first';

  const run = (): void => {
    if (reason !== null) return;
    playRunSound();
    startRun(readWord(word));
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
        title="Type ε (or \eps), or leave it empty, to test the empty word"
        autoComplete="off"
        spellCheck={false}
        value={word}
        onChange={(e) =>
          setWord(normalizeSymbolText(e.target.value, e.target.selectionStart ?? undefined))
        }
        onBlur={() => setWord(normalizeSymbolText(word))}
      />
      <button
        type="submit"
        className="av-go"
        disabled={reason !== null}
        title={reason ?? 'Run the word, step by step'}
      >
        Run
      </button>
    </form>
  );
}
