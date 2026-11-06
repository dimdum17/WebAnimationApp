import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 380,
  dismissable = true,
}: {
  open: boolean;
  onClose(): void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  dismissable?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose, dismissable]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissable) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ width }}
        className="flex max-h-[90vh] max-w-full flex-col rounded-2xl border border-line-strong bg-panel text-fg shadow-[var(--shadow)] outline-none"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-sm font-semibold">{title}</h2>
          {dismissable && (
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-md p-1 text-muted hover:bg-panel-2 hover:text-fg"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-3">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 pb-4 pt-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
