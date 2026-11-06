import { useRef } from 'react';
import { Trash2, X } from 'lucide-react';
import { useStore } from '@/state/store';
import { Segmented } from '@/components/ui/controls';
import { getTemplate } from '@/templates/registry';
import { allTemplateParams, SHADOW_PARAMS, SHARED_PARAMS } from '@/templates/shared';
import { clamp } from '@/lib/math';
import { interpolate } from '@/engine/keyframes';
import type { KeyframeEasing, Project } from '@/types/project';

const TEXT_KEYS: Record<string, string> = { x: 'X', y: 'Y', size: 'Size', opacity: 'Opacity' };
const LOGO_KEYS: Record<string, string> = { size: 'Size', opacity: 'Opacity' };

export function keyframeLabel(path: string, p: Project): string {
  const parts = path.split('.');
  if (parts[0] === 'shared') {
    const d = [...SHARED_PARAMS, ...SHADOW_PARAMS].find((x) => x.key === parts[1]);
    const isShadow = SHADOW_PARAMS.some((x) => x.key === parts[1]);
    return `${isShadow ? 'Shadow · ' : ''}${d?.label ?? parts[1]}`;
  }
  if (parts[0] === 'tpl') {
    try {
      const def = getTemplate(parts[1]);
      return allTemplateParams(def).find((x) => x.key === parts[2])?.label ?? parts[2];
    } catch {
      return parts[2];
    }
  }
  if (parts[0] === 'text') {
    const i = p.texts.findIndex((t) => t.id === parts[1]);
    const name = i >= 0 ? p.texts[i].content.split('\n')[0].trim().slice(0, 14) || `Text ${i + 1}` : 'Text';
    return `${name} · ${TEXT_KEYS[parts[2]] ?? parts[2]}`;
  }
  if (parts[0] === 'logo') return `Logo · ${LOGO_KEYS[parts[1]] ?? parts[1]}`;
  return path;
}

/** Paths relevant to the current project (other templates' keys are kept but hidden). */
function visiblePaths(p: Project) {
  return Object.keys(p.keyframes).filter((k) => {
    if (!p.keyframes[k]?.length) return false;
    if (k.startsWith('tpl.')) return k.startsWith(`tpl.${p.templateId}.`);
    if (k.startsWith('text.')) return p.texts.some((t) => k.startsWith(`text.${t.id}.`));
    if (k.startsWith('logo.')) return Boolean(p.logo);
    return true;
  });
}

export function useKeyframeCount() {
  return useStore((s) => visiblePaths(s.project).length);
}

