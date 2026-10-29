import { AutomatonName } from './AutomatonName';
import { GitHubIcon, HelpIcon, HistoryIcon } from './icons';
import { IssuesChip } from './IssuesChip';
import { ThemeToggle } from './ThemeToggle';
import { Toolbar } from './Toolbar';

/** A start arrow into an accepting state: the smallest complete automaton. */
function BrandMark(): React.JSX.Element {
  return (
    <svg className="av-brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M2 16h7" />
      <path className="av-brand-head" d="M7 12.5l3.5 3.5-3.5 3.5z" />
      <circle className="av-brand-state" cx="20" cy="16" r="9" />
      <circle cx="20" cy="16" r="5.75" />
    </svg>
  );
}

/** The one strip of chrome: history toggle, brand, the current automaton, its tools, theme, help and GitHub. */
export function TopBar(props: {
  onHelp: () => void;
  historyOpen: boolean;
  onToggleHistory: () => void;
}): React.JSX.Element {
  const { onHelp, historyOpen, onToggleHistory } = props;
  return (
    <header className="av-topbar">
      <div className="av-topbar-start">
        <button
          type="button"
          className="av-icon-button"
          aria-label="History"
          title={historyOpen ? 'Hide history' : 'Show history'}
          aria-expanded={historyOpen}
          onClick={onToggleHistory}
        >
          <HistoryIcon />
        </button>
        <h1 className="av-brand">
          <BrandMark />
          <span className="av-brand-name">Automaton Vis</span>
        </h1>
        <span className="av-topbar-slash" aria-hidden="true">
          /
        </span>
        <AutomatonName />
        <IssuesChip />
      </div>
      <div className="av-topbar-end">
        <Toolbar />
        <div className="av-tool-group">
          <ThemeToggle />
          <button
            type="button"
            className="av-icon-button"
            aria-label="Controls"
            title="Controls (?)"
            onClick={onHelp}
          >
            <HelpIcon />
          </button>
          <a
            className="av-icon-button"
            href="https://github.com/Tomerti"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
          >
            <GitHubIcon />
          </a>
        </div>
      </div>
    </header>
  );
}
