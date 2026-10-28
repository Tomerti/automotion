import { useState } from 'react';
import {
  addAlphabetSymbol,
  addSymbolToEdge,
  parseSymbolInput,
  removeAlphabetSymbol,
  removeState,
  removeSymbolFromEdge,
  renameAlphabetSymbol,
  renameState,
  setStart,
  toggleAccepting,
} from '../../core/edit';
import { EPSILON } from '../../core/model';
import type { Automaton, StateId, Sym } from '../../core/model';
import { validate } from '../../core/validate';

interface Props {
  automaton: Automaton;
  readOnly: boolean;
  onEdit: (fn: (a: Automaton) => Automaton) => void;
}

/** Validates a symbol typed into a header; returns the symbol or an error message. */
function checkSymbol(
  text: string,
  a: Automaton,
): { ok: true; sym: Sym } | { ok: false; error: string } {
  const parsed = parseSymbolInput(text, a.kind);
  if (!parsed.ok) return parsed;
  const [sym, ...rest] = parsed.symbols;
  if (sym === undefined || rest.length > 0) {
    return { ok: false, error: 'Enter exactly one symbol' };
  }
  if (sym === EPSILON) return { ok: false, error: "The alphabet can't contain ε" };
  if (a.alphabet.includes(sym)) return { ok: false, error: `'${sym}' is already in the alphabet` };
  return { ok: true, sym };
}

interface InlineEditProps {
  label: string;
  value: string;
  disabled: boolean;
  /** Returns an error message to keep editing, or null when accepted. */
  onCommit: (text: string) => string | null;
  ariaLabel: string;
}

/** Text that turns into an input on double-click; Enter commits, Escape cancels. */
function InlineEdit({
  label,
  value,
  disabled,
  onCommit,
  ariaLabel,
}: InlineEditProps): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (draft === null) {
    return (
      <span
        onDoubleClick={() => {
          if (disabled) return;
          setDraft(value);
          setError(null);
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <span className="av-inline-edit">
      <input
        aria-label={ariaLabel}
        value={draft}
        disabled={disabled}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(null);
            setError(null);
          } else if (e.key === 'Enter') {
            const err = onCommit(draft);
            if (err === null) setDraft(null);
            setError(err);
          }
        }}
      />
      {error && <small role="alert">{error}</small>}
    </span>
  );
}

function AddSymbol({ automaton, readOnly, onEdit }: Props): React.JSX.Element {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <input
        aria-label="Add symbol"
        placeholder="+ symbol"
        size={6}
        value={text}
        disabled={readOnly}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          const r = checkSymbol(text, automaton);
          if (!r.ok) {
            setError(r.error);
            return;
          }
          onEdit((a) => addAlphabetSymbol(a, r.sym));
          setText('');
          setError(null);
        }}
      />
      {error && <small role="alert">{error}</small>}
    </span>
  );
}

