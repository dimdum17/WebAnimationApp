import { Eye, EyeOff, Image as ImageIcon, Layers, LayoutGrid, Paintbrush, Stamp, Type } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '@/state/store';
import { templatesByCategory } from '@/templates/registry';
import { startHoverPreview, useTemplateThumb } from '@/engine/thumbnails';
import type { TemplateDef } from '@/templates/types';

function TemplateCard({ def, active }: { def: TemplateDef; active: boolean }) {
  const thumb = useTemplateThumb(def.id);
  const edit = useStore((s) => s.edit);
  const [hover, setHover] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!hover || !canvasRef.current) return;
    return startHoverPreview(def.id, canvasRef.current);
  }, [hover, def.id]);
  return (
    <button
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      type="button"
      aria-pressed={active}
      onClick={() => !active && edit((d) => void (d.templateId = def.id))}
      className="group flex flex-col gap-1.5 text-left"
    >
      <span
        className={`relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-panel-2 transition ${
          active
            ? 'ring-2 ring-accent ring-offset-2 ring-offset-panel'
            : 'ring-1 ring-line group-hover:ring-line-strong'
        }`}
      >
        {hover && (
          <canvas ref={canvasRef} className="absolute inset-0 z-10 h-full w-full object-cover" />
        )}
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <span className="absolute inset-0 animate-pulse bg-panel-3/50" />
        )}
      </span>
      <span className={`truncate px-0.5 text-[11px] ${active ? 'font-medium text-fg' : 'text-muted group-hover:text-fg'}`}>
        {def.name}
      </span>
    </button>
  );
}

function TemplatesTab() {
  const current = useStore((s) => s.project.templateId);
  return (
    <div className="space-y-5 p-4">
      {templatesByCategory().map((g) => (
        <section key={g.id} aria-label={g.label}>
          <h3 className="section-label mb-2.5">{g.label}</h3>
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-3">
            {g.templates.map((t) => (
              <TemplateCard key={t.id} def={t} active={t.id === current} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LayerRow({
  icon,
  name,
  detail,
  section,
  visible,
  onToggle,
}: {
  icon: ReactNode;
  name: string;
  detail?: string;
  section: string;
  visible?: boolean;
  onToggle?(): void;
}) {
  const set = useStore((s) => s.set);
  return (
    <div className={`group flex items-center gap-1 rounded-lg hover:bg-panel-2 ${visible === false ? 'opacity-50' : ''}`}>
      <button
        type="button"
        onClick={() => set({ focusSection: { id: section, nonce: Date.now() } })}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2 text-left"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-panel-2 text-muted group-hover:bg-panel-3">
          {icon}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-xs font-medium">{name}</span>
          {detail && <span className="block truncate text-[11px] text-faint">{detail}</span>}
        </span>
      </button>
      {onToggle && (
        <button
          type="button"
          aria-label={visible ? `Hide ${name}` : `Show ${name}`}
          onClick={onToggle}
          className="mr-1 rounded-md p-1.5 text-faint hover:bg-panel-3 hover:text-fg"
        >
          {visible ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
      )}
    </div>
  );
}

function LayersTab() {
  const p = useStore((s) => s.project);
  const edit = useStore((s) => s.edit);
  const filled = p.slots.filter((s) => s.assetId).length;
  return (
    <div className="space-y-0.5 p-3">
      <p className="section-label px-2 pb-2 pt-1">Top to bottom</p>
      {[...p.texts].reverse().map((t) => (
        <LayerRow
          key={t.id}
          icon={<Type size={13} />}
          name={t.content.split('\n')[0].trim() || 'Text'}
          detail={`${t.font} · ${t.weight}`}
          section="text"
          visible={t.visible}
          onToggle={() =>
            edit((d) => {
              const x = d.texts.find((y) => y.id === t.id);
              if (x) x.visible = !x.visible;
            })
          }
        />
      ))}
      {p.logo && (
        <LayerRow
          icon={<Stamp size={13} />}
          name="Logo"
          section="logo"
          visible={p.logo.visible}
          onToggle={() => edit((d) => void (d.logo && (d.logo.visible = !d.logo.visible)))}
        />
      )}
      <LayerRow
        icon={<ImageIcon size={13} />}
        name="Media"
        detail={`${filled}/${p.slots.length} images`}
        section="media"
        visible={p.mediaVisible}
        onToggle={() => edit((d) => void (d.mediaVisible = !d.mediaVisible))}
      />
      <LayerRow
        icon={<Paintbrush size={13} />}
        name="Background"
        detail={p.background.type === 'colour' ? 'Solid colour' : p.background.type === 'gradient' ? 'Gradient' : 'Image'}
        section="template"
      />
      {p.texts.length === 0 && (
        <button
          type="button"
          onClick={() => useStore.getState().set({ focusSection: { id: 'text', nonce: Date.now() } })}
          className="mt-3 w-full rounded-lg border border-dashed border-line px-3 py-3 text-[11px] text-faint hover:border-line-strong hover:text-muted"
        >
          No text layers yet — add one in Text settings
        </button>
      )}
    </div>
  );
}

export function LeftPanel() {
  const tab = useStore((s) => s.leftTab);
  const set = useStore((s) => s.set);
  const tabs = [
    { id: 'templates' as const, label: 'Templates', icon: <LayoutGrid size={13} /> },
    { id: 'layers' as const, label: 'Layers', icon: <Layers size={13} /> },
  ];
  return (
    <aside aria-label="Templates and layers" className="flex w-[268px] shrink-0 flex-col border-r border-line bg-panel">
      <div role="tablist" className="flex gap-1 border-b border-line p-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => set({ leftTab: t.id })}
            className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition ${
              tab === t.id ? 'bg-panel-2 text-fg' : 'text-muted hover:text-fg'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="scroll-thin flex-1 overflow-y-auto">
        {tab === 'templates' ? <TemplatesTab /> : <LayersTab />}
      </div>
    </aside>
  );
}
