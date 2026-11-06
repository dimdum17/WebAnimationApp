import { useRef, useState } from 'react';
import { ImagePlus, Loader2, RotateCcw } from 'lucide-react';
import { useStore, removeKeyframesWithPrefix } from '@/state/store';
import { Section } from '@/components/ui/Section';
import { ColorInput, Field, Segmented, Select } from '@/components/ui/controls';
import { NumberControl } from '@/components/ui/NumberControl';
import { Slider } from '@/components/ui/Slider';
import { getTemplate } from '@/templates/registry';
import {
  visibleCommonParams,
  getTemplateValue,
  isKeyframeable,
  SHADOW_PARAMS,
  SHARED_PARAMS,
  sharedPath,
  tplPath,
} from '@/templates/shared';
import type { ParamDef, TemplateDef } from '@/templates/types';
import type { Background, Project } from '@/types/project';
import { importImage, ImportError } from '@/persistence/assets';
import { StorageFullError } from '@/persistence/db';
import { useAsset } from '@/hooks/useAsset';

function writeParam(def: TemplateDef, key: string, v: number | string | boolean) {
  return (d: Project) => {
    (d.templateParams[def.id] ??= {})[key] = v;
  };
}

function ParamControl({ def, p }: { def: TemplateDef; p: ParamDef }) {
  const project = useStore((s) => s.project);
  const edit = useStore((s) => s.edit);
  const value = getTemplateValue(project, def, p.key);
  if (p.type === 'number') {
    return (
      <NumberControl
        label={p.label}
        path={tplPath(def.id, p.key)}
        base={Number(value)}
        min={p.min}
        max={p.max}
        step={p.step}
        unit={p.unit}
        keyframeable={isKeyframeable(p)}
        writeStatic={(d, v) => writeParam(def, p.key, v)(d)}
      />
    );
  }
  if (p.type === 'segmented') {
    return (
      <Field label={p.label}>
        <Segmented
          size="sm"
          wrap={p.options.length > 5}
          label={p.label}
          value={String(value)}
          options={p.options}
          onChange={(v) => edit(writeParam(def, p.key, v))}
        />
      </Field>
    );
  }
  if (p.type === 'select') {
    return (
      <Field label={p.label}>
        <Select label={p.label} value={String(value)} options={p.options} onChange={(v) => edit(writeParam(def, p.key, v))} />
      </Field>
    );
  }
  if (p.type === 'color') {
    return (
      <Field label={p.label} right={<ColorInput label={p.label} value={String(value)} onChange={(v) => edit(writeParam(def, p.key, v))} />} />
    );
  }
  return (
    <label className="flex items-center justify-between text-xs text-muted">
      {p.label}
      <input type="checkbox" checked={Boolean(value)} onChange={(e) => edit(writeParam(def, p.key, e.target.checked))} />
    </label>
  );
}

function BackgroundControls() {
  const bg = useStore((s) => s.project.background);
  const edit = useStore((s) => s.edit);
  const toast = useStore((s) => s.toast);
  const begin = useStore((s) => s.beginGesture);
  const end = useStore((s) => s.endGesture);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { asset } = useAsset(bg.type === 'image' ? bg.assetId : null);
  // Remember colours across type switches within this session.
  const memo = useRef({ color: '#101014', from: '#1b1b2f', to: '#0b0b0f', angle: 160 });
  if (bg.type === 'colour') memo.current.color = bg.color;
  if (bg.type === 'gradient') Object.assign(memo.current, { from: bg.from, to: bg.to, angle: bg.angle });

  const setBg = (b: Background) => edit((d) => void (d.background = b));
  const switchType = (t: Background['type']) => {
    if (t === bg.type) return;
    const m = memo.current;
    if (t === 'colour') setBg({ type: 'colour', color: m.color });
    else if (t === 'gradient') setBg({ type: 'gradient', from: m.from, to: m.to, angle: m.angle });
    else setBg({ type: 'image', assetId: null, dim: 0 });
  };

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const id = await importImage(file);
      edit((d) => {
        if (d.background.type === 'image') d.background.assetId = id;
      });
    } catch (e) {
      toast(
        e instanceof StorageFullError
          ? 'Storage full — delete old projects'
          : e instanceof ImportError
            ? e.message
            : 'Could not upload background',
        'error',
      );
    }
    setBusy(false);
  };

  return (
    <div className="space-y-2.5">
      <Field label="Background">
        <Segmented<Background['type']>
          size="sm"
          label="Background type"
          value={bg.type}
          options={[
            { value: 'colour', label: 'Colour' },
            { value: 'gradient', label: 'Gradient' },
            { value: 'image', label: 'Image' },
          ]}
          onChange={switchType}
        />
      </Field>
      {bg.type === 'colour' && (
        <div className="flex items-center justify-between text-xs text-muted">
          Colour
          <ColorInput label="Background colour" value={bg.color} onChange={(v) => setBg({ ...bg, color: v })} />
        </div>
      )}
      {bg.type === 'gradient' && (
        <>
          <div className="flex items-center justify-between text-xs text-muted">
            From
            <ColorInput label="Gradient start" value={bg.from} onChange={(v) => setBg({ ...bg, from: v })} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted">
            To
            <ColorInput label="Gradient end" value={bg.to} onChange={(v) => setBg({ ...bg, to: v })} />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5" />
            <span className="w-[78px] text-xs text-muted">Angle</span>
            <Slider
              className="flex-1"
              label="Gradient angle"
              value={bg.angle}
              min={0}
              max={360}
              step={1}
              onStart={begin}
              onEnd={end}
              onChange={(v) => setBg({ ...bg, angle: v })}
            />
            <span className="w-[46px] text-right font-mono text-[11px] text-muted">{Math.round(bg.angle)}°</span>
          </div>
        </>
      )}
      {bg.type === 'image' && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex h-20 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-panel-2/60 text-xs text-muted hover:text-fg"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : asset ? (
              <img src={asset.url} alt="Background" className="h-full w-full object-cover" />
            ) : (
              <span className="flex items-center gap-1.5">
                <ImagePlus size={14} /> Choose background image
              </span>
            )}
          </button>
          <div className="flex items-center gap-2">
            <span className="w-5" />
            <span className="w-[78px] text-xs text-muted">Dim</span>
            <Slider
              className="flex-1"
              label="Background dim"
              value={bg.dim}
              min={0}
              max={90}
              step={1}
              onStart={begin}
              onEnd={end}
              onChange={(v) => setBg({ ...bg, dim: v })}
            />
            <span className="w-[46px] text-right font-mono text-[11px] text-muted">{Math.round(bg.dim)}%</span>
          </div>
        </>
      )}
    </div>
  );
}

