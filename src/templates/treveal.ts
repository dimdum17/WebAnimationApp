import type { TemplateDef } from './types';
import { clamp, fract, hashRand, lerp, DEG } from '@/lib/math';
import { ease } from '@/engine/easing';

export const diagonalWipe: TemplateDef = {
  id: 'diagonal-wipe',
  name: 'Diagonal Wipe',
  category: 'reveal',
  defaultSlots: 6,
  camera: 'perspective',
  defaults: { cardSize: 78, cardRatio: '4:5', easing: 'smooth', motion: 'stepped', direction: 'down-right' },
  directions: [
    { value: 'down-right', label: 'Down-right' },
    { value: 'down-left', label: 'Down-left' },
    { value: 'up-right', label: 'Up-right' },
    { value: 'up-left', label: 'Up-left' },
  ],
  params: [
    { type: 'number', key: 'transition', label: 'Transition length', min: 10, max: 90, step: 1, unit: '%', default: 55 },
    { type: 'number', key: 'angle', label: 'Edge angle', min: 10, max: 80, step: 1, unit: '°', default: 45 },
    { type: 'number', key: 'zoom', label: 'Reveal zoom', min: 0, max: 30, step: 1, unit: '%', default: 10 },
  ],
  build(b) {
    const [cur, next] = b.createCards(2);
    return {
      update(u) {
        const x = u.p * u.slotCount;
        const k = Math.floor(x);
        const f = fract(x);
        const L = u.str('motion') === 'stepped' ? u.num('transition') / 100 : 1;
        const q = ease(u.str('easing'), clamp((f - (1 - L)) / L, 0, 1));
        const d = u.str('direction');
        const a = u.num('angle') * DEG;
        const nx = (d.endsWith('right') ? 1 : -1) * Math.cos(a);
        const ny = (d.startsWith('up') ? 1 : -1) * Math.sin(a);
        cur.slot = k;
        cur.setSize(...u.dims(k));
        cur.shade = 1 - 0.35 * q;
        const [nw, nh] = u.dims(k + 1);
        // Edge sweeps from the far corner (all hidden) to the opposite one (all shown).
        const E = (Math.abs(nx) * nw + Math.abs(ny) * nh) / 2 + 0.01;
        const s = 1 / (1 + (u.num('zoom') / 100) * (1 - q));
        next.slot = k + 1;
        next.setSize(nw, nh);
        next.setClip(nx, ny, lerp(-E, E, q));
        next.setFrame((1 - s) / 2, (1 - s) / 2, s, s, 0);
        next.group.position.z = 0.002;
        next.group.visible = q > 0;
        next.setOrder(1);
      },
    };
  },
};

export const mosaicWipe: TemplateDef = {
  id: 'mosaic-wipe',
  name: 'Mosaic Wipe',
  category: 'reveal',
  defaultSlots: 6,
  camera: 'perspective',
  defaults: { cardSize: 78, cardRatio: '4:5', easing: 'snappy', motion: 'stepped', direction: 'random' },
  directions: [
    { value: 'random', label: 'Random' },
    { value: 'diagonal', label: 'Diagonal' },
    { value: 'center', label: 'Center out' },
  ],
  params: [
    { type: 'number', key: 'transition', label: 'Transition length', min: 10, max: 90, step: 1, unit: '%', default: 60 },
    { type: 'number', key: 'stagger', label: 'Stagger', min: 0, max: 100, step: 1, unit: '%', default: 75 },
    { type: 'number', key: 'tiles', label: 'Tiles across', min: 3, max: 10, step: 1, default: 5, integer: true },
  ],
  structure: (p) => String(p.tiles),
  build(b) {
    const cols = Number(b.params.tiles);
    // Enough rows for the tallest card ratio (9:16).
    const maxRows = Math.ceil(cols * 1.8) + 1;
    const [back] = b.createCards(1);
    const tiles = b.createCards(cols * maxRows);
    return {
      update(u) {
        const x = u.p * u.slotCount;
        const k = Math.floor(x);
        const f = fract(x);
        const L = u.str('motion') === 'stepped' ? u.num('transition') / 100 : 1;
        const end = 0.97;
        const begin = end - L * end;
        const dur = Math.max(0.03, (end - begin) * (1 - u.num('stagger') / 100));
        const order = u.str('direction');
        const easing = u.str('easing');
        const done = f >= end;
        back.slot = done ? k + 1 : k;
        back.setSize(...u.dims(back.slot));
        const [nw, nh] = u.dims(k + 1);
        const rows = clamp(Math.round((cols * nh) / nw), 1, maxRows);
        const tw = nw / cols;
        const th = nh / rows;
        const shown = clamp((f - begin) / (end - begin), 0, 1);
        back.shade = done ? 1 : 1 - 0.3 * ease(easing, shown);
        tiles.forEach((c, i) => {
          const r = Math.floor(i / cols);
          const col = i % cols;
          if (done || r >= rows) {
            c.group.visible = false;
            return;
          }
          let delay: number;
          if (order === 'random') delay = hashRand(r * cols + col, 41);
          else if (order === 'center') {
            const max = Math.hypot((rows - 1) / 2, (cols - 1) / 2) || 1;
            delay = Math.hypot(r - (rows - 1) / 2, col - (cols - 1) / 2) / max;
          } else delay = (r + col) / Math.max(1, rows + cols - 2);
          const t = clamp((f - begin - delay * (end - begin - dur)) / dur, 0, 1);
          if (t <= 0) {
            c.group.visible = false;
            return;
          }
          const e = ease(easing, t);
          c.slot = k + 1;
          c.setSize(tw, th);
          // Row 0 is the top; crop-frame y starts at the bottom of the image.
          c.setFrame(col / cols, 1 - (r + 1) / rows, 1 / cols, 1 / rows, nw / nh);
          const last = col === cols - 1;
          const first = col === 0;
          c.setCorners(last && r === 0 ? 1 : 0, last && r === rows - 1 ? 1 : 0, first && r === 0 ? 1 : 0, first && r === rows - 1 ? 1 : 0);
          c.group.position.set(-nw / 2 + tw * (col + 0.5), nh / 2 - th * (r + 0.5), 0.003 + (1 - e) * 0.08);
          c.group.scale.setScalar(0.4 + 0.6 * e);
          c.opacity = Math.min(1, t * 2.5);
          c.setOrder(1);
        });
      },
    };
  },
};

