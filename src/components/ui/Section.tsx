import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { useStore } from '@/state/store';

export function Section({
  id,
  title,
  children,
  collapsible = true,
  right,
  defaultOpen = true,
}: {
  id: string;
  title: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  right?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [flash, setFlash] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const focus = useStore((s) => s.focusSection);

  useEffect(() => {
    if (!focus || focus.id !== id) return;
    setOpen(true);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1100);
    return () => clearTimeout(t);
  }, [focus, id]);

  return (
    <section
      ref={ref}
      data-section={id}
      className={`scroll-mt-2 border-b border-line px-4 py-4 transition-colors duration-700 ${flash ? 'bg-accent/8' : ''}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {right}
          <h3 className="section-label">{title}</h3>
        </div>
        {collapsible && (
          <button
            type="button"
            aria-label={open ? 'Collapse section' : 'Expand section'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="rounded p-0.5 text-muted hover:text-fg"
          >
            <ChevronUp size={14} className={`transition-transform ${open ? '' : 'rotate-180'}`} />
          </button>
        )}
      </div>
      {open && <div className="space-y-3">{children}</div>}
    </section>
  );
}
