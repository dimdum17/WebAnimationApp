import type { TemplateDef } from './types';
import { FB } from './helpers';
import { clamp, fract, hashRand, lerp, mod } from '@/lib/math';
import { ease } from '@/engine/easing';
import type { Card } from '@/engine/card';
import type { UpdateCtx } from './types';

export const kenBurns: TemplateDef = {
  id: 'ken-burns',
  name: 'Ken Burns',
  category: 'spotlight',
  defaultSlots: 6,
  camera: 'perspective',
  defaults: { cardSize: 84, cardRatio: '4:5', easing: 'smooth', motion: 'stepped', direction: 'in' },
  directions: [
    { value: 'in', label: 'Zoom in' },
    { value: 'out', label: 'Zoom out' },
    { value: 'alternate', label: 'Alternate' },
  ],
  params: [
    { type: 'number', key: 'zoom', label: 'Zoom amount', min: 0, max: 100, step: 1, unit: '%', default: 45 },
    { type: 'number', key: 'pan', label: 'Pan', min: 0, max: 100, step: 1, unit: '%', default: 60 },
    { type: 'number', key: 'transition', label: 'Crossfade', min: 5, max: 60, step: 1, unit: '%', default: 25 },
  ],
  build(b) {
    const [cur, next] = b.createCards(2);
    return {
      update(u) {
        const n = u.slotCount;
        const x = u.p * n;
        const k = Math.floor(x);
        const f = fract(x);
        const L = u.num('transition') / 100;
        const amt = (u.num('zoom') / 100) * 0.6;
        const pan = u.num('pan') / 100;
        const mode = u.str('direction');
        const q = ease(u.str('easing'), clamp((f - (1 - L)) / L, 0, 1));
        // g = progress through a slot's visible life (fade-in start → fade-out end), continuous across steps.
        const frame = (c: Card, j: number, g: number, ctx: UpdateCtx) => {
          const slot = mod(j, n);
          const [w, h] = ctx.dims(j);
          const zin = mode === 'in' || (mode === 'alternate' && slot % 2 === 0);
          const s = 1 / (zin ? 1 + amt * g : 1 + amt * (1 - g));
          const px = 0.5 + (lerp(hashRand(slot, 21), hashRand(slot, 23), g) - 0.5) * pan;
          const py = 0.5 + (lerp(hashRand(slot, 22), hashRand(slot, 24), g) - 0.5) * pan;
          c.slot = j;
          c.setSize(w, h);
          c.setFrame((1 - s) * px, (1 - s) * py, s, s, 0);
        };
        frame(cur, k, (f + L) / (1 + L), u);
        cur.setOrder(0);
        frame(next, k + 1, Math.max(0, f - (1 - L)) / (1 + L), u);
        next.group.position.z = 0.001;
        next.opacity = q;
        next.setOrder(1);
      },
    };
  },
};

export const centerStage: TemplateDef = {
  id: 'center-stage',
  name: 'Center Stage',
  category: 'spotlight',
  defaultSlots: 6,
  camera: 'perspective',
  defaults: { cardSize: 62, cardRatio: '4:5', easing: 'smooth', motion: 'stepped', direction: 'forward' },
  directions: FB,
  params: [
    { type: 'number', key: 'transition', label: 'Transition length', min: 10, max: 90, step: 1, unit: '%', default: 40 },
    { type: 'number', key: 'zoom', label: 'Zoom', min: 0, max: 40, step: 1, unit: '%', default: 12 },
    { type: 'number', key: 'backdrop', label: 'Backdrop', min: 0, max: 100, step: 1, unit: '%', default: 35 },
  ],
  build(b) {
    const [bgCur, bgNext, cur, next] = b.createCards(4);
    return {
      update(u) {
        const n = u.slotCount;
        const x = u.p * n;
        const k = Math.floor(x);
        const f = fract(x);
        const L = u.num('transition') / 100;
        const q = ease(u.str('easing'), clamp((f - (1 - L)) / L, 0, 1));
        const zoom = u.num('zoom') / 100;
        const fwd = u.str('direction') !== 'backward';
        const backdrop = u.num('backdrop') / 100;
        for (const [c, slot, op] of [
          [bgCur, k, 1],
          [bgNext, k + 1, q],
        ] as const) {
          c.slot = slot;
          c.setSize(u.A * 2.6, 2.6);
          c.group.position.z = -0.8 + (c === bgNext ? 0.001 : 0);
          c.opacity = op * backdrop;
          c.shade = 0.55;
        }
        const drift = 1 + 0.04 * f;
        cur.slot = k;
        cur.setSize(...u.dims(k));
        cur.group.scale.setScalar(drift * lerp(1, fwd ? 1 - zoom * 0.5 : 1 + zoom, q));
        cur.shade = 1 - q * 0.3;
        next.slot = k + 1;
        next.setSize(...u.dims(k + 1));
        next.group.position.z = 0.01;
        next.group.scale.setScalar(lerp(fwd ? 1 + zoom : 1 - zoom * 0.5, 1, q));
        next.opacity = q;
      },
    };
  },
};

export const zoomParallax: TemplateDef = {
  id: 'zoom-parallax',
  name: 'Zoom Parallax',
  category: 'spotlight',
  defaultSlots: 6,
  camera: 'perspective',
  defaults: { cardSize: 34, cardRatio: '4:5', easing: 'linear', motion: 'continuous', direction: 'forward' },
  directions: FB,
  params: [
    { type: 'number', key: 'zoom', label: 'Zoom amount', min: 20, max: 100, step: 1, unit: '%', default: 60 },
    { type: 'number', key: 'layers', label: 'Layers', min: 3, max: 6, step: 1, default: 4, integer: true },
    { type: 'number', key: 'spread', label: 'Spread', min: 20, max: 120, step: 1, unit: '%', default: 70 },
  ],
  structure: (p) => String(p.layers),
  build(b) {
    const L = Number(b.params.layers);
    const per = 3;
    const cards = b.createCards(L * per);
    return {
      update(u) {
        const dir = u.str('direction') === 'backward' ? -1 : 1;
        const s = dir * u.advance(u.p * L);
        const D = (u.num('zoom') / 100) * 8;
        const spread = u.num('spread') / 100;
        const camZ = u.camera.position.z;
        cards.forEach((c, i) => {
          const l = Math.floor(i / per);
          const j = i % per;
          const v = mod(l + s, L);
          const z = -D + (v / L) * (D + camZ * 0.8);
          const ang = hashRand(i, 3) * Math.PI * 2;
          const rad = (0.35 + hashRand(i, 7) * 0.65) * spread;
          const center = j === 0 && l % 2 === 0;
          c.group.position.set(
            center ? 0 : Math.cos(ang) * rad * u.A * 1.1,
            center ? 0 : Math.sin(ang) * rad,
            z,
          );
          c.setSize(...u.dims(i, 0.8 + hashRand(i, 11) * 0.5));
          c.opacity = clamp((L - v) / 0.7, 0, 1) * clamp(v / 0.8, 0, 1);
          c.shade = 0.5 + 0.5 * clamp(v / L, 0, 1);
        });
      },
    };
  },
};
