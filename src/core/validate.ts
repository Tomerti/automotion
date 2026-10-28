import { EPSILON } from './model';
import type { Automaton, StateId } from './model';

export interface Issue {
  severity: 'error' | 'warning';
  message: string;
  stateId?: StateId;
  transitionId?: string;
}

export function validate(a: Automaton): Issue[] {
  const issues: Issue[] = [];
  const byId = new Map(a.states.map((s) => [s.id, s]));
  const alphabet = new Set(a.alphabet);

  for (const t of a.transitions) {
    if (!byId.has(t.from) || !byId.has(t.to)) {
      issues.push({
        severity: 'error',
        message: 'Transition points to a missing state',
        transitionId: t.id,
      });
    }
    for (const s of t.symbols) {
      if (s === EPSILON) {
        if (a.kind === 'DFA') {
          issues.push({
            severity: 'error',
            message: "A DFA can't have ε-transitions",
            transitionId: t.id,
          });
        }
      } else if (!alphabet.has(s)) {
        issues.push({
          severity: 'error',
          message: `'${s}' is not in the alphabet`,
          transitionId: t.id,
        });
      }
    }
  }

  if (a.kind === 'DFA') {
    for (const st of a.states) {
      const counts = new Map<string, number>();
      for (const t of a.transitions) {
        if (t.from !== st.id) continue;
        for (const s of new Set(t.symbols)) {
          if (s !== EPSILON) counts.set(s, (counts.get(s) ?? 0) + 1);
        }
      }
      for (const [s, n] of counts) {
        if (n > 1) {
          issues.push({
            severity: 'error',
            message: `${st.label} has more than one transition on '${s}'`,
            stateId: st.id,
          });
        }
      }
    }
  }

  const seenLabels = new Set<string>();
  const reportedLabels = new Set<string>();
  for (const st of a.states) {
    if (seenLabels.has(st.label) && !reportedLabels.has(st.label)) {
      reportedLabels.add(st.label);
      issues.push({
        severity: 'error',
        message: `Two states are named ${st.label}`,
        stateId: st.id,
      });
    }
    seenLabels.add(st.label);
  }

  const starts = a.starts.filter((id) => byId.has(id));
  if (starts.length === 0) {
    issues.push({ severity: 'warning', message: 'No start state' });
  } else {
    const reached = new Set<StateId>(starts);
    const queue: StateId[] = [...starts];
    while (queue.length > 0) {
      const cur = queue.pop();
      for (const t of a.transitions) {
        if (t.from === cur && byId.has(t.to) && !reached.has(t.to)) {
          reached.add(t.to);
          queue.push(t.to);
        }
      }
    }
    for (const st of a.states) {
      if (!reached.has(st.id)) {
        issues.push({
          severity: 'warning',
          message: `${st.label} is unreachable`,
          stateId: st.id,
        });
      }
    }
  }

  if (!a.accepting.some((id) => byId.has(id))) {
    issues.push({ severity: 'warning', message: 'No accepting states' });
  }

  if (a.kind === 'DFA' && a.states.length > 0 && a.alphabet.length > 0) {
    const partial = a.states.some((st) =>
      a.alphabet.some(
        (sym) => !a.transitions.some((t) => t.from === st.id && t.symbols.includes(sym)),
      ),
    );
    if (partial) {
      issues.push({
        severity: 'warning',
        message: 'DFA is partial: a missing transition rejects the word',
      });
    }
  }

  return issues;
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
