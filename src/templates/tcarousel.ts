import type { TemplateDef } from './types';
import { LR, UD, multipleAtLeast, wrapSigned } from './helpers';
import { clamp, DEG, lerp, mod } from '@/lib/math';

const WHEEL_POOL = 21;

export const wheelCarousel: TemplateDef = {
  id: 'wheel-carousel',
  name: 'Wheel Carousel',
  category: 'carousel',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 46, cardRatio: '3:4', easing: 'smooth', motion: 'stepped', direction: 'left' },
  directions: LR,
  params: [
    { type: 'number', key: 'radius', label: 'Wheel radius', min: 60, max: 250, step: 1, unit: '%', default: 120 },
    { type: 'number', key: 'spacing', label: 'Spacing', min: 0, max: 60, step: 1, unit: '%', default: 10 },
    { type: 'number', key: 'tilt', label: 'Tilt', min: -20, max: 20, step: 1, unit: '°', default: 0 },
  ],
  build(b) {
    const pool = b.createCards(WHEEL_POOL);
    const half = (WHEEL_POOL - 1) / 2;
    return {
      update(u) {
        const dir = u.str('direction') === 'right' ? -1 : 1;
        const s = dir * u.advance(u.p * u.slotCount);
        const k = Math.floor(s);
        const R = (u.num('radius') / 100) * u.U;
        const [w0] = u.dims(0);
        const step = (w0 * (1 + u.num('spacing') / 100)) / R;
        const maxTh = 1.45;
        const maxZ = u.camera.position.z * 0.7;
        u.root.rotation.x = u.num('tilt') * DEG;
        for (const c of pool) c.group.visible = false;
        for (let j = k - half; j <= k + half; j++) {
          const th = (j - s) * step;
          // Inside of a cylinder: side cards swing toward the viewer.
          const z = R * (1 - Math.cos(th));
          if (Math.abs(th) > maxTh || z > maxZ) continue;
          const c = pool[mod(j, WHEEL_POOL)];
          c.group.visible = true;
          c.slot = j;
          c.setSize(...u.dims(j));
          c.group.position.set(Math.sin(th) * R, 0, z);
          c.group.rotation.y = -th;
          c.opacity = clamp((maxTh - Math.abs(th)) / 0.25, 0, 1) * clamp((maxZ - z) / (0.15 * maxZ), 0, 1);
          c.shade = 1 - 0.35 * Math.min(1, Math.abs(th) / 1.2);
        }
      },
    };
  },
};

const DIAG_POOL = 11;

export const diagonalCarousel: TemplateDef = {
  id: 'diagonal-carousel',
  name: 'Diagonal Carousel',
  category: 'carousel',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 44, cardRatio: '4:5', easing: 'smooth', motion: 'stepped', direction: 'up' },
  directions: [
    { value: 'up', label: 'Up-left' },
    { value: 'down', label: 'Down-right' },
  ],
  params: [
    { type: 'number', key: 'angle', label: 'Angle', min: 15, max: 75, step: 1, unit: '°', default: 40 },
    { type: 'number', key: 'spacing', label: 'Spacing', min: 20, max: 120, step: 1, unit: '%', default: 55 },
    { type: 'number', key: 'falloff', label: 'Side scale', min: 40, max: 100, step: 1, unit: '%', default: 78 },
  ],
  build(b) {
    const pool = b.createCards(DIAG_POOL);
    const half = (DIAG_POOL - 1) / 2;
    return {
      update(u) {
        const dir = u.str('direction') === 'down' ? -1 : 1;
        const s = dir * u.advance(u.p * u.slotCount);
        const k = Math.floor(s);
        const ang = u.num('angle') * DEG;
        const f = u.num('falloff') / 100;
        const [w0] = u.dims(0);
        const pitch = w0 * (u.num('spacing') / 100);
        for (const c of pool) c.group.visible = false;
        for (let j = k - half; j <= k + half; j++) {
          const a = (j - s) * dir;
          const d = Math.abs(a);
          const vis = clamp(4.5 - d, 0, 1);
          if (vis <= 0) continue;
          // Geometric spacing so shrinking side cards stay evenly overlapped.
          const g = f > 0.999 ? d : (1 - Math.pow(f, d)) / (1 - f);
          const off = Math.sign(a) * g * pitch;
          const c = pool[mod(j, DIAG_POOL)];
          c.group.visible = true;
          c.slot = j;
          c.setSize(...u.dims(j));
          c.group.position.set(Math.cos(ang) * off, -Math.sin(ang) * off, -d * 0.02);
          c.group.scale.setScalar(Math.pow(f, d));
          c.shade = 1 - Math.min(d, 4) * 0.1;
          c.opacity = vis;
          c.setOrder(10 - d);
        }
      },
    };
  },
};