function Track({ path }: { path: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const kfs = useStore((s) => s.project.keyframes[path]);
  const duration = useStore((s) => s.project.duration);
  const selected = useStore((s) => s.selectedKey);

  const onDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const st = useStore.getState();
    const k = kfs?.find((x) => x.id === id);
    if (!k) return;
    st.setPlaying(false);
    st.set({ selectedKey: { path, id } });
    st.setTime(k.time * duration);
    const rect = ref.current!.getBoundingClientRect();
    const startX = e.clientX;
    let moved = false;
    const frame = 1 / (duration * 30);
    const move = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - startX) < 3) return;
      if (!moved) {
        moved = true;
        useStore.getState().beginGesture();
      }
      const t = Math.round(clamp((ev.clientX - rect.left) / rect.width, 0, 1) / frame) * frame;
      useStore.getState().edit((d) => {
        const list = d.keyframes[path];
        const key = list?.find((x) => x.id === id);
        if (!key) return;
        key.time = clamp(t, 0, 1);
        list.sort((a, b) => a.time - b.time);
      });
      useStore.getState().setTime(Math.min(t, 0.9999) * duration);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (moved) useStore.getState().endGesture();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div ref={ref} className="relative h-6 flex-1">
      <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
      {kfs?.map((k) => {
        const on = selected?.id === k.id;
        return (
          <button
            key={k.id}
            type="button"
            aria-label={`Keyframe at ${(k.time * duration).toFixed(2)}s`}
            onPointerDown={(e) => onDown(e, k.id)}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize p-1"
            style={{ left: `${k.time * 100}%` }}
          >
            <span
              className={`block h-2.5 w-2.5 rotate-45 rounded-[2px] border ${
                on ? 'border-accent bg-accent' : 'border-fg/70 bg-panel hover:bg-fg/70'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

export function KeyframePanel() {
  const project = useStore((s) => s.project);
  const time = useStore((s) => s.time);
  const selected = useStore((s) => s.selectedKey);
  const set = useStore((s) => s.set);
  const edit = useStore((s) => s.edit);
  const paths = visiblePaths(project);
  const key = selected ? project.keyframes[selected.path]?.find((k) => k.id === selected.id) : undefined;
  const pct = (time / project.duration) * 100;

  return (
    <div className="flex max-h-[200px] shrink-0 flex-col border-t border-line bg-panel">
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-line px-4">
        <span className="section-label">Keyframes</span>
        {key && selected && (
          <>
            <span className="truncate text-[11px] text-muted">
              {keyframeLabel(selected.path, project)} · {(key.time * project.duration).toFixed(2)}s · {key.value.toFixed(2)}
            </span>
            <div className="w-[190px]">
              <Segmented<KeyframeEasing>
                size="sm"
                label="Keyframe easing"
                value={key.easing}
                options={[
                  { value: 'linear', label: 'Linear' },
                  { value: 'smooth', label: 'Smooth' },
                  { value: 'hold', label: 'Hold' },
                ]}
                onChange={(v) =>
                  edit((d) => {
                    const k = d.keyframes[selected.path]?.find((x) => x.id === selected.id);
                    if (k) k.easing = v;
                  })
                }
              />
            </div>
            <button
              type="button"
              aria-label="Delete keyframe"
              title="Delete keyframe (Del)"
              onClick={() => deleteSelectedKey()}
              className="rounded-md p-1 text-muted hover:bg-panel-2 hover:text-red-500"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
        <button
          type="button"
          aria-label="Close keyframes"
          onClick={() => set({ keyframesOpen: false })}
          className="ml-auto rounded-md p-1 text-muted hover:bg-panel-2 hover:text-fg"
        >
          <X size={13} />
        </button>
      </div>
      <div className="scroll-thin overflow-y-auto px-4 py-1.5">
        {paths.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-faint">
            Click the ◇ next to any numeric setting to add a keyframe at the current time.
          </p>
        ) : (
          <div className="relative">
            {paths.map((path) => (
              <div key={path} className="flex items-center gap-3">
                <span className="w-[150px] shrink-0 truncate text-[11px] text-muted">{keyframeLabel(path, project)}</span>
                <div className="relative flex flex-1">
                  <Track path={path} />
                  <div className="pointer-events-none absolute inset-y-0 w-px bg-accent/70" style={{ left: `${pct}%` }} />
                </div>
                <button
                  type="button"
                  aria-label={`Remove animation from ${keyframeLabel(path, project)}`}
                  title="Remove all keyframes"
                  onClick={() =>
                    edit((d) => {
                      const kfs = d.keyframes[path];
                      const st = useStore.getState();
                      if (!kfs?.length) return;
                      // Keep the value at the playhead as the new static value.
                      const v = interpolate(kfs, clamp(st.time / d.duration, 0, 1));
                      delete d.keyframes[path];
                      writeBase(d, path, v);
                    })
                  }
                  className="rounded-md p-1 text-faint hover:bg-panel-2 hover:text-fg"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Writes a static value back to the property addressed by a keyframe path. */
function writeBase(d: Project, path: string, v: number) {
  const parts = path.split('.');
  if (parts[0] === 'shared') d.shared[parts[1]] = v;
  else if (parts[0] === 'tpl') (d.templateParams[parts[1]] ??= {})[parts[2]] = v;
  else if (parts[0] === 'text') {
    const t = d.texts.find((x) => x.id === parts[1]);
    if (t && parts[2] in TEXT_KEYS) (t as unknown as Record<string, number>)[parts[2]] = v;
  } else if (parts[0] === 'logo' && d.logo && parts[1] in LOGO_KEYS) {
    (d.logo as unknown as Record<string, number>)[parts[1]] = v;
  }
}

export function deleteSelectedKey() {
  const st = useStore.getState();
  const sel = st.selectedKey;
  if (!sel) return false;
  st.edit((d) => {
    const kfs = d.keyframes[sel.path];
    if (!kfs) return;
    const k = kfs.find((x) => x.id === sel.id);
    const rest = kfs.filter((x) => x.id !== sel.id);
    if (rest.length) d.keyframes[sel.path] = rest;
    else {
      delete d.keyframes[sel.path];
      if (k) writeBase(d, sel.path, k.value);
    }
  });
  st.set({ selectedKey: null });
  return true;
}
