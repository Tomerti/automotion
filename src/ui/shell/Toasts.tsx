import { useEffect } from 'react';
import { dismiss, useToasts } from './toastStore';
import type { ToastItem } from './toastStore';

const AUTO_DISMISS_MS = 5000;

function ToastView({ item }: { item: ToastItem }): React.JSX.Element {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(item.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [item.id]);
  return (
    <div className={`av-toast av-toast-${item.kind}`} role="status">
      <span>{item.message}</span>
      <button type="button" aria-label="Close" onClick={() => dismiss(item.id)}>
        ×
      </button>
    </div>
  );
}

export function Toasts(): React.JSX.Element {
  const toasts = useToasts();
  return (
    <div className="av-toasts">
      {toasts.map((t) => (
        <ToastView key={t.id} item={t} />
      ))}
    </div>
  );
}
