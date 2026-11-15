/**
 * Small line icons for the top bar, drawn on a 20-unit grid in the current text colour.
 * Decorative only: every button that shows one carries its own accessible name.
 */

function Icon({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg className="av-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** A panel down the left edge: the history bar. */
export const HistoryIcon = (): React.JSX.Element => (
  <Icon>
    <rect x="3" y="4" width="14" height="12" rx="2" />
    <path d="M8 4v12" />
  </Icon>
);

export const UndoIcon = (): React.JSX.Element => (
  <Icon>
    <path d="M7.5 5 4 8.5 7.5 12" />
    <path d="M4 8.5h8a4.25 4.25 0 0 1 0 8.5H9.5" />
  </Icon>
);

export const RedoIcon = (): React.JSX.Element => (
  <Icon>
    <path d="M12.5 5 16 8.5 12.5 12" />
    <path d="M16 8.5H8a4.25 4.25 0 0 0 0 8.5h2.5" />
  </Icon>
);

export const FitIcon = (): React.JSX.Element => (
  <Icon>
    <path d="M3.5 7.5v-4h4M12.5 3.5h4v4M16.5 12.5v4h-4M7.5 16.5h-4v-4" />
    <circle cx="10" cy="10" r="2.25" />
  </Icon>
);

/** Three states falling into rank: auto-layout. */
export const TidyIcon = (): React.JSX.Element => (
  <Icon>
    <circle cx="4.5" cy="10" r="2" />
    <circle cx="15.5" cy="5" r="2" />
    <circle cx="15.5" cy="15" r="2" />
    <path d="M6.4 9.1 13.6 5.9M6.4 10.9l7.2 3.2" />
  </Icon>
);

/** Two branches joining into one path: many NFA runs become one DFA run. */
export const ConvertIcon = (): React.JSX.Element => (
  <Icon>
    <path d="M3 5c4.5 0 5 5 8.5 5M3 15c4.5 0 5-5 8.5-5h5" />
    <path d="m14 7.5 2.5 2.5-2.5 2.5" />
  </Icon>
);

/** Arrows pressing in on a bar: fewer states. */
export const MinimizeIcon = (): React.JSX.Element => (
  <Icon>
    <path d="M2.5 10h5M5.5 7.5 8 10l-2.5 2.5M17.5 10h-5M14.5 7.5 12 10l2.5 2.5M10 4v12" />
  </Icon>
);

/** An arrow down onto a line: save a file. */
export const DownloadIcon = (): React.JSX.Element => (
  <Icon>
    <path d="M10 3.5v9.5M6.25 9.5 10 13.25l3.75-3.75M4 16.5h12" />
  </Icon>
);

/** Two overlapping sheets: put it on the clipboard. */
export const CopyIcon = (): React.JSX.Element => (
  <Icon>
    <rect x="7" y="7" width="9.5" height="9.5" rx="2" />
    <path d="M13 4.75v-.25a1.5 1.5 0 0 0-1.5-1.5h-6.5A1.5 1.5 0 0 0 3.5 4.5v6.5A1.5 1.5 0 0 0 5 12.5h.25" />
  </Icon>
);

/** Two chain links: a share link. */
export const LinkIcon = (): React.JSX.Element => (
  <Icon>
    <path d="M8.75 11.25a3.25 3.25 0 0 0 4.6 0l2.3-2.3a3.25 3.25 0 0 0-4.6-4.6l-.9.9" />
    <path d="M11.25 8.75a3.25 3.25 0 0 0-4.6 0l-2.3 2.3a3.25 3.25 0 0 0 4.6 4.6l.9-.9" />
  </Icon>
);

/** An arrow up out of a tray: take it out of the app, shared, copied or saved. */
export const ShareIcon = (): React.JSX.Element => (
  <Icon>
    <path d="M10 12.5V3.25M6.5 6.75 10 3.25l3.5 3.5" />
    <path d="M7 9.5H5.5A1.5 1.5 0 0 0 4 11v4a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 16 15v-4a1.5 1.5 0 0 0-1.5-1.5H13" />
  </Icon>
);

/** Half light, half dark: follow the system. */
export const SystemThemeIcon = (): React.JSX.Element => (
  <Icon>
    <circle cx="10" cy="10" r="6.5" />
    <path className="av-icon-fill" d="M10 3.5a6.5 6.5 0 0 1 0 13z" />
  </Icon>
);

export const LightThemeIcon = (): React.JSX.Element => (
  <Icon>
    <circle cx="10" cy="10" r="3.25" />
    <path d="M10 2.5v1.75M10 15.75v1.75M2.5 10h1.75M15.75 10h1.75M4.7 4.7l1.25 1.25M14.05 14.05l1.25 1.25M4.7 15.3l1.25-1.25M14.05 5.95l1.25-1.25" />
  </Icon>
);

export const DarkThemeIcon = (): React.JSX.Element => (
  <Icon>
    <path d="M15.5 12.4A6.5 6.5 0 0 1 7.6 4.5a6.5 6.5 0 1 0 7.9 7.9z" />
  </Icon>
);

/** The chosen item of a menu. */
export const CheckIcon = (): React.JSX.Element => (
  <Icon>
    <path d="m5 10.5 3.25 3.25L15 7" />
  </Icon>
);

export const HelpIcon = (): React.JSX.Element => (
  <Icon>
    <circle cx="10" cy="10" r="7" />
    <path d="M7.9 8a2.2 2.2 0 1 1 3.1 2c-.65.3-1 .8-1 1.45v.3" />
    <circle className="av-icon-fill" cx="10" cy="14.25" r="0.4" />
  </Icon>
);

export const ChevronIcon = (): React.JSX.Element => (
  <Icon>
    <path d="m6 8 4 4 4-4" />
  </Icon>
);

export const WarningIcon = (): React.JSX.Element => (
  <Icon>
    <path d="M10 3.25 17.25 16H2.75z" />
    <path d="M10 8.5v3.25" />
    <circle className="av-icon-fill" cx="10" cy="13.75" r="0.4" />
  </Icon>
);

/** A laptop: the phone welcome's "open this on a computer". */
export const LaptopIcon = (): React.JSX.Element => (
  <Icon>
    <rect x="4" y="4.5" width="12" height="8.5" rx="1.25" />
    <path d="M2 15.5h16" />
  </Icon>
);

export const CloseIcon = (): React.JSX.Element => (
  <Icon>
    <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />
  </Icon>
);

/** The GitHub mark as an outline; path from Lucide (ISC), scaled down from its 24-unit grid. */
export const GitHubIcon = (): React.JSX.Element => (
  <Icon>
    <g transform="translate(10 10) scale(0.75) translate(-12 -12)" strokeWidth={2}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </g>
  </Icon>
);