const flowCount = (n: number) => (n < 7 ? multipleAtLeast(n, 7) : n);

export const coverFlow: TemplateDef = {
  id: 'cover-flow',
  name: 'Cover Flow',
  category: 'carousel',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 46, cardRatio: '1:1', easing: 'smooth', motion: 'stepped', direction: 'left' },
  directions: LR,
  params: [
    { type: 'number', key: 'angle', label: 'Side angle', min: 0, max: 85, step: 1, unit: '°', default: 58 },
    { type: 'number', key: 'spacing', label: 'Spacing', min: 8, max: 80, step: 1, unit: '%', default: 24 },
    { type: 'number', key: 'depth', label: 'Side depth', min: 0, max: 100, step: 1, unit: '%', default: 50 },
  ],
  structure: (_p, n) => String(flowCount(n)),
  build(b) {
    const N = flowCount(b.slotCount);
    const cards = b.createCards(N);
    return {
      update(u) {
        const dir = u.str('direction') === 'right' ? -1 : 1;
        const f = dir * u.advance(u.p * N);
        const angle = u.num('angle') * DEG;
        const sp = u.num('spacing') / 100;
        const depth = (u.num('depth') / 100) * u.U;
        cards.forEach((c, i) => {
          const d = wrapSigned(i - f, N);
          const ad = Math.abs(d);
          const [w, h] = u.dims(i);
          c.setSize(w, h);
          const near = Math.min(ad, 1);
          const x = Math.sign(d) * (near * w * 0.72 + Math.max(ad - 1, 0) * w * sp);
          c.group.position.set(x, 0, -near * depth - ad * 0.001);
          c.group.rotation.y = -clamp(d, -1, 1) * angle;
          c.opacity = clamp(N / 2 - ad - 0.2, 0, 1);
          c.shade = 1 - near * 0.35;
        });
      },
    };
  },
};

export const filmStrip: TemplateDef = {
  id: 'film-strip',
  name: 'Film Strip',
  category: 'carousel',
  defaultSlots: 10,
  camera: 'perspective',
  defaults: { cardSize: 40, cardRatio: '4:5', easing: 'linear', motion: 'continuous', direction: 'left' },
  directions: LR,
  params: [
    { type: 'number', key: 'gap', label: 'Gap', min: 0, max: 60, step: 1, unit: '%', default: 8 },
    { type: 'number', key: 'speed', label: 'Speed', min: 1, max: 4, step: 1, unit: 'x', default: 1, integer: true },
    { type: 'number', key: 'rows', label: 'Rows', min: 1, max: 3, step: 1, default: 1, integer: true },
    { type: 'number', key: 'tilt', label: 'Tilt', min: -30, max: 30, step: 1, unit: '°', default: 0 },
  ],
  structure: (p, n) => `${p.rows}|${multipleAtLeast(n, 40)}`,
  build(b) {
    const rows = Number(b.params.rows);
    const M = multipleAtLeast(b.slotCount, 40);
    const cards = b.createCards(rows * M);
    return {
      update(u) {
        const dir = u.str('direction') === 'right' ? 1 : -1;
        const s = u.advance(u.p * u.slotCount * u.num('speed'));
        const [w0, h0] = u.dims(0);
        const pitch = w0 * (1 + u.num('gap') / 100);
        const rowPitch = h0 * (1 + u.num('gap') / 100);
        const limit = u.A * 1.6 + w0;
        u.root.rotation.z = u.num('tilt') * DEG;
        cards.forEach((c, i) => {
          const row = Math.floor(i / M);
          const k = i % M;
          const rd = row % 2 === 0 ? dir : -dir;
          const x = (mod(k + rd * s + row * 0.5, M) - M / 2) * pitch;
          if (Math.abs(x) > limit) {
            c.group.visible = false;
            return;
          }
          c.slot = k + row * 3;
          const [w, h] = u.dims(c.slot);
          c.setSize(w, h);
          c.group.position.set(x, ((rows - 1) / 2 - row) * rowPitch, 0);
        });
      },
    };
  },
};

