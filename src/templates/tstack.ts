import type { TemplateDef } from './types';
import { LR } from './helpers';
import { clamp, DEG, fract, hashRand, lerp, mod } from '@/lib/math';
import { ease } from '@/engine/easing';

export const stackSlide: TemplateDef = {
  id: 'stack-slide',
  name: 'Stack Slide',
  category: 'stack',
  defaultSlots: 6,
  camera: 'perspective',
  defaults: { cardSize: 62, cardRatio: '4:5', easing: 'smooth', motion: 'stepped', direction: 'down' },
  directions: [
    { value: 'down', label: 'Down' },
    { value: 'up', label: 'Up' },
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
  ],
  params: [
    { type: 'number', key: 'peek', label: 'Peek offset', min: 0, max: 100, step: 1, unit: '%', default: 40 },
    { type: 'number', key: 'depth', label: 'Depth scale', min: 0, max: 20, step: 1, unit: '%', default: 7 },
    { type: 'number', key: 'count', label: 'Visible cards', min: 2, max: 6, step: 1, default: 4, integer: true },
  ],
  structure: (p) => String(p.count),
  build(b) {
    const K = Number(b.params.count);
    const pool = b.createCards(K + 1);
    return {
      update(u) {
        const s = u.advance(u.p * u.slotCount);
        const k = Math.floor(s);
        const d0 = u.str('direction');
        const ex = d0 === 'right' ? 1 : d0 === 'left' ? -1 : 0;
        const ey = d0 === 'up' ? 1 : d0 === 'down' ? -1 : 0;
        const [w0, h0] = u.dims(k);
        const peek = (u.num('peek') / 100) * 0.07 * (ex ? w0 : h0);
        const depth = u.num('depth') / 100;
        const far = (ex ? u.A + w0 / 2 : 1 + h0 / 2) * 1.35;
        for (let j = k; j <= k + K; j++) {
          const c = pool[mod(j, K + 1)];
          const d = j - s;
          c.slot = j;
          c.setSize(...u.dims(j));
          if (d < 0) {
            // Front card slides out; the cards behind peek out on the opposite side.
            const t = -d;
            c.group.position.set(ex * far * t, ey * far * t, 0.05);
            c.group.rotation.z = (ex || -ey) * -6 * DEG * t;
            c.setOrder(K + 5);
          } else {
            c.group.position.set(-ex * peek * d, -ey * peek * d, -d * 0.02);
            c.group.scale.setScalar(Math.max(0.05, 1 - depth * d));
            c.shade = 1 - Math.min(d, K) * 0.12;
            c.opacity = d > K - 1 ? clamp(K - d, 0, 1) : 1;
            c.setOrder(K - d);
          }
        }
      },
    };
  },
};

const deckCount = (n: number) => clamp(n, 3, 7);

export const deckShuffle: TemplateDef = {
  id: 'deck-shuffle',
  name: 'Deck Shuffle',
  category: 'stack',
  defaultSlots: 6,
  camera: 'orthographic',
  defaults: { cardSize: 56, cardRatio: '4:5', easing: 'smooth', motion: 'stepped', direction: 'right' },
  directions: LR,
  params: [
    { type: 'number', key: 'offset', label: 'Stack offset', min: 0, max: 100, step: 1, unit: '%', default: 45 },
    { type: 'number', key: 'swing', label: 'Swing out', min: 20, max: 150, step: 1, unit: '%', default: 80 },
    { type: 'number', key: 'rotation', label: 'Rotation range', min: 0, max: 30, step: 1, unit: '°', default: 6 },
  ],
  structure: (_p, n) => String(deckCount(n)),
  build(b) {
    const K = deckCount(b.slotCount);
    const pool = b.createCards(K + 1);
    return {
      update(u) {
        const n = u.slotCount;
        const s = u.advance(u.p * n);
        const k = Math.floor(s);
        const side = u.str('direction') === 'left' ? -1 : 1;
        const off = u.num('offset') / 100;
        const swing = u.num('swing') / 100;
        const range = u.num('rotation') * DEG;
        const [w0, h0] = u.dims(k);
        const dx = -side * w0 * 0.07 * off;
        const dy = h0 * 0.055 * off;
        const cx = (-(K - 1) / 2) * dx;
        const cy = (-(K - 1) / 2) * dy;
        for (let j = k; j <= k + K; j++) {
          const c = pool[mod(j, K + 1)];
          const d = j - s;
          c.slot = j;
          c.setSize(...u.dims(j));
          const rot = (hashRand(mod(j, n), 11) - 0.5) * 2 * range;
          if (d < 0) {
            // Top card swings out to the side and tucks in behind the stack.
            const t = -d;
            const arc = Math.sin(t * Math.PI);
            const depth = t * (K - 1);
            c.group.position.set(
              cx + depth * dx + side * arc * w0 * (0.55 + swing),
              cy + depth * dy + arc * h0 * 0.08,
              t < 0.5 ? 1 : -1,
            );
            c.group.rotation.z = rot + side * arc * 14 * DEG;
            c.group.scale.setScalar((1 - depth * 0.035) * (1 + 0.04 * arc));
            c.shade = 1 - depth * 0.09;
            c.opacity = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
            c.setOrder(t < 0.5 ? K + 5 : -5);
          } else {
            c.group.position.set(cx + d * dx, cy + d * dy, -d * 0.01);
            c.group.rotation.z = rot;
            c.group.scale.setScalar(1 - d * 0.035);
            c.shade = 1 - Math.min(d, K) * 0.09;
            c.opacity = d > K - 1 ? clamp(K - d, 0, 1) : 1;
            c.setOrder(K - d);
          }
        }
      },
    };
  },
};

