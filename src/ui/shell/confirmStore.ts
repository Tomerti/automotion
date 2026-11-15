import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

export interface ConfirmRequest {
  /** The question, as the dialog's heading: `Delete "Parity"?`. */
  title: string;
  /** Names of what the action touches, listed under the heading (a long list is cut short). */
  items?: readonly string[];
  /** One more line under the list: `This can’t be undone.` */
  note?: string;
  /** The confirm button's label: `Delete`. */
  confirmLabel: string;
  /** A destructive action: the confirm button is red. */
  danger?: boolean;
}

interface ConfirmState {
  request: (ConfirmRequest & { resolve: (ok: boolean) => void }) | null;
}

/** The open confirm dialog, if any; `ConfirmDialog` (in `App`) renders it. */
export const confirmStore = createStore<ConfirmState>()(() => ({ request: null }));
export const useConfirmRequest = (): ConfirmState['request'] =>
  useStore(confirmStore, (s) => s.request);

/**
 * Ask in the app's own dialog instead of `window.confirm`: resolves true on the confirm button,
 * false on Cancel, Escape or a click outside. A new question cancels one still open.
 */
export function askConfirm(request: ConfirmRequest): Promise<boolean> {
  confirmStore.getState().request?.resolve(false);
  return new Promise((resolve) => confirmStore.setState({ request: { ...request, resolve } }));
}

/** Answer the open question (the dialog's buttons, Escape, the backdrop). */
export function answerConfirm(ok: boolean): void {
  const { request } = confirmStore.getState();
  if (!request) return;
  confirmStore.setState({ request: null });
  request.resolve(ok);
}
