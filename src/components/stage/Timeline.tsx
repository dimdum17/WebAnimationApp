import { useRef } from 'react';
import { Diamond, Pause, Play, SkipBack } from 'lucide-react';
import { useStore } from '@/state/store';
import { clamp } from '@/lib/math';
import { IconButton } from '@/components/ui/controls';
import { useKeyframeCount } from './KeyframePanel';

export function Scrubber({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const time = useStore((s) => s.time);
  const duration = useStore((s) => s.project.duration);
  const pct = clamp(time / duration, 0, 1) * 100;

  const seek = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const t = clamp((clientX - r.left) / r.width, 0, 0.9999) * duration;
    useStore.getState().setTime(t);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const st = useStore.getState();
    const wasPlaying = st.playing;
    st.setPlaying(false);
    seek(e.clientX);
    const move = (ev: PointerEvent) => seek(ev.clientX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (wasPlaying) useStore.getState().setPlaying(true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Playhead"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={Number(time.toFixed(2))}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        const st = useStore.getState();
        const step = 1 / 30;
        if (e.key === 'ArrowRight') st.setTime(clamp(st.time + step, 0, duration - 0.001));
        if (e.key === 'ArrowLeft') st.setTime(clamp(st.time - step, 0, duration));
      }}
      className={`group relative h-6 cursor-pointer touch-none ${className}`}
    >
      <div className="absolute inset-x-0 top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-panel-3" />
      <div className="absolute left-0 top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-accent" style={{ width: `${pct}%` }} />
      <div
        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow transition-transform group-active:scale-110"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

export function Timeline() {
  const playing = useStore((s) => s.playing);
  const time = useStore((s) => s.time);
  const duration = useStore((s) => s.project.duration);
  const set = useStore((s) => s.setPlaying);
  const kfOpen = useStore((s) => s.keyframesOpen);
  const kfCount = useKeyframeCount();
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-t border-line bg-panel px-4">
      <IconButton label={playing ? 'Pause (Space)' : 'Play (Space)'} onClick={() => set(!playing)} className="bg-panel-2">
        {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </IconButton>
      <IconButton label="Back to start" onClick={() => useStore.getState().setTime(0)} className="bg-panel-2">
        <SkipBack size={14} />
      </IconButton>
      <Scrubber className="mx-3 flex-1" />
      <span className="w-[88px] text-right font-mono text-[11px] tabular-nums text-muted">
        {time.toFixed(1)}s / {duration.toFixed(1)}s
      </span>
      <button
        type="button"
        aria-pressed={kfOpen}
        title="Keyframes (K)"
        onClick={() => useStore.getState().set({ keyframesOpen: !kfOpen })}
        className={`ml-1 flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium transition ${
          kfOpen ? 'bg-panel-3 text-fg' : 'text-muted hover:bg-panel-2 hover:text-fg'
        }`}
      >
        <Diamond size={12} />
        Keyframes
        {kfCount > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] leading-4 text-accent-fg">{kfCount}</span>}
      </button>
    </div>
  );
}
