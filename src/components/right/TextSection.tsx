import { useState } from 'react';
import { ChevronDown, Eye, EyeOff, Trash2, Plus } from 'lucide-react';
import { useStore, removeKeyframesWithPrefix } from '@/state/store';
import { Section } from '@/components/ui/Section';
import { Button, ColorInput, Field, Segmented, Select } from '@/components/ui/controls';
import { NumberControl } from '@/components/ui/NumberControl';
import { createTextLayer } from '@/state/defaults';
import { FONTS, type TextLayer, type Project } from '@/types/project';

function editText(id: string, fn: (t: TextLayer) => void) {
  return (d: Project) => {
    const t = d.texts.find((x) => x.id === id);
    if (t) fn(t);
  };
}

function TextCard({ layer, index }: { layer: TextLayer; index: number }) {
  const [open, setOpen] = useState(true);
  const edit = useStore((s) => s.edit);
  const begin = useStore((s) => s.beginGesture);
  const end = useStore((s) => s.endGesture);
  const set = <K extends keyof TextLayer>(k: K, v: TextLayer[K]) => edit(editText(layer.id, (t) => (t[k] = v)));
  const title = layer.content.split('\n')[0].trim() || `Text ${index + 1}`;

  return (
    <div className="rounded-xl border border-line bg-panel-2/50">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-medium"
        >
          <ChevronDown size={13} className={`shrink-0 text-muted transition-transform ${open ? '' : '-rotate-90'}`} />
          <span className="truncate">{title}</span>
        </button>
        <button
          type="button"
          aria-label={layer.visible ? 'Hide text' : 'Show text'}
          onClick={() => set('visible', !layer.visible)}
          className="rounded-md p-1 text-muted hover:bg-panel-3 hover:text-fg"
        >
          {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
        <button
          type="button"
          aria-label="Delete text"
          onClick={() =>
            edit((d) => {
              d.texts = d.texts.filter((t) => t.id !== layer.id);
              removeKeyframesWithPrefix(d, `text.${layer.id}.`);
            })
          }
          className="rounded-md p-1 text-muted hover:bg-panel-3 hover:text-red-500"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-line px-2.5 pb-3 pt-2.5">
          <textarea
            aria-label="Text content"
            value={layer.content}
            rows={2}
            onFocus={begin}
            onBlur={end}
            onChange={(e) => set('content', e.target.value)}
            className="w-full resize-y rounded-lg border border-line bg-panel px-2.5 py-2 text-xs text-fg outline-none focus-visible:border-accent"
          />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Select
              label="Font"
              value={layer.font}
              options={FONTS.map((f) => ({ value: f, label: f }))}
              onChange={(v) => set('font', v)}
            />
            <ColorInput label="Text colour" value={layer.color} onChange={(v) => set('color', v)} />
          </div>
          <Segmented
            size="sm"
            label="Weight"
            value={String(layer.weight)}
            options={[
              { value: '400', label: 'Regular' },
              { value: '500', label: 'Medium' },
              { value: '600', label: 'Semibold' },
              { value: '700', label: 'Bold' },
            ]}
            onChange={(v) => set('weight', Number(v) as TextLayer['weight'])}
          />
          <Segmented
            size="sm"
            label="Alignment"
            value={layer.align}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' },
            ]}
            onChange={(v) => set('align', v)}
          />
          <NumberControl
            label="Size"
            path={`text.${layer.id}.size`}
            base={layer.size}
            min={1}
            max={30}
            step={0.1}
            unit="%"
            writeStatic={(d, v) => editText(layer.id, (t) => (t.size = v))(d)}
          />
          <NumberControl
            label="Position X"
            path={`text.${layer.id}.x`}
            base={layer.x}
            min={-20}
            max={120}
            step={0.5}
            unit="%"
            writeStatic={(d, v) => editText(layer.id, (t) => (t.x = v))(d)}
          />
          <NumberControl
            label="Position Y"
            path={`text.${layer.id}.y`}
            base={layer.y}
            min={-20}
            max={120}
            step={0.5}
            unit="%"
            writeStatic={(d, v) => editText(layer.id, (t) => (t.y = v))(d)}
          />
          <NumberControl
            label="Opacity"
            path={`text.${layer.id}.opacity`}
            base={layer.opacity}
            min={0}
            max={100}
            step={1}
            unit="%"
            writeStatic={(d, v) => editText(layer.id, (t) => (t.opacity = v))(d)}
          />
          <NumberControl
            label="Tracking"
            path={`text.${layer.id}.letterSpacing`}
            base={layer.letterSpacing}
            min={-15}
            max={50}
            step={0.5}
            keyframeable={false}
            writeStatic={(d, v) => editText(layer.id, (t) => (t.letterSpacing = v))(d)}
          />
          <Field label="Animation in">
            <Select
              label="Animation in"
              value={layer.animIn}
              options={[
                { value: 'none', label: 'None' },
                { value: 'fade', label: 'Fade' },
                { value: 'slide-up', label: 'Slide up' },
                { value: 'scale', label: 'Scale' },
              ]}
              onChange={(v) => set('animIn', v)}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

export function TextSection() {
  const texts = useStore((s) => s.project.texts);
  const edit = useStore((s) => s.edit);
  return (
    <Section id="text" title="Text">
      {texts.map((t, i) => (
        <TextCard key={t.id} layer={t} index={i} />
      ))}
      <Button
        className="w-full"
        onClick={() =>
          edit((d) => {
            const layer = createTextLayer();
            if (d.texts.length) layer.y = Math.min(90, 14 + d.texts.length * 10);
            d.texts.push(layer);
          })
        }
      >
        <Plus size={13} /> Add text
      </Button>
    </Section>
  );
}
