import { useEffect, useRef, useState } from 'react';
import { Engine } from '@/engine/renderer';
import { setPreviewEngine } from '@/engine/preview';
import { useStore, setAnimatable } from '@/state/store';
import { subscribeAssets } from '@/persistence/assets';
import { aspectRatio } from '@/types/project';
import type { Bounds } from '@/engine/overlays';
import { resolveText } from '@/engine/overlays';
import { clamp, mod } from '@/lib/math';
import { addFilesToSlots } from '@/state/media';
import { RotateCcw } from 'lucide-react';

const MAX_PREVIEW_SHORT = 1080;

export function Stage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const dirty = useRef(true);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [bounds, setBounds] = useState<[string, Bounds][]>([]);
  const [lost, setLost] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const aspect = useStore((s) => s.project.aspect);
  const texts = useStore((s) => s.project.texts);

  // Fit frame into available area.
  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const availW = Math.max(50, r.width - 64);
      const availH = Math.max(50, r.height - 88);
      const a = aspectRatio(aspect);
      let w = availW;
      let h = w / a;
      if (h > availH) {
        h = availH;
        w = h * a;
      }
      setBox({ w: Math.floor(w), h: Math.floor(h) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  // Engine lifecycle.
  useEffect(() => {
    const engine = new Engine(2, 2, canvasRef.current!);
    engineRef.current = engine;
    setPreviewEngine(engine);
    const unsubStore = useStore.subscribe((s, prev) => {
      if (s.project !== prev.project || s.time !== prev.time) dirty.current = true;
    });
    const unsubAssets = subscribeAssets(() => (dirty.current = true));
    document.fonts?.ready.then(() => (dirty.current = true));
    const onFont = () => (dirty.current = true);
    document.fonts?.addEventListener?.('loadingdone', onFont);

    let raf = 0;
    let last = performance.now();
    let lastBounds = '';
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const st = useStore.getState();
      if (document.hidden || st.exporting) return;
      if (st.playing) {
        st.setTime(mod(st.time + dt, st.project.duration));
      }
      if (engine.contextLost !== lost) setLost(engine.contextLost);
      if (!dirty.current) return;
      dirty.current = false;
      engine.render(st.project, st.time);
      const bArr = [...engine.textBounds.entries()];
      const key = JSON.stringify(bArr.map(([id, b]) => [id, Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h)]));
      if (key !== lastBounds) {
        lastBounds = key;
        setBounds(bArr.map(([id, b]) => [id, { ...b }]));
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      unsubStore();
      unsubAssets();
      document.fonts?.removeEventListener?.('loadingdone', onFont);
      setPreviewEngine(null);
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render size follows the display box.
  useEffect(() => {
    const e = engineRef.current;
    if (!e || !box.w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = box.w * dpr;
    let h = box.h * dpr;
    const short = Math.min(w, h);
    if (short > MAX_PREVIEW_SHORT) {
      const s = MAX_PREVIEW_SHORT / short;
      w *= s;
      h *= s;
    }
    e.setSize(w, h);
    dirty.current = true;
  }, [box]);

  const scale = engineRef.current ? box.w / engineRef.current.width : 1;

  const startTextDrag = (id: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const st = useStore.getState();
    const layer = st.project.texts.find((t) => t.id === id);
    if (!layer) return;
    const start = resolveText(st.project, layer, st.time / st.project.duration);
    const sx = e.clientX;
    const sy = e.clientY;
    st.beginGesture();
    const move = (ev: PointerEvent) => {
      const nx = clamp(start.x + ((ev.clientX - sx) / box.w) * 100, -20, 120);
      const ny = clamp(start.y + ((ev.clientY - sy) / box.h) * 100, -20, 120);
      setAnimatable(`text.${id}.x`, Number(nx.toFixed(2)), (d) => {
        const t = d.texts.find((x) => x.id === id);
        if (t) t.x = Number(nx.toFixed(2));
      });
      setAnimatable(`text.${id}.y`, Number(ny.toFixed(2)), (d) => {
        const t = d.texts.find((x) => x.id === id);
        if (t) t.y = Number(ny.toFixed(2));
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      useStore.getState().endGesture();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) await addFilesToSlots(files);
  };

  return (
    <div
      ref={wrapRef}
      className="stage-dots relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div
        className="relative -mt-6 overflow-hidden rounded-[14px] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.6)] ring-1 ring-line-strong"
        style={{ width: box.w, height: box.h }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" aria-label="Animation preview" />
        {bounds
          .filter(([id]) => texts.some((t) => t.id === id && t.visible))
          .map(([id, b]) => (
            <div
              key={id}
              onPointerDown={(e) => startTextDrag(id, e)}
              title="Drag to move"
              className="absolute cursor-move rounded-sm outline-1 outline-dashed outline-transparent hover:outline-accent"
              style={{ left: b.x * scale - 4, top: b.y * scale - 4, width: b.w * scale + 8, height: b.h * scale + 8 }}
            />
          ))}
        {lost && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white">
            <span className="flex items-center gap-2">
              <RotateCcw size={14} /> Preview paused — restoring graphics context…
            </span>
          </div>
        )}
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-accent/20 text-sm font-medium text-white ring-2 ring-inset ring-accent">
            Drop images to fill empty slots
          </div>
        )}
      </div>
    </div>
  );
}
