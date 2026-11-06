import type { Keyframe, Project, ParamValue } from '@/types/project';
import { allTemplateParams, SHARED_DEFAULTS, sharedPath, tplPath } from '@/templates/shared';
import type { Params, TemplateDef } from '@/templates/types';
import { easeInOutCubic } from './easing';

export function interpolate(kfs: Keyframe[], t: number): number {
  if (kfs.length === 1) return kfs[0].value;
  const first = kfs[0];
  const last = kfs[kfs.length - 1];
  if (t <= first.time) return first.value;
  if (t >= last.time) return last.value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (t >= a.time && t <= b.time) {
      const span = b.time - a.time;
      if (span <= 0) return b.value;
      const u = (t - a.time) / span;
      if (a.easing === 'hold') return a.value;
      const e = a.easing === 'smooth' ? easeInOutCubic(u) : u;
      return a.value + (b.value - a.value) * e;
    }
  }
  return last.value;
}

export function resolveNumber(project: Project, path: string, base: number, t01: number): number {
  const kfs = project.keyframes[path];
  if (!kfs || kfs.length === 0) return base;
  return interpolate(kfs, t01);
}

export function resolveParams(project: Project, def: TemplateDef, t01: number): Params {
  const out: Params = {};
  for (const [k, v] of Object.entries(SHARED_DEFAULTS)) {
    const raw: ParamValue = project.shared[k] ?? v;
    out[k] = typeof raw === 'number' ? resolveNumber(project, sharedPath(k), raw, t01) : raw;
  }
  const stored = project.templateParams[def.id] ?? {};
  for (const pd of allTemplateParams(def)) {
    const raw: ParamValue = stored[pd.key] ?? pd.default;
    out[pd.key] =
      typeof raw === 'number' && pd.type === 'number' && !pd.integer
        ? resolveNumber(project, tplPath(def.id, pd.key), raw, t01)
        : raw;
  }
  return out;
}

/** Frame tolerance used to detect "a keyframe at the current time". */
export function keyTolerance(duration: number) {
  return 0.5 / (duration * 30);
}

export function findKeyAt(kfs: Keyframe[] | undefined, t01: number, duration: number) {
  if (!kfs) return undefined;
  const tol = keyTolerance(duration);
  return kfs.find((k) => Math.abs(k.time - t01) <= tol);
}
