import type { Issue } from '../../core/validate';
import type { Selection } from '../../store/store';
import { LabelText } from '../LabelText';

interface Props {
  issues: Issue[];
  onSelect: (sel: Selection) => void;
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
            {/* One element: the row is a flex box, where loose text and <sub>s each became
                an item, spaced apart and wrapped on their own. */}
            <LabelText text={issue.message} />
          </button>
        </li>
      ))}
    </ul>
  );
}
