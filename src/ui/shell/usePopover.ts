import { useEffect, useRef, useState } from 'react';

/**
 * Open state for a trigger + popover pair. While open, a pointer press outside `rootRef` or
 * Escape closes it; Escape also hands focus back to the trigger and is kept from reaching
 * global shortcuts (the trace player closes on Escape too).
 */
export function usePopover<T extends HTMLElement = HTMLButtonElement>() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      if (!(e.target instanceof Node) || !rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return { open, setOpen, rootRef, triggerRef };
}

const ITEM = '[role^="menuitem"]:not(:disabled)';

/** Focus the first item of a menu that just opened. */
export function focusFirstItem(menu: HTMLElement | null): void {
  menu?.querySelector<HTMLElement>(ITEM)?.focus();
}

/** Arrow-key, Home and End movement between the items of a `role="menu"` element. */
export function onMenuKeyDown(e: React.KeyboardEvent<HTMLElement>): void {
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(ITEM));
  if (items.length === 0) return;
  const at = items.findIndex((el) => el === document.activeElement);
  let next: number;
  if (e.key === 'ArrowDown') next = at < 0 ? 0 : (at + 1) % items.length;
  else if (e.key === 'ArrowUp') next = at <= 0 ? items.length - 1 : at - 1;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = items.length - 1;
  else return;
  e.preventDefault();
  items[next]?.focus();
}
