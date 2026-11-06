import type { TemplateDef } from './types';
import { LR, UD, FB, multipleAtLeast, wrapSigned } from './helpers';
import { clamp, DEG, mod, TAU } from '@/lib/math';

const coverRingCount = (n: number) => clamp(n, 5, 14);

export const coverRing: TemplateDef = {
  id: 'cover-ring',
  name: 'Cover Ring',
  category: '3d',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 44, cardRatio: '4:5', easing: 'smooth', motion: 'stepped', direction: 'left' },
  directions: LR,
  params: [
    { type: 'number', key: 'radius', label: 'Radius', min: 40, max: 200, step: 1, unit: '%', default: 95 },
    { type: 'number', key: 'focus', label: 'Focus scale', min: 100, max: 160, step: 1, unit: '%', default: 125 },
    { type: 'number', key: 'dim', label: 'Side dimming', min: 0, max: 100, step: 1, unit: '%', default: 55 },
    { type: 'number', key: 'tilt', label: 'Tilt', min: -30, max: 30, step: 1, unit: '°', default: 0 },
  ],
  structure: (_p, n) => String(coverRingCount(n)),
  build(b) {
    const N = coverRingCount(b.slotCount);
    const cards = b.createCards(N);
    return {
      update(u) {
        const dir = u.str('direction') === 'right' ? -1 : 1;
        const s = dir * u.advance(u.p * N);
        const R = (u.num('radius') / 100) * u.U;
        const focus = u.num('focus') / 100 - 1;
        const dim = u.num('dim') / 100;
        u.root.rotation.x = u.num('tilt') * DEG;
        cards.forEach((c, i) => {
          const a = wrapSigned(i - s, N);
          const th = (a / N) * TAU;
          const near = Math.max(0, 1 - Math.abs(a));
          c.setSize(...u.dims(i));
          c.group.position.set(Math.sin(th) * R, 0, Math.cos(th) * R - R + near * 0.05 * u.U);
          c.group.rotation.y = th;
          c.group.scale.setScalar(1 + focus * near);
          c.shade = 1 - (dim * (1 - Math.cos(th))) / 2;
        });
      },
    };
  },
};

const ringCount = (n: number) => clamp(n, 6, 16);

export const showcaseRing: TemplateDef = {
  id: 'showcase-ring',
  name: 'Showcase Ring',
  category: '3d',
  defaultSlots: 10,
  camera: 'perspective',
  defaults: { cardSize: 30, cardRatio: '3:4', easing: 'smooth', motion: 'continuous', direction: 'left' },
  directions: LR,
  params: [
    { type: 'number', key: 'radius', label: 'Radius', min: 30, max: 150, step: 1, unit: '%', default: 72 },
    { type: 'number', key: 'tilt', label: 'Tilt', min: -40, max: 40, step: 1, unit: '°', default: 12 },
    { type: 'number', key: 'camera', label: 'Camera distance', min: 60, max: 220, step: 1, unit: '%', default: 110 },
  ],
  structure: (_p, n) => String(ringCount(n)),
  build(b) {
    const N = ringCount(b.slotCount);
    const cards = b.createCards(N);
    return {
      update(u) {
        const dir = u.str('direction') === 'right' ? -1 : 1;
        const rot = (dir * u.advance(u.p * N) * TAU) / N;
        const r = (u.num('radius') / 100) * u.U;
        u.root.rotation.x = u.num('tilt') * DEG;
        u.camera.position.z *= u.num('camera') / 100;
        cards.forEach((c, i) => {
          const th = (i / N) * TAU + rot;
          const [w, h] = u.dims(i);
          c.setSize(w, h);
          c.group.position.set(Math.sin(th) * r, 0, Math.cos(th) * r - r);
          c.group.rotation.y = th;
          c.shade = 0.45 + 0.55 * ((Math.cos(th) + 1) / 2);
        });
      },
    };
  },
};

