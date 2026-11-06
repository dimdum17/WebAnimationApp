import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { useStore } from '@/state/store';

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className="flex items-center gap-2 rounded-full border border-line-strong bg-panel-2 px-4 py-2 text-xs text-fg shadow-[var(--shadow)]"
        >
          {t.tone === 'error' ? (
            <AlertCircle size={14} className="text-red-500" />
          ) : t.tone === 'success' ? (
            <CheckCircle2 size={14} className="text-emerald-500" />
          ) : (
            <Info size={14} className="text-accent" />
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}
