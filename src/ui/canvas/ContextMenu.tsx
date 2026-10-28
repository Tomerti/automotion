import { useEffect, useRef } from 'react';
import type { Point } from './geometry';

export interface MenuItem {
  label: string;
  onSelect(): void;
}

export interface ContextMenuProps {
  /** Canvas-relative screen position of the menu's top-left corner. */
  at: Point;
  items: MenuItem[];
  onClose(): void;
}

/** Menu floating over the canvas; closes on Escape or a press outside it. */
export function ContextMenu(props: ContextMenuProps): React.JSX.Element {
  const { at, items, onClose } = props;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent): void => {
      if (!(e.target instanceof Node) || !ref.current?.contains(e.target)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="av-menu" role="menu" style={{ left: at.x, top: at.y }}>
      {items.map((item) => (
        <button key={item.label} type="button" role="menuitem" onClick={item.onSelect}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