export function TransitionTable({ automaton, readOnly, onEdit }: Props): React.JSX.Element {
  const a = automaton;
  const isNfa = a.kind === 'NFA';
  const columns: Sym[] = isNfa ? [...a.alphabet, EPSILON] : a.alphabet;
  const errors = validate(a).filter((i) => i.severity === 'error');

  const cellHasError = (stateId: StateId, sym: Sym): boolean =>
    errors.some((i) => {
      if (i.stateId === stateId && i.message.includes(`'${sym}'`)) return true;
      if (i.transitionId === undefined) return false;
      const t = a.transitions.find((x) => x.id === i.transitionId);
      return t !== undefined && t.from === stateId && t.symbols.includes(sym);
    });

  const targetOf = (from: StateId, sym: Sym): StateId | undefined =>
    a.transitions.find((t) => t.from === from && t.symbols.includes(sym))?.to;

  const chooseTarget = (from: StateId, sym: Sym, to: StateId | ''): void => {
    onEdit((cur) => {
      const old = cur.transitions.find((t) => t.from === from && t.symbols.includes(sym))?.to;
      let next = old === undefined ? cur : removeSymbolFromEdge(cur, from, old, sym);
      if (to !== '') next = addSymbolToEdge(next, from, to, sym);
      return next;
    });
  };

  const renameStateInput = (id: StateId, text: string): string | null => {
    const label = text.trim();
    if (label === '') return 'A state needs a name';
    if (a.states.some((s) => s.id !== id && s.label === label)) {
      return `Two states are named ${label}`;
    }
    onEdit((cur) => renameState(cur, id, label));
    return null;
  };

  return (
    <table className="av-table" data-testid="transition-table">
      <thead>
        <tr>
          <th />
          {columns.map((sym) => (
            <th key={sym}>
              {sym === EPSILON ? (
                <span>{sym}</span>
              ) : (
                <>
                  <InlineEdit
                    label={sym}
                    value={sym}
                    disabled={readOnly}
                    ariaLabel={`Rename symbol ${sym}`}
                    onCommit={(text) => {
                      const r = checkSymbol(text, a);
                      if (!r.ok) return r.error;
                      onEdit((cur) => renameAlphabetSymbol(cur, sym, r.sym));
                      return null;
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`Remove symbol ${sym}`}
                    disabled={readOnly}
                    onClick={() => onEdit((cur) => removeAlphabetSymbol(cur, sym))}
                  >
                    ×
                  </button>
                </>
              )}
            </th>
          ))}
          <th>
            <AddSymbol automaton={a} readOnly={readOnly} onEdit={onEdit} />
          </th>
        </tr>
      </thead>
      <tbody>
        {a.states.map((st) => (
          <tr key={st.id}>
            <th scope="row">
              <button
                type="button"
                aria-label={`Set ${st.label} as start`}
                aria-pressed={a.start === st.id}
                disabled={readOnly}
                onClick={() => onEdit((cur) => setStart(cur, st.id))}
              >
                →
              </button>
              <button
                type="button"
                aria-label={`Toggle ${st.label} accepting`}
                aria-pressed={a.accepting.includes(st.id)}
                disabled={readOnly}
                onClick={() => onEdit((cur) => toggleAccepting(cur, st.id))}
              >
                *
              </button>
              <InlineEdit
                label={st.label}
                value={st.label}
                disabled={readOnly}
                ariaLabel={`Rename state ${st.label}`}
                onCommit={(text) => renameStateInput(st.id, text)}
              />
              <button
                type="button"
                aria-label={`Delete ${st.label}`}
                disabled={readOnly}
                onClick={() => onEdit((cur) => removeState(cur, st.id))}
              >
                ×
              </button>
            </th>
            {columns.map((sym) => {
              const name = `δ(${st.label}, ${sym})`;
              const error = cellHasError(st.id, sym) ? 'true' : undefined;
              return (
                <td key={sym} data-error={error}>
                  {isNfa ? (
                    <div role="group" aria-label={name} data-error={error}>
                      {a.states.map((target) => (
                        <label key={target.id}>
                          <input
                            type="checkbox"
                            aria-label={target.label}
                            disabled={readOnly}
                            checked={a.transitions.some(
                              (t) =>
                                t.from === st.id && t.to === target.id && t.symbols.includes(sym),
                            )}
                            onChange={(e) => {
                              const on = e.target.checked;
                              onEdit((cur) =>
                                on
                                  ? addSymbolToEdge(cur, st.id, target.id, sym)
                                  : removeSymbolFromEdge(cur, st.id, target.id, sym),
                              );
                            }}
                          />
                          {target.label}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <select
                      aria-label={name}
                      data-error={error}
                      disabled={readOnly}
                      value={targetOf(st.id, sym) ?? ''}
                      onChange={(e) => chooseTarget(st.id, sym, e.target.value)}
                    >
                      <option value="">—</option>
                      {a.states.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
              );
            })}
            <td />
          </tr>
        ))}
      </tbody>
    </table>
  );
}