export const shutterSlice: TemplateDef = {
  id: 'shutter-slice',
  name: 'Shutter Slice',
  category: 'reveal',
  defaultSlots: 6,
  camera: 'perspective',
  defaults: { cardSize: 76, cardRatio: '4:5', easing: 'smooth', motion: 'stepped', direction: 'right' },
  directions: [
    { value: 'right', label: 'Left → right' },
    { value: 'left', label: 'Right → left' },
    { value: 'down', label: 'Top → bottom' },
    { value: 'up', label: 'Bottom → top' },
  ],
  params: [
    { type: 'number', key: 'slices', label: 'Slices', min: 3, max: 12, step: 1, default: 6, integer: true },
    { type: 'number', key: 'transition', label: 'Transition length', min: 10, max: 90, step: 1, unit: '%', default: 55 },
    { type: 'number', key: 'stagger', label: 'Stagger', min: 0, max: 100, step: 1, unit: '%', default: 60 },
  ],
  structure: (p) => String(p.slices),
  build(b) {
    const N = Number(b.params.slices);
    const strips = b.createCards(N);
    return {
      update(u) {
        const x = u.p * u.slotCount;
        const k = Math.floor(x);
        const f = fract(x);
        const L = u.str('motion') === 'stepped' ? u.num('transition') / 100 : 1;
        const stg = (u.num('stagger') / 100) * 0.85;
        const dur = Math.max(0.02, L * (1 - stg));
        const d = u.str('direction');
        const vertical = d === 'down' || d === 'up';
        const reverse = d === 'left' || d === 'up';
        const easing = u.str('easing');
        strips.forEach((c, i) => {
          const ord = reverse ? N - 1 - i : i;
          const delay = 1 - L + (ord / (N - 1)) * L * stg;
          const angle = ease(easing, clamp((f - delay) / dur, 0, 1)) * Math.PI;
          // Past edge-on, the strip shows the next image's slice.
          const flipped = angle > Math.PI / 2;
          const slot = k + (flipped ? 1 : 0);
          const rot = flipped ? angle - Math.PI : angle;
          const lift = Math.sin(angle);
          const [w, h] = u.dims(slot);
          const aspect = w / h;
          const first = i === 0 ? 1 : 0;
          const last = i === N - 1 ? 1 : 0;
          c.slot = slot;
          if (!vertical) {
            c.setSize(w / N, h);
            c.setFrame(i / N, 0, 1 / N, 1, aspect);
            c.setCorners(last, last, first, first);
            c.group.position.set(-w / 2 + (w * (i + 0.5)) / N, 0, lift * 0.08);
            c.group.rotation.y = rot;
          } else {
            // Strip 0 is the top; crop-frame y starts at the bottom of the image.
            c.setSize(w, h / N);
            c.setFrame(0, 1 - (i + 1) / N, 1, 1 / N, aspect);
            c.setCorners(first, last, first, last);
            c.group.position.set(0, h / 2 - (h * (i + 0.5)) / N, lift * 0.08);
            c.group.rotation.x = -rot;
          }
          c.shade = 1 - 0.45 * lift;
        });
      },
    };
  },
};