export const cardTotem: TemplateDef = {
  id: 'card-totem',
  name: 'Card Totem',
  category: 'carousel',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 34, cardRatio: '4:3', easing: 'smooth', motion: 'stepped', direction: 'up' },
  directions: UD,
  params: [
    { type: 'number', key: 'gap', label: 'Gap', min: 0, max: 60, step: 1, unit: '%', default: 10 },
    { type: 'number', key: 'focus', label: 'Focus scale', min: 100, max: 200, step: 1, unit: '%', default: 135 },
  ],
  structure: (_p, n) => String(multipleAtLeast(n, 16)),
  build(b) {
    const M = multipleAtLeast(b.slotCount, 16);
    const cards = b.createCards(M);
    return {
      update(u) {
        const dir = u.str('direction') === 'down' ? -1 : 1;
        const s = dir * u.advance(u.p * u.slotCount);
        const [, h0] = u.dims(0);
        const pitch = h0 * (1 + u.num('gap') / 100);
        const fs = u.num('focus') / 100;
        cards.forEach((c, i) => {
          const v = mod(i - s, M) - M / 2;
          const near = clamp(1 - Math.abs(v), 0, 1);
          // Push neighbours apart so the enlarged focus card doesn't overlap.
          const extra = (fs - 1) * pitch * 0.5;
          const y = -(v * pitch + clamp(v, -1, 1) * extra);
          if (Math.abs(y) > 2.5) {
            c.group.visible = false;
            return;
          }
          const [w, h] = u.dims(i);
          c.setSize(w, h);
          c.group.position.set(0, y, near * 0.05);
          c.group.scale.setScalar(lerp(1, fs, near));
          c.shade = 0.55 + 0.45 * near;
        });
      },
    };
  },
};

export const focusSlider: TemplateDef = {
  id: 'focus-slider',
  name: 'Focus Slider',
  category: 'carousel',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 56, cardRatio: '3:4', easing: 'snappy', motion: 'stepped', direction: 'left' },
  directions: LR,
  params: [
    { type: 'number', key: 'side', label: 'Side scale', min: 30, max: 100, step: 1, unit: '%', default: 62 },
    { type: 'number', key: 'gap', label: 'Gap', min: 0, max: 60, step: 1, unit: '%', default: 10 },
  ],
  structure: (_p, n) => String(flowCount(n)),
  build(b) {
    const N = flowCount(b.slotCount);
    const cards = b.createCards(N);
    return {
      update(u) {
        const dir = u.str('direction') === 'right' ? -1 : 1;
        const f = dir * u.advance(u.p * N);
        const side = u.num('side') / 100;
        cards.forEach((c, i) => {
          const d = wrapSigned(i - f, N);
          const ad = Math.abs(d);
          const [w, h] = u.dims(i);
          const gap = w * (u.num('gap') / 100);
          c.setSize(w, h);
          const near = Math.min(ad, 1);
          const first = w * (1 + side) * 0.5 + gap;
          const x = Math.sign(d) * (near * first + Math.max(ad - 1, 0) * (w * side + gap));
          c.group.position.set(x, 0, -ad * 0.001);
          c.group.scale.setScalar(lerp(1, side, near));
          c.opacity = clamp(N / 2 - ad - 0.2, 0, 1);
          c.shade = 1 - near * 0.4;
        });
      },
    };
  },
};
