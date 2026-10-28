import { Thumbnail } from '../canvas/Thumbnail';
import { appStore, useAppStore } from '../../store/store';

/** Thumbnail size in CSS px; keep in sync with .av-history-thumb in App.css. */
const THUMB_WIDTH = 176;
const THUMB_HEIGHT = 92;

/**
 * The left bar: every automaton, most recently edited first, with a picture of its diagram.
 * Clicking one opens it; renaming, deleting and files stay in the top-bar switcher.
 */
export function HistoryBar(): React.JSX.Element {
  const automata = useAppStore((s) => s.automata);
  const activeId = useAppStore((s) => s.activeId);

  return (
    <nav className="av-history" aria-label="History">
      <div className="av-history-new">
        <button type="button" onClick={() => appStore.getState().createAutomaton('DFA')}>
          New DFA
        </button>
        <button type="button" onClick={() => appStore.getState().createAutomaton('NFA')}>
          New NFA
        </button>
      </div>
      <ul className="av-history-list">
        {automata.map((a) => {
          const n = a.states.length;
          return (
            <li key={a.id}>
              <button
                type="button"
                className="av-history-item"
                data-testid="history-item"
                aria-current={a.id === activeId ? 'page' : undefined}
                onClick={() => appStore.getState().setActive(a.id)}
              >
                <span className="av-history-name">{a.name}</span>
                <span className="av-history-thumb">
                  {n === 0 ? (
                    <span className="av-history-empty">Empty</span>
                  ) : (
                    <Thumbnail automaton={a} width={THUMB_WIDTH} height={THUMB_HEIGHT} />
                  )}
                </span>
                <span className="av-history-meta">{`${a.kind} · ${n} ${n === 1 ? 'state' : 'states'}`}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
