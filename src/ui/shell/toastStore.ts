import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

export type ToastKind = 'info' | 'error';
export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}
interface ToastState {
  toasts: ToastItem[];
}

export const toastStore = createStore<ToastState>()(() => ({ toasts: [] }));
export const useToasts = (): ToastItem[] => useStore(toastStore, (s) => s.toasts);

let nextId = 1;

export function toast(message: string, kind: ToastKind = 'info'): void {
  toastStore.setState((s) => ({ toasts: [...s.toasts, { id: nextId++, message, kind }] }));
}

export function dismiss(id: number): void {
  toastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}
