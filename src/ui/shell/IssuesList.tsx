import { parseLabel } from '../../core/label';
import type { Issue } from '../../core/validate';
import type { Selection } from '../../store/store';

interface Props {
  issues: Issue[];
  onSelect: (sel: Selection) => void;
}

/** Issue text with state labels' subscripts rendered (`q_1 is unreachable` reads q₁). */
function Message({ text }: { text: string }): React.JSX.Element {
  return (
    <>{parseLabel(text).map((seg, i) => (seg.sub ? <sub key={i}>{seg.text}</sub> : seg.text))}</>
  );
}

/** Validation issues, errors first; clicking one selects the state or transition it is about. */
export function IssuesList({ issues, onSelect }: Props): React.JSX.Element {
  if (issues.length === 0) return <p className="av-issues-empty">No issues</p>;
  const ordered = [
    ...issues.filter((i) => i.severity === 'error'),
    ...issues.filter((i) => i.severity !== 'error'),
  ];
  return (
    <ul className="av-issues" aria-label="Issues">
      {ordered.map((issue, i) => (
        <li key={i}>
          <button
            type="button"
            data-severity={issue.severity}
            onClick={() =>
              onSelect({
                states: issue.stateId ? [issue.stateId] : [],
                transitions: issue.transitionId ? [issue.transitionId] : [],
              })
            }
          >
            <Message text={issue.message} />
          </button>
        </li>
      ))}
    </ul>
  );
}