export const fanSpread: TemplateDef = {
  id: 'fan-spread',
  name: 'Fan Spread',
  category: 'stack',
  defaultSlots: 8,
  camera: 'orthographic',
  defaults: { cardSize: 40, cardRatio: '3:4', easing: 'smooth', motion: 'stepped', direction: 'right' },
  directions: LR,
  params: [
    { type: 'number', key: 'arc', label: 'Fan angle', min: 20, max: 140, step: 1, unit: '°', default: 70 },
    { type: 'number', key: 'radius', label: 'Pivot depth', min: 30, max: 250, step: 1, unit: '%', default: 110 },
    { type: 'number', key: 'count', label: 'Visible cards', min: 3, max: 9, step: 1, default: 5, integer: true },
  ],
  structure: (p) => String(p.count),
  build(b) {
    const V = Number(b.params.count);
    const P = V + 3;
    const pool = b.createCards(P);
    return {
      update(u) {
        const dir = u.str('direction') === 'left' ? -1 : 1;
        const s = u.advance(u.p * u.slotCount);
        const k = Math.floor(s);
        const half = (V - 1) / 2;
        const step = (u.num('arc') * DEG) / Math.max(1, V - 1);
        const R = (u.num('radius') / 100) * u.U;
        const lift = R * (1 - Math.cos(half * step)) * 0.4;
        for (const c of pool) c.group.visible = false;
        const reach = Math.ceil(half) + 1;
        for (let j = k - reach; j <= k + reach; j++) {
          const c = pool[mod(j, P)];
          const a = (j - s) * dir;
          const vis = clamp(half + 1 - Math.abs(a), 0, 1);
          if (vis <= 0) continue;
          const th = a * step;
          const focus = Math.max(0, 1 - Math.abs(a));
          c.group.visible = true;
          c.slot = j;
          c.setSize(...u.dims(j));
          c.group.position.set(Math.sin(th) * R, Math.cos(th) * R - R + lift, focus * 0.1 - Math.abs(a) * 0.01);
          c.group.rotation.z = -th;
          c.group.scale.setScalar(1 + 0.12 * focus);
          c.opacity = vis;
          c.shade = 1 - Math.min(Math.abs(a), 3) * 0.08;
          c.setOrder(10 - Math.abs(a));
        }
      },
    };
  },
};

export const cardToss: TemplateDef = {
  id: 'card-toss',
  name: 'Card Toss',
  category: 'stack',
  defaultSlots: 8,
  camera: 'orthographic',
  defaults: { cardSize: 52, cardRatio: '4:5', easing: 'smooth', motion: 'stepped', direction: 'right' },
  directions: [
    { value: 'left', label: 'From left' },
    { value: 'right', label: 'From right' },
    { value: 'top', label: 'From top' },
    { value: 'bottom', label: 'From bottom' },
  ],
  params: [
    { type: 'number', key: 'scatter', label: 'Scatter', min: 0, max: 100, step: 1, unit: '%', default: 35 },
    { type: 'number', key: 'rotation', label: 'Rotation range', min: 0, max: 60, step: 1, unit: '°', default: 18 },
    { type: 'number', key: 'pile', label: 'Pile size', min: 2, max: 8, step: 1, default: 5, integer: true },
  ],
  structure: (p) => String(p.pile),
  build(b) {
    const K = Number(b.params.pile);
    const pool = b.createCards(K + 1);
    return {
      update(u) {
        const n = u.slotCount;
        const stepped = u.str('motion') === 'stepped';
        const x = u.p * n;
        const k = Math.floor(x);
        const f = fract(x);
        const flight = stepped ? 0.55 : 1;
        const q = ease(u.str('easing'), Math.min(f / flight, 1));
        const scatter = (u.num('scatter') / 100) * u.U * 0.35;
        const range = u.num('rotation') * DEG;
        const d = u.str('direction');
        const fromX = d === 'left' ? -1 : d === 'right' ? 1 : 0;
        const fromY = d === 'top' ? 1 : d === 'bottom' ? -1 : 0;
        for (const c of pool) c.group.visible = false;
        for (let j = k - K; j <= k; j++) {
          const c = pool[mod(j, K + 1)];
          const id = mod(j, n);
          c.group.visible = true;
          c.slot = id;
          c.setSize(...u.dims(id));
          const rx = (hashRand(id, 1) - 0.5) * 2 * scatter;
          const ry = (hashRand(id, 2) - 0.5) * 2 * scatter;
          const rr = (hashRand(id, 3) - 0.5) * 2 * range;
          let px = rx;
          let py = ry;
          let rot = rr;
          let sc = 1;
          if (j === k) {
            const far = (u.A + 1) * 1.6;
            px = lerp(rx + fromX * far, rx, q);
            py = lerp(ry + fromY * far * 1.3, ry, q);
            rot = lerp(rr + (fromX || fromY) * 50 * DEG, rr, q);
            sc = lerp(1.15, 1, q);
          }
          if (j === k - K) c.opacity = 1 - q;
          c.group.position.set(px, py, (j - k + K) * 0.01);
          c.group.rotation.z = rot;
          c.group.scale.setScalar(sc);
          c.setOrder(j - k + K);
        }
      },
    };
  },
};
