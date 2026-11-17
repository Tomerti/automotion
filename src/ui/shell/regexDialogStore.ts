import { create } from 'zustand';

interface RegexDialogState {
  open: boolean;
}

/** Whether the "Build an NFA from a regex" dialog is open; `RegexDialog` (in `App`) renders it. */
export const useRegexDialog = create<RegexDialogState>()(() => ({ open: false }));

export function openRegexDialog(): void {
  useRegexDialog.setState({ open: true });
}

export function closeRegexDialog(): void {
  useRegexDialog.setState({ open: false });
}
