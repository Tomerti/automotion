import { FitIcon } from '../shell/icons';

/** Shown over a walkthrough pane once its view was zoomed or panned. */
export function FitButton({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      className="av-icon-button av-trace-fit"
      data-testid="trace-fit"
      aria-label="Fit"
      title="Fit to view"
      // The pane's drag-to-pan must not start from the button.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
    >
      <FitIcon />
    </button>
  );
}
