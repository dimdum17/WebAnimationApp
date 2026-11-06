import type { Card } from '@/engine/card';
import type { UpdateCtx } from './types';
import { clamp, lerp, TAU } from '@/lib/math';
import { ease } from '@/engine/easing';

/** A card's full transform/appearance at one moment of a scene. */
export interface Pose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  s: number;
  o: number;
  shade: number;
  order: number;
}

/** Pose of card `i` at scene-local time `t` (0..1). */
export type Layout = (i: number, t: number) => Pose;

const BASE: Pose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, o: 1, shade: 1, order: 0 };

export const pose = (p: Partial<Pose>): Pose => ({ ...BASE, ...p });

const wrapPi = (a: number) => a - TAU * Math.round(a / TAU);

export function blend(a: Pose, b: Pose, t: number): Pose {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    // Shortest way round, so spun-up scenes don't unwind several turns.
    rx: a.rx + wrapPi(b.rx - a.rx) * t,
    ry: a.ry + wrapPi(b.ry - a.ry) * t,
    rz: a.rz + wrapPi(b.rz - a.rz) * t,
    s: lerp(a.s, b.s, t),
    o: lerp(a.o, b.o, t),
    shade: lerp(a.shade, b.shade, t),
    order: t < 0.5 ? a.order : b.order,
  };
}

/** Custom transition: card `i` going from pose `a` to `b`, `t` already eased. */
export type Morph = (a: Pose, b: Pose, t: number, i: number) => Pose;

/** Writes a pose onto a (freshly reset) card; near-invisible cards are hidden. */
export function applyPose(c: Card, P: Pose) {
  if (P.o <= 0.002 || P.s <= 0.001) {
    c.group.visible = false;
    return;
  }
  c.group.position.set(P.x, P.y, P.z);
  c.group.rotation.set(P.rx, P.ry, P.rz);
  c.group.scale.setScalar(P.s);
  c.opacity = clamp(P.o, 0, 1);
  c.shade = P.shade;
  c.setOrder(P.order);
}

/**
 * Plays `scenes` back to back across the loop. Each scene holds for
 * (1 - transition) of its share, then blends into the next scene's opening
 * pose; the last scene blends into the first, so the loop is seamless.
 * `stagger` (0..0.9) delays the blend per card in index order.
 * `morph` replaces the default straight blend.
 */
export function runScenes(
  cards: Card[],
  u: UpdateCtx,
  scenes: Layout[],
  opts: { transition: number; stagger?: number; weights?: number[]; morph?: Morph },
) {
  const S = scenes.length;
  // Optional relative scene lengths; equal shares by default.
  const wts = scenes.map((_, k) => Math.max(1e-3, opts.weights?.[k] ?? 1));
  const sum = wts.reduce((a, b) => a + b, 0);
  let acc = (u.p - Math.floor(u.p)) * sum;
  let j = 0;
  while (j < S - 1 && acc >= wts[j]) acc -= wts[j++];
  const lt = clamp(acc / wts[j], 0, 1);
  const T = clamp(opts.transition, 0.05, 0.95);
  const stg = clamp(opts.stagger ?? 0, 0, 0.9);
  const b = (lt - (1 - T)) / T;
  const easing = u.str('easing');
  const morph = opts.morph ?? ((a: Pose, b: Pose, t: number) => blend(a, b, t));
  const N = cards.length;
  cards.forEach((c, i) => {
    c.setSize(...u.dims(i));
    let P = scenes[j](i, lt);
    if (b > 0) {
      const d = N > 1 ? i / (N - 1) : 0;
      const bi = clamp((b - d * stg) / (1 - stg), 0, 1);
      if (bi > 0) P = morph(P, scenes[(j + 1) % S](i, 0), ease(easing, bi), i);
    }
    applyPose(c, P);
  });
}

/** Scale that fits a w×h card inside a bw×bh box. */
export const fit = (w: number, h: number, bw: number, bh: number) => Math.min(bw / w, bh / h);

export function backOut(t: number, s: number) {
  const x = t - 1;
  return 1 + (s + 1) * x * x * x + s * x * x;
}

export interface GridFit {
  cols: number;
  rows: number;
  cw: number;
  ch: number;
}

/** Column count that makes `N` cards of w×h as large as possible in the frame. */
export function fitGrid(N: number, A: number, w: number, h: number, gap: number): GridFit {
  let best = { cols: 1, rows: N, s: 0 };
  for (let cols = 1; cols <= N; cols++) {
    const rows = Math.ceil(N / cols);
    const s = Math.min((2 * A) / cols / (w * (1 + gap)), 2 / rows / (h * (1 + gap)));
    if (s > best.s) best = { cols, rows, s };
  }
  return { cols: best.cols, rows: best.rows, cw: (2 * A) / best.cols, ch: 2 / best.rows };
}

/** Cell centre for card `i`; a short last row is centred. */
export function gridPos(i: number, N: number, g: GridFit): [number, number] {
  const row = Math.floor(i / g.cols);
  const col = i % g.cols;
  const cnt = Math.min(g.cols, N - row * g.cols);
  return [(col - (cnt - 1) / 2) * g.cw, ((g.rows - 1) / 2 - row) * g.ch];
}
