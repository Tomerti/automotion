import type { Issue } from '../../core/validate';
import type { Selection } from '../../store/store';

interface Props {
  issues: Issue[];
  onSelect: (sel: Selection) => void;
}

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
            {issue.message}
          </button>
        </li>
      ))}
    </ul>
  );
}
