import { useStore, setAnimatable, toggleKeyframe, t01Of } from '@/state/store';
import { findKeyAt, resolveNumber } from '@/engine/keyframes';
import { Slider } from './Slider';
import type { Project } from '@/types/project';

type DiamondState = 'none' | 'animated' | 'on';

function useDiamond(path: string): DiamondState {
  return useStore((s) => {
    const kfs = s.project.keyframes[path];
    if (!kfs || !kfs.length) return 'none';
    return findKeyAt(kfs, t01Of(s.time, s.project.duration), s.project.duration) ? 'on' : 'animated';
  });
}

export function Diamond({ path, value, disabled }: { path: string; value: number; disabled?: boolean }) {
  const state = useDiamond(path);
  const label =
    state === 'on' ? 'Remove keyframe' : state === 'animated' ? 'Add keyframe here' : 'Animate this value';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => toggleKeyframe(path, value)}
      className="group flex h-5 w-5 shrink-0 items-center justify-center disabled:opacity-30"
    >
      <span
        className={`relative block h-[9px] w-[9px] rotate-45 rounded-[1.5px] border transition-colors ${
          state === 'on'
            ? 'border-accent bg-accent'
            : state === 'animated'
              ? 'border-accent bg-transparent'
              : 'border-faint group-hover:border-muted'
        }`}
      >
        {state === 'animated' && <span className="absolute inset-[2px] rounded-[1px] bg-accent/60" />}
      </span>
    </button>
  );
}

function format(v: number, step: number, unit?: string) {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  const s = v.toFixed(decimals);
  return unit ? `${s}${unit === 'x' ? '×' : unit}` : s;
}

export interface NumberControlProps {
  label: string;
  path: string;
  base: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  keyframeable?: boolean;
  disabled?: boolean;
  writeStatic(d: Project, v: number): void;
}

/** Slider row with keyframe diamond: [◇] Label —o— value */
export function NumberControl({
  label,
  path,
  base,
  min,
  max,
  step,
  unit,
  keyframeable = true,
  disabled,
  writeStatic,
}: NumberControlProps) {
  const value = useStore((s) =>
    keyframeable ? resolveNumber(s.project, path, base, t01Of(s.time, s.project.duration)) : base,
  );
  const begin = useStore((s) => s.beginGesture);
  const end = useStore((s) => s.endGesture);
  const onChange = (v: number) => {
    if (keyframeable) setAnimatable(path, v, (d) => writeStatic(d, v));
    else useStore.getState().edit((d) => writeStatic(d, v));
  };
  return (
    <div className={`flex items-center gap-2 ${disabled ? 'opacity-45' : ''}`}>
      {keyframeable ? <Diamond path={path} value={value} disabled={disabled} /> : <span className="w-5 shrink-0" />}
      <span className="w-[78px] shrink-0 truncate text-xs text-muted" title={label}>
        {label}
      </span>
      <Slider
        className="min-w-0 flex-1"
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onStart={begin}
        onEnd={end}
        onChange={onChange}
      />
      <span className="w-[46px] shrink-0 text-right font-mono text-[11px] tabular-nums text-muted">
        {format(value, step, unit)}
      </span>
    </div>
  );
}