export function TemplateSection() {
  const templateId = useStore((s) => s.project.templateId);
  const shared = useStore((s) => s.project.shared);
  const edit = useStore((s) => s.edit);
  const def = getTemplate(templateId);
  const common = visibleCommonParams(def);
  const numbers = [...common, ...def.params].filter((p) => p.type === 'number');
  const choices = [...common, ...def.params].filter((p) => p.type !== 'number');

  const reset = () =>
    edit((d) => {
      delete d.templateParams[def.id];
      removeKeyframesWithPrefix(d, `tpl.${def.id}.`);
      for (const p of SHARED_PARAMS) {
        d.shared[p.key] = p.default;
        delete d.keyframes[sharedPath(p.key)];
      }
    });

  return (
    <Section
      id="template"
      title={def.name}
      right={
        <button
          type="button"
          onClick={reset}
          title="Reset template settings"
          aria-label="Reset template settings"
          className="rounded-md p-1 text-faint hover:bg-panel-2 hover:text-fg"
        >
          <RotateCcw size={12} />
        </button>
      }
    >
      <BackgroundControls />
      <div className="space-y-2.5 pt-1">
        {SHARED_PARAMS.map((p) => (
          <NumberControl
            key={p.key}
            label={p.label}
            path={sharedPath(p.key)}
            base={Number(shared[p.key] ?? p.default)}
            min={p.min}
            max={p.max}
            step={p.step}
            unit={p.unit}
            writeStatic={(d, v) => void (d.shared[p.key] = v)}
          />
        ))}
        {numbers.map((p) => (
          <ParamControl key={p.key} def={def} p={p} />
        ))}
      </div>
      <div className="space-y-3 pt-1">
        {choices.map((p) => (
          <ParamControl key={p.key} def={def} p={p} />
        ))}
      </div>
    </Section>
  );
}

export function ShadowSection() {
  const shared = useStore((s) => s.project.shared);
  const edit = useStore((s) => s.edit);
  const on = Boolean(shared.shadowEnabled);
  return (
    <Section
      id="shadow"
      title="Shadow"
      right={
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Enable shadow"
          onClick={() => edit((d) => void (d.shared.shadowEnabled = !on))}
          className={`relative h-[18px] w-8 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-panel-3'}`}
        >
          <span
            className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-[left] ${on ? 'left-[16px]' : 'left-[2px]'}`}
          />
        </button>
      }
    >
      {SHADOW_PARAMS.map((p) => (
        <NumberControl
          key={p.key}
          label={p.label}
          path={sharedPath(p.key)}
          base={Number(shared[p.key] ?? p.default)}
          min={p.min}
          max={p.max}
          step={p.step}
          unit={p.unit}
          disabled={!on}
          writeStatic={(d, v) => void (d.shared[p.key] = v)}
        />
      ))}
      <div className={`flex items-center justify-between pl-7 text-xs text-muted ${on ? '' : 'opacity-45'}`}>
        Colour
        <ColorInput
          label="Shadow colour"
          disabled={!on}
          value={String(shared.shadowColor ?? '#000000')}
          onChange={(v) => edit((d) => void (d.shared.shadowColor = v))}
        />
      </div>
    </Section>
  );
}
