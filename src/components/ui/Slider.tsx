import { useRef } from 'react';
import { clamp } from '@/lib/math';

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange(v: number): void;
  onStart?(): void;
  onEnd?(): void;
  label?: string;
  className?: string;
}

export function Slider({ value, min, max, step = 1, disabled, onChange, onStart, onEnd, label, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = clamp((value - min) / (max - min || 1), 0, 1) * 100;

  const quantize = (v: number) => {
    const q = Math.round((v - min) / step) * step + min;
    return clamp(Number(q.toFixed(4)), min, max);
  };

  const fromEvent = (e: React.PointerEvent | PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const t = clamp((e.clientX - r.left) / r.width, 0, 1);
    return quantize(min + t * (max - min));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    onStart?.();
    onChange(fromEvent(e));
    const move = (ev: PointerEvent) => onChange(fromEvent(ev));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onEnd?.();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const big = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(quantize(value + step * big));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(quantize(value - step * big));
    }
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-disabled={disabled}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={`group relative h-5 cursor-pointer touch-none select-none rounded-full ${disabled ? 'cursor-default opacity-40' : ''} ${className ?? ''}`}
    >
      <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-panel-3" />
      <div
        className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--fg)_22%,transparent)]"
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute top-1/2 flex h-[14px] w-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-[2px] rounded-full border border-[var(--thumb-border)] bg-[var(--thumb)] shadow-sm transition-transform group-active:scale-105"
        style={{ left: `${pct}%` }}
      >
        <span className="h-[6px] w-px bg-neutral-500" />
        <span className="h-[6px] w-px bg-neutral-500" />
      </div>
    </div>
  );
}
