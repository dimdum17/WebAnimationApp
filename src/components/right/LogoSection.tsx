import { useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, Trash2, Upload } from 'lucide-react';
import { useStore, removeKeyframesWithPrefix } from '@/state/store';
import { Section } from '@/components/ui/Section';
import { Button, Field, Segmented } from '@/components/ui/controls';
import { NumberControl } from '@/components/ui/NumberControl';
import { importImage, ImportError } from '@/persistence/assets';
import { StorageFullError } from '@/persistence/db';
import { useAsset } from '@/hooks/useAsset';
import type { LogoAnchor } from '@/types/project';

export function LogoSection() {
  const logo = useStore((s) => s.project.logo);
  const edit = useStore((s) => s.edit);
  const toast = useStore((s) => s.toast);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { asset } = useAsset(logo?.assetId);

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const id = await importImage(file, { maxSide: 1600, maxBytes: 5 * 1024 * 1024, keepAlpha: true });
      edit((d) => {
        d.logo = d.logo
          ? { ...d.logo, assetId: id }
          : { assetId: id, visible: true, anchor: 'br', offsetX: 5, offsetY: 5, size: 18, opacity: 100 };
      });
    } catch (e) {
      toast(
        e instanceof StorageFullError
          ? 'Storage full — delete old projects'
          : e instanceof ImportError
            ? `Logo: ${e.message}`
            : 'Could not upload logo',
        'error',
      );
    }
    setBusy(false);
  };

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/svg+xml"
      hidden
      onChange={(e) => {
        void upload(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  return (
    <Section id="logo" title="Logo">
      {fileInput}
      {!logo ? (
        <Button className="w-full" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          Upload logo (max 5 MB)
        </Button>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-panel-2/50 p-1.5">
            <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-[repeating-conic-gradient(var(--panel-3)_0_25%,var(--panel-2)_0_50%)] bg-[length:10px_10px] p-1">
              {asset && <img src={asset.url} alt="Logo" className="max-h-full max-w-full object-contain" />}
            </div>
            <div className="flex-1 text-xs text-muted">{asset ? `${asset.width} × ${asset.height}` : 'Loading…'}</div>
            <button
              type="button"
              aria-label={logo.visible ? 'Hide logo' : 'Show logo'}
              onClick={() => edit((d) => void (d.logo && (d.logo.visible = !d.logo.visible)))}
              className="rounded-md p-1 text-muted hover:bg-panel-3 hover:text-fg"
            >
              {logo.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <button
              type="button"
              aria-label="Remove logo"
              onClick={() =>
                edit((d) => {
                  d.logo = null;
                  removeKeyframesWithPrefix(d, 'logo.');
                })
              }
              className="rounded-md p-1 text-muted hover:bg-panel-3 hover:text-red-500"
            >
              <Trash2 size={13} />
            </button>
          </div>
          <Field label="Position">
            <Segmented<LogoAnchor>
              size="sm"
              label="Logo position"
              value={logo.anchor}
              options={[
                { value: 'tl', label: 'TL', title: 'Top left' },
                { value: 'tr', label: 'TR', title: 'Top right' },
                { value: 'center', label: 'Center' },
                { value: 'bl', label: 'BL', title: 'Bottom left' },
                { value: 'br', label: 'BR', title: 'Bottom right' },
              ]}
              onChange={(v) => edit((d) => void (d.logo && (d.logo.anchor = v)))}
            />
          </Field>
          <NumberControl
            label="Size"
            path="logo.size"
            base={logo.size}
            min={3}
            max={80}
            step={0.5}
            unit="%"
            writeStatic={(d, v) => void (d.logo && (d.logo.size = v))}
          />
          <NumberControl
            label="Opacity"
            path="logo.opacity"
            base={logo.opacity}
            min={0}
            max={100}
            step={1}
            unit="%"
            writeStatic={(d, v) => void (d.logo && (d.logo.opacity = v))}
          />
          <NumberControl
            label="Offset X"
            path="logo.offsetX"
            base={logo.offsetX}
            min={-50}
            max={50}
            step={0.5}
            unit="%"
            keyframeable={false}
            writeStatic={(d, v) => void (d.logo && (d.logo.offsetX = v))}
          />
          <NumberControl
            label="Offset Y"
            path="logo.offsetY"
            base={logo.offsetY}
            min={-50}
            max={50}
            step={0.5}
            unit="%"
            keyframeable={false}
            writeStatic={(d, v) => void (d.logo && (d.logo.offsetY = v))}
          />
          <Button variant="ghost" className="w-full" disabled={busy} onClick={() => input.current?.click()}>
            Replace logo
          </Button>
        </>
      )}
    </Section>
  );
}
