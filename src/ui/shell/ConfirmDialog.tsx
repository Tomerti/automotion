import { useId, useRef } from 'react';
import { answerConfirm, type ConfirmRequest, useConfirmRequest } from './confirmStore';
import { useModalDialog } from './useModalDialog';

/** Names listed before the rest are summed up as "and N more". */
const MAX_ITEMS = 6;

/** The open `askConfirm` question, in the app's own dialog (rendered once, in `App`). */
export function ConfirmDialog(): React.JSX.Element | null {
  const request = useConfirmRequest();
  return request ? <ConfirmModal key={request.title} request={request} /> : null;
}

function ConfirmModal({ request }: { request: ConfirmRequest }): React.JSX.Element {
  const { title, items = [], note, confirmLabel, danger } = request;
  const dialogRef = useRef<HTMLDivElement>(null);
  const id = useId();
  // The dialog itself takes the focus, not the confirm button: a button focused right after a
  // key press (Delete on a history entry) would show the keyboard focus ring.
  useModalDialog(dialogRef, () => answerConfirm(false));

  const shown = items.length > MAX_ITEMS ? items.slice(0, MAX_ITEMS - 1) : items;
  const rest = items.length - shown.length;

  return (
    <div
      className="av-modal-backdrop"
      data-testid="modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) answerConfirm(false);
      }}
    >
      <div
        ref={dialogRef}
        className="av-modal av-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={items.length > 0 || note ? `${id}-body` : undefined}
        tabIndex={-1}
        // Keys pressed here (Delete, Ctrl+Z, …) are for the dialog, not the app underneath.
        onKeyDown={(e) => {
          e.stopPropagation();
          // Enter confirms, as in a native confirm, while no button has been tabbed to.
          if (e.key === 'Enter' && e.target === e.currentTarget) {
            e.preventDefault();
            answerConfirm(true);
          }
        }}
      >
        <h2 id={`${id}-title`} className="av-confirm-title">
          {title}
        </h2>
        {(items.length > 0 || note) && (
          <div id={`${id}-body`} className="av-confirm-body">
            {items.length > 0 && (
              <ul className="av-confirm-items">
                {shown.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
                {rest > 0 && <li className="av-confirm-more">and {rest} more</li>}
              </ul>
            )}
            {note && <p className="av-confirm-note">{note}</p>}
          </div>
        )}
        <div className="av-confirm-actions">
          <button type="button" data-focus-stop onClick={() => answerConfirm(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? 'av-danger' : 'av-primary'}
            data-focus-stop
            onClick={() => answerConfirm(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
