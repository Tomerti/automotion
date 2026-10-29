import { AutomatonName } from './AutomatonName';
import { GitHubIcon, HelpIcon, HistoryIcon } from './icons';
import { IssuesChip } from './IssuesChip';
import { ThemeToggle } from './ThemeToggle';
import { Toolbar } from './Toolbar';

/** The logo (docs/brand/): a start arrow into an accepting state with a self-loop, without its tile. */
function BrandMark(): React.JSX.Element {
  return (
    <svg className="av-brand-mark" viewBox="2 2 56 56" aria-hidden="true">
      <path
        className="av-brand-loop"
        d="M34.17 22.08L42.98 11.75A8 8 0 1 1 54.86 22.45L49.64 27.94"
        strokeWidth="4.5"
      />
      <path
        className="av-brand-loop-head"
        d="M45.5 32.29L46.45 24.91L52.83 30.97z"
        strokeWidth="2"
      />
      <circle cx="31" cy="37" r="13" strokeWidth="4.5" />
      <circle cx="31" cy="37" r="5.75" strokeWidth="4" />
      <path d="M4 37H9" strokeWidth="4.5" />
      <path className="av-brand-head" d="M15.5 37L9 42L9 32z" strokeWidth="2" />
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
          <span className="av-brand-name">AutoMotion</span>
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