export const sphereWall: TemplateDef = {
  id: 'sphere-wall',
  name: 'Sphere Wall',
  category: '3d',
  defaultSlots: 10,
  camera: 'perspective',
  defaults: { cardSize: 20, cardRatio: '4:3', easing: 'linear', motion: 'continuous', direction: 'left' },
  directions: LR,
  params: [
    { type: 'number', key: 'curvature', label: 'Curvature', min: 0, max: 100, step: 5, unit: '%', default: 55, integer: true },
    { type: 'number', key: 'rows', label: 'Rows', min: 2, max: 7, step: 1, default: 4, integer: true },
    { type: 'number', key: 'spacing', label: 'Spacing', min: 0, max: 80, step: 1, unit: '%', default: 18 },
    { type: 'number', key: 'tilt', label: 'Tilt', min: -30, max: 30, step: 1, unit: '°', default: -8 },
  ],
  structure: (p) => `${p.curvature}|${p.rows}`,
  build(b) {
    const cols = Math.round(40 - (Number(b.params.curvature) / 100) * 26);
    const rows = Number(b.params.rows);
    const cards = b.createCards(cols * rows);
    return {
      update(u) {
        const dir = u.str('direction') === 'right' ? -1 : 1;
        const gap = u.num('spacing') / 100;
        const s = u.advance(u.p * cols) * dir;
        const [w0, h0] = u.dims(0);
        const pitchX = w0 * (1 + gap);
        const pitchY = h0 * (1 + gap);
        const r = (cols * pitchX) / TAU;
        u.root.rotation.z = u.num('tilt') * DEG;
        u.root.rotation.x = 6 * DEG;
        cards.forEach((c, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const th = ((col + s) / cols) * TAU;
          const cz = Math.cos(th);
          if (cz < -0.15) {
            c.group.visible = false;
            return;
          }
          c.slot = row * cols + col + row * 3;
          const [w, h] = u.dims(c.slot);
          c.setSize(w, h);
          c.group.position.set(Math.sin(th) * r, (row - (rows - 1) / 2) * pitchY, cz * r - r);
          c.group.rotation.y = th;
          c.shade = 0.35 + 0.65 * clamp(cz, 0, 1);
        });
      },
    };
  },
};

export const cardGlobe: TemplateDef = {
  id: 'card-globe',
  name: 'Card Globe',
  category: '3d',
  defaultSlots: 10,
  camera: 'perspective',
  defaults: { cardSize: 15, cardRatio: '1:1', easing: 'linear', motion: 'continuous', direction: 'left' },
  directions: LR,
  params: [
    { type: 'number', key: 'globe', label: 'Globe size', min: 30, max: 150, step: 1, unit: '%', default: 62 },
    { type: 'number', key: 'count', label: 'Card count', min: 16, max: 90, step: 1, default: 48, integer: true },
    { type: 'number', key: 'tilt', label: 'Tilt', min: -45, max: 45, step: 1, unit: '°', default: 16 },
  ],
  structure: (p) => String(p.count),
  build(b) {
    const M = Number(b.params.count);
    const cards = b.createCards(M);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const pts = cards.map((_, i) => {
      const y = 1 - ((i + 0.5) / M) * 2;
      return { lat: Math.asin(y), lon: i * golden };
    });
    return {
      update(u) {
        const dir = u.str('direction') === 'right' ? -1 : 1;
        const n = u.slotCount;
        const rotY = (dir * u.advance(u.p * n) * TAU) / n;
        const r = (u.num('globe') / 100) * u.U;
        u.root.rotation.x = u.num('tilt') * DEG;
        u.root.rotation.y = rotY;
        u.root.position.z = -r;
        cards.forEach((c, i) => {
          const { lat, lon } = pts[i];
          const [w, h] = u.dims(i);
          c.setSize(w, h);
          const cl = Math.cos(lat);
          c.group.position.set(cl * Math.sin(lon) * r, Math.sin(lat) * r, cl * Math.cos(lon) * r);
          c.group.rotation.set(-lat, lon, 0, 'YXZ');
          const facing = cl * Math.cos(lon + rotY);
          c.shade = 0.4 + 0.6 * clamp(facing, 0, 1);
        });
      },
    };
  },
};

export const cardTunnel: TemplateDef = {
  id: 'card-tunnel',
  name: 'Card Tunnel',
  category: '3d',
  defaultSlots: 10,
  camera: 'perspective',
  fov: 60,
  defaults: { cardSize: 90, cardRatio: '1:1', easing: 'linear', motion: 'continuous', direction: 'forward' },
  directions: FB,
  params: [
    { type: 'number', key: 'depth', label: 'Depth', min: 40, max: 200, step: 1, unit: '%', default: 100 },
    { type: 'number', key: 'speed', label: 'Speed', min: 1, max: 3, step: 1, unit: 'x', default: 1, integer: true },
    { type: 'number', key: 'wall', label: 'Wall gap', min: 50, max: 150, step: 1, unit: '%', default: 100 },
  ],
  build(b) {
    const R = 10;
    const cards = b.createCards(R * 8);
    return {
      update(u) {
        const dir = u.str('direction') === 'backward' ? -1 : 1;
        const fill = u.num('cardSize') / 100;
        const D = (u.num('depth') / 100) * 0.7;
        const wall = u.num('wall') / 100;
        const hw = u.A * wall;
        const hh = wall;
        const camZ = u.camera.position.z;
        const off = dir * u.advance(u.p * R * u.num('speed'));
        cards.forEach((c, i) => {
          const ring = Math.floor(i / 8);
          const k = i % 8;
          const pos = mod(ring + off, R);
          const z = camZ - (R - pos) * D + D * 0.2;
          c.slot = ring * 8 + k;
          c.opacity = clamp(pos / 1.5, 0, 1);
          c.shade = 0.3 + 0.7 * clamp(pos / R, 0, 1);
          const wallIdx = k >> 1;
          const half = k & 1 ? 0.5 : -0.5;
          const g = c.group;
          if (wallIdx < 2) {
            const side = wallIdx === 0 ? -1 : 1;
            c.setSize(D * fill, hh * fill);
            g.position.set(side * hw, half * hh, z);
            g.rotation.y = (-side * Math.PI) / 2;
          } else {
            const side = wallIdx === 2 ? -1 : 1;
            c.setSize(hw * fill, D * fill);
            g.position.set(half * hw, side * hh, z);
            g.rotation.x = (side * Math.PI) / 2;
          }
        });
      },
    };
  },
};

