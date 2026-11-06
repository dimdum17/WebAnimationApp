import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Download, Loader2 } from 'lucide-react';
import { useStore } from '@/state/store';
import { Dialog } from '@/components/ui/Dialog';
import { Button, Field, Segmented } from '@/components/ui/controls';
import {
  ExportCanceled,
  FPS_OPTIONS,
  RESOLUTIONS,
  downloadBlob,
  exportSize,
  exportVideo,
  fileSlug,
  findCodec,
  webCodecsAvailable,
  type ExportFormat,
  type ResolutionId,
} from '@/export/exporter';

type Phase = { kind: 'idle' } | { kind: 'running'; progress: number } | { kind: 'done' } | { kind: 'error'; message: string };

export function ExportDialog() {
  const open = useStore((s) => s.exportOpen);
  const project = useStore((s) => s.project);
  const set = useStore((s) => s.set);
  const [format, setFormat] = useState<ExportFormat>('mp4');
  const [res, setRes] = useState<ResolutionId>('1080');
  const [fps, setFps] = useState<number>(30);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [codecOk, setCodecOk] = useState<boolean | null>(null);
  const abort = useRef<AbortController | null>(null);
  const supported = webCodecsAvailable();
  const short = RESOLUTIONS.find((r) => r.id === res)!.short;
  const size = exportSize(project.aspect, short);
  const running = phase.kind === 'running';

  useEffect(() => {
    if (!open || !supported) return;
    let alive = true;
    setCodecOk(null);
    findCodec(format, size.width, size.height, fps)
      .then((c) => alive && setCodecOk(Boolean(c)))
      .catch(() => alive && setCodecOk(false));
    return () => {
      alive = false;
    };
  }, [open, supported, format, size.width, size.height, fps]);

  useEffect(() => {
    if (open) setPhase({ kind: 'idle' });
  }, [open]);

  const close = () => {
    if (running) return;
    set({ exportOpen: false });
  };

  const start = async () => {
    const ctrl = new AbortController();
    abort.current = ctrl;
    const snapshot = useStore.getState().project;
    set({ exporting: true });
    setPhase({ kind: 'running', progress: 0 });
    try {
      const blob = await exportVideo(snapshot, {
        format,
        short,
        fps,
        signal: ctrl.signal,
        onProgress: (p) => setPhase({ kind: 'running', progress: p }),
      });
      downloadBlob(blob, `${fileSlug(snapshot.name)}-${size.width}x${size.height}.${format}`);
      setPhase({ kind: 'done' });
    } catch (e) {
      if (e instanceof ExportCanceled) setPhase({ kind: 'idle' });
      else setPhase({ kind: 'error', message: e instanceof Error ? e.message : 'Export failed' });
    } finally {
      abort.current = null;
      set({ exporting: false });
    }
  };

  const footer = !supported ? (
    <Button onClick={close}>Close</Button>
  ) : running ? (
    <Button variant="secondary" onClick={() => abort.current?.abort()}>
      Cancel export
    </Button>
  ) : (
    <>
      <Button variant="ghost" onClick={close}>
        {phase.kind === 'done' ? 'Close' : 'Cancel'}
      </Button>
      <Button variant="primary" disabled={codecOk === false} onClick={() => void start()}>
        <Download size={13} /> {phase.kind === 'done' ? 'Export again' : `Export ${format.toUpperCase()}`}
      </Button>
    </>
  );

  return (
    <Dialog open={open} onClose={close} title="Export video" footer={footer} width={400} dismissable={!running}>
      {!supported ? (
        <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs leading-relaxed">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium text-fg">This browser can't export video</p>
            <p className="mt-1 text-muted">
              Export needs the WebCodecs API for frame-accurate encoding. Open Gerakinaja in a recent version of
              Chrome, Edge or Safari to export. Your project is saved and will be here when you return.
            </p>
          </div>
        </div>
      ) : running ? (
        <div className="space-y-3 py-2" aria-live="polite">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-muted">
              <Loader2 size={13} className="animate-spin" /> Rendering frames…
            </span>
            <span className="font-mono tabular-nums">{Math.round(phase.progress * 100)}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(phase.progress * 100)}
            className="h-1.5 overflow-hidden rounded-full bg-panel-3"
          >
            <div className="h-full rounded-full bg-accent transition-[width] duration-150" style={{ width: `${phase.progress * 100}%` }} />
          </div>
          <p className="text-[11px] text-faint">
            {size.width}×{size.height} · {fps} fps · {project.duration}s. Keep this tab open.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Format">
            <Segmented<ExportFormat>
              label="Format"
              value={format}
              options={[
                { value: 'mp4', label: 'MP4' },
                { value: 'webm', label: 'WebM' },
              ]}
              onChange={setFormat}
            />
          </Field>
          <Field label="Resolution" right={<span className="font-mono text-[11px]">{size.width}×{size.height}</span>}>
            <Segmented<ResolutionId>
              label="Resolution"
              value={res}
              options={RESOLUTIONS.map((r) => ({ value: r.id, label: r.label }))}
              onChange={setRes}
            />
          </Field>
          <Field label="Frame rate">
            <Segmented
              label="Frame rate"
              value={String(fps)}
              options={FPS_OPTIONS.map((f) => ({ value: String(f), label: `${f} fps` }))}
              onChange={(v) => setFps(Number(v))}
            />
          </Field>
          <div className="rounded-xl bg-panel-2 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
            {project.duration}s seamless loop · {Math.round(project.duration * fps)} frames · no audio
          </div>
          {codecOk === false && (
            <p className="flex items-start gap-2 text-[11px] text-amber-500">
              <AlertTriangle size={13} className="mt-px shrink-0" />
              This browser can't encode {format.toUpperCase()} at this size. Try another format or a lower resolution.
            </p>
          )}
          {phase.kind === 'done' && (
            <p className="flex items-center gap-2 text-xs text-emerald-500">
              <Check size={14} /> Export complete — your download has started.
            </p>
          )}
          {phase.kind === 'error' && (
            <p className="flex items-start gap-2 text-xs text-red-500">
              <AlertTriangle size={13} className="mt-px shrink-0" /> {phase.message}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