export const slideCover: TemplateDef = {
  id: 'slide-cover',
  name: 'Slide Cover',
  category: 'reveal',
  defaultSlots: 6,
  camera: 'perspective',
  defaults: { cardSize: 78, cardRatio: '4:5', easing: 'snappy', motion: 'stepped', direction: 'left' },
  directions: [
    { value: 'left', label: 'From right' },
    { value: 'right', label: 'From left' },
    { value: 'up', label: 'From bottom' },
    { value: 'down', label: 'From top' },
  ],
  params: [
    { type: 'number', key: 'transition', label: 'Transition length', min: 10, max: 90, step: 1, unit: '%', default: 50 },
    { type: 'number', key: 'parallax', label: 'Parallax', min: 0, max: 100, step: 1, unit: '%', default: 35 },
    { type: 'number', key: 'tilt', label: 'Entry tilt', min: 0, max: 30, step: 1, unit: '°', default: 6 },
  ],
  build(b) {
    const [cur, next] = b.createCards(2);
    return {
      update(u) {
        const x = u.p * u.slotCount;
        const k = Math.floor(x);
        const f = fract(x);
        const L = u.str('motion') === 'stepped' ? u.num('transition') / 100 : 1;
        const q = ease(u.str('easing'), clamp((f - (1 - L)) / L, 0, 1));
        const d = u.str('direction');
        const hx = d === 'left' ? 1 : d === 'right' ? -1 : 0;
        const hy = d === 'up' ? -1 : d === 'down' ? 1 : 0;
        const [w, h] = u.dims(k);
        const [nw, nh] = u.dims(k + 1);
        const far = (hx ? u.A + nw / 2 : 1 + nh / 2) * 1.4;
        const par = (u.num('parallax') / 100) * 0.5;
        cur.slot = k;
        cur.setSize(w, h);
        cur.group.position.set(-hx * far * par * q, -hy * far * par * q, 0);
        cur.group.scale.setScalar(1 - 0.08 * q);
        cur.shade = 1 - 0.5 * q;
        cur.setOrder(0);
        next.slot = k + 1;
        next.setSize(nw, nh);
        next.group.position.set(hx * far * (1 - q), hy * far * (1 - q), 0.01);
        next.group.rotation.z = (hx || -hy) * u.num('tilt') * DEG * (1 - q);
        next.group.visible = q > 0;
        next.setOrder(1);
      },
    };
  },
};

export const splitReveal: TemplateDef = {
  id: 'split-reveal',
  name: 'Split Reveal',
  category: 'reveal',
  defaultSlots: 6,
  camera: 'perspective',
  defaults: { cardSize: 72, cardRatio: '4:5', easing: 'snappy', motion: 'stepped', direction: 'horizontal' },
  directions: [
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'vertical', label: 'Vertical' },
  ],
  params: [
    { type: 'number', key: 'transition', label: 'Transition length', min: 10, max: 90, step: 1, unit: '%', default: 45 },
    { type: 'number', key: 'swing', label: 'Swing', min: 0, max: 60, step: 1, unit: '°', default: 18 },
  ],
  build(b) {
    const [back, a, c2] = b.createCards(3);
    return {
      update(u) {
        const n = u.slotCount;
        const x = u.p * n;
        const k = Math.floor(x);
        const f = fract(x);
        const L = u.num('transition') / 100;
        const q = ease(u.str('easing'), clamp((f - (1 - L)) / L, 0, 1));
        const vertical = u.str('direction') === 'vertical';
        const swing = u.num('swing') * DEG;
        const [w, h] = u.dims(k);
        const [bw, bh] = u.dims(k + 1);

        back.slot = k + 1;
        back.setSize(bw, bh);
        back.group.position.z = -0.05;
        back.group.scale.setScalar(lerp(0.88, 1, q));
        back.shade = lerp(0.45, 1, q);
        back.opacity = q > 0 ? 1 : 0;

        const aspect = w / h;
        a.slot = k;
        c2.slot = k;
        if (!vertical) {
          const dist = q * (u.A + w);
          a.setSize(w / 2, h);
          a.setFrame(0, 0, 0.5, 1, aspect);
          a.setCorners(0, 0, 1, 1);
          a.group.position.set(-w / 4 - dist, 0, 0);
          a.group.rotation.y = q * swing;
          c2.setSize(w / 2, h);
          c2.setFrame(0.5, 0, 0.5, 1, aspect);
          c2.setCorners(1, 1, 0, 0);
          c2.group.position.set(w / 4 + dist, 0, 0);
          c2.group.rotation.y = -q * swing;
        } else {
          const dist = q * (1 + h);
          a.setSize(w, h / 2);
          a.setFrame(0, 0.5, 1, 0.5, aspect);
          a.setCorners(1, 0, 1, 0);
          a.group.position.set(0, h / 4 + dist, 0);
          a.group.rotation.x = -q * swing;
          c2.setSize(w, h / 2);
          c2.setFrame(0, 0, 1, 0.5, aspect);
          c2.setCorners(0, 1, 0, 1);
          c2.group.position.set(0, -h / 4 - dist, 0);
          c2.group.rotation.x = q * swing;
        }
      },
    };
  },
};