export const spiralStream: TemplateDef = {
  id: 'spiral-stream',
  name: 'Spiral Stream',
  category: '3d',
  defaultSlots: 10,
  camera: 'perspective',
  defaults: { cardSize: 24, cardRatio: '4:5', easing: 'linear', motion: 'continuous', direction: 'up' },
  directions: UD,
  params: [
    { type: 'number', key: 'turns', label: 'Turns', min: 0.5, max: 3, step: 0.05, default: 1.25 },
    { type: 'number', key: 'radius', label: 'Radius', min: 15, max: 120, step: 1, unit: '%', default: 48 },
    { type: 'number', key: 'height', label: 'Height', min: 80, max: 320, step: 1, unit: '%', default: 190 },
  ],
  structure: (_p, n) => String(multipleAtLeast(n, 20)),
  build(b) {
    const M = multipleAtLeast(b.slotCount, 20);
    const cards = b.createCards(M);
    return {
      update(u) {
        const dir = u.str('direction') === 'down' ? -1 : 1;
        const s = dir * u.advance(u.p * u.slotCount);
        const turns = u.num('turns');
        const r = (u.num('radius') / 100) * u.U;
        const H = (u.num('height') / 100) * 1.2;
        u.root.rotation.z = -12 * DEG;
        cards.forEach((c, i) => {
          const v = mod(i + s, M);
          const th = (v / M) * TAU * turns;
          const [w, h] = u.dims(i);
          c.setSize(w, h);
          c.group.position.set(Math.sin(th) * r, (v / M - 0.5) * H, Math.cos(th) * r - r);
          c.group.rotation.y = th;
          c.opacity = clamp(Math.min(v, M - v) / 1.5, 0, 1);
          c.shade = 0.45 + 0.55 * ((Math.cos(th) + 1) / 2);
        });
      },
    };
  },
};

const stackCount = (n: number) => clamp(n, 3, 10);

export const depthStack: TemplateDef = {
  id: 'depth-stack',
  name: 'Depth Stack',
  category: '3d',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 48, cardRatio: '3:4', easing: 'smooth', motion: 'stepped', direction: 'forward' },
  directions: FB,
  params: [
    { type: 'number', key: 'depthSpacing', label: 'Depth spacing', min: 5, max: 60, step: 1, unit: '%', default: 22 },
    { type: 'number', key: 'lift', label: 'Lift', min: -20, max: 20, step: 0.5, unit: '%', default: 6 },
    { type: 'number', key: 'tilt', label: 'Tilt', min: -45, max: 45, step: 1, unit: '°', default: -20 },
  ],
  structure: (_p, n) => String(stackCount(n)),
  build(b) {
    const K = stackCount(b.slotCount);
    const cards = b.createCards(K);
    return {
      update(u) {
        const dir = u.str('direction') === 'backward' ? -1 : 1;
        const s = u.advance(u.p * K) * dir;
        const dz = (u.num('depthSpacing') / 100) * u.U;
        const lift = (u.num('lift') / 100) * u.U;
        u.root.rotation.y = u.num('tilt') * DEG;
        u.root.rotation.x = 8 * DEG;
        cards.forEach((c, i) => {
          const k = mod(i - s + 1, K) - 1;
          const [w, h] = u.dims(i);
          c.setSize(w, h);
          if (k < 0) {
            c.group.position.set(0, 0, -k * u.U * 0.9);
            c.opacity = clamp(1 + k * 1.2, 0, 1);
          } else {
            c.group.position.set(0, k * lift, -k * dz);
            c.opacity = clamp(K - 1 - k, 0, 1);
            c.shade = 1 - (k / K) * 0.55;
          }
        });
      },
    };
  },
};
