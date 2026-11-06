import type { NumberParam, TemplateDef } from './types';
import { CW, LR, UD, wrapSigned } from './helpers';
import { clamp, DEG, hashRand, mod, TAU } from '@/lib/math';
import { fit } from './scenes';

/*
 * 3D & Perspective, second batch: Orbit Globe, Sphere Cascade, Totem Wall,
 * Parallax Totem and Cover Ring Vertical.
 */

const num = (key: string, label: string, min: number, max: number, def: number, unit = '%'): NumberParam => ({
  type: 'number',
  key,
  label,
  min,
  max,
  step: 1,
  unit,
  default: def,
});
const int = (key: string, label: string, min: number, max: number, def: number, step = 1, unit?: string): NumberParam => ({
  type: 'number',
  key,
  label,
  min,
  max,
  step,
  unit,
  default: def,
  integer: true,
});

// ---------------------------------------------------------------------------
// Orbit Globe: a loose ball of camera-facing cards, each on its own tilted
// orbit around the centre.

export const orbitGlobe: TemplateDef = {
  id: 'orbit-globe',
  name: 'Orbit Globe',
  category: '3d',
  defaultSlots: 10,
  camera: 'perspective',
  defaults: { cardSize: 22, cardRatio: '1:1', easing: 'linear', motion: 'continuous', direction: 'cw' },
  directions: CW,
  hide: ['motion'],
  params: [
    int('count', 'Card count', 8, 30, 18),
    num('radius', 'Globe size', 30, 120, 62),
    num('spread', 'Orbit spread', 0, 90, 70, '°'),
    int('speed', 'Revolutions', 1, 3, 1),
    num('tilt', 'Tilt', -40, 40, 15, '°'),
  ],
  structure: (p) => String(p.count),
  build(b) {
    const cards = b.createCards(Number(b.params.count) || 18);
    const N = cards.length;
    return {
      update(u) {
        const dir = u.str('direction') === 'ccw' ? -1 : 1;
        const R = (u.num('radius') / 100) * u.U;
        const spread = u.num('spread') * DEG;
        const turns = u.num('speed');
        u.root.rotation.x = u.num('tilt') * DEG;
        u.root.position.z = -R;
        cards.forEach((c, i) => {
          // Golden-angle nodes keep the orbits evenly spread around the ball.
          const node = i * 2.39996;
          const inc = (hashRand(i, 31) * 2 - 1) * spread;
          const r = R * (0.82 + 0.3 * hashRand(i, 32));
          const ph = (i / N) * TAU + dir * u.p * TAU * turns;
          const x0 = Math.cos(ph) * r;
          const z0 = Math.sin(ph) * r;
          const y1 = -z0 * Math.sin(inc);
          const z1 = z0 * Math.cos(inc);
          const x = x0 * Math.cos(node) + z1 * Math.sin(node);
          const z = -x0 * Math.sin(node) + z1 * Math.cos(node);
          const front = (z / r + 1) / 2;
          c.setSize(...u.dims(i));
          c.group.position.set(x, y1, z);
          c.group.rotation.z = (hashRand(i, 33) - 0.5) * 0.3;
          c.group.scale.setScalar(0.75 + 0.35 * hashRand(i, 34));
          c.shade = 0.4 + 0.6 * front;
          c.setOrder(Math.round(front * 100));
        });
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Sphere Cascade: latitude rows wrapped on a sphere; neighbouring rows turn
// in opposite directions and step one after another.

function cascadeRows(rows: number, cols: number, band: number) {
  const out: { lat: number; n: number; start: number }[] = [];
  let start = 0;
  for (let j = 0; j < rows; j++) {
    const lat = rows > 1 ? (j / (rows - 1) - 0.5) * 2 * band * DEG : 0;
    const n = Math.max(4, Math.round(cols * Math.cos(lat)));
    out.push({ lat, n, start });
    start += n;
  }
  return { rows: out, total: start };
}

export const sphereCascade: TemplateDef = {
  id: 'sphere-cascade',
  name: 'Sphere Cascade',
  category: '3d',
  defaultSlots: 10,
  camera: 'perspective',
  defaults: { cardSize: 20, cardRatio: '4:3', easing: 'smooth', motion: 'stepped', direction: 'left' },
  directions: LR,
  hide: ['cardSize'],
  params: [
    int('rows', 'Rows', 3, 7, 5),
    int('cols', 'Cards per row', 10, 28, 18),
    int('band', 'Latitude band', 20, 70, 50, 5, '°'),
    num('radius', 'Sphere size', 40, 150, 85),
    num('gap', 'Gap', 0, 40, 10),
    num('cascade', 'Cascade', 0, 100, 35),
    num('tilt', 'Tilt', -30, 30, 8, '°'),
  ],
  structure: (p) => `${p.rows}|${p.cols}|${p.band}`,
  build(b) {
    const layout = cascadeRows(Number(b.params.rows) || 5, Number(b.params.cols) || 18, Number(b.params.band) || 50);
    const cards = b.createCards(layout.total);
    return {
      update(u) {
        const dir = u.str('direction') === 'right' ? -1 : 1;
        const R = (u.num('radius') / 100) * u.U;
        const gap = u.num('gap') / 100;
        const cascade = (u.num('cascade') / 100) * 0.8;
        const L = layout.rows.length;
        const latStep = L > 1 ? Math.abs(layout.rows[1].lat - layout.rows[0].lat) : 0.6;
        const S = u.slotCount;
        u.root.rotation.x = u.num('tilt') * DEG;
        u.root.position.z = -R;
        layout.rows.forEach((row, j) => {
          const rd = j % 2 ? -dir : dir;
          // Each row steps through its own cards once per loop, delayed per row.
          const step = u.advance(u.p * row.n - j * cascade) * rd;
          const cosL = Math.cos(row.lat);
          const cellW = ((TAU * R * cosL) / row.n) * (1 - gap);
          const cellH = R * latStep * (1 - gap);
          for (let k = 0; k < row.n; k++) {
            const c = cards[row.start + k];
            const th = ((k + step) / row.n) * TAU;
            const cz = Math.cos(th) * cosL;
            if (cz < -0.1) {
              c.group.visible = false;
              continue;
            }
            c.slot = mod(k + j * 3, S);
            const [w, h] = u.dims(c.slot);
            c.setSize(w, h);
            c.group.position.set(Math.sin(th) * cosL * R, Math.sin(row.lat) * R, cz * R);
            c.group.rotation.set(-row.lat, th, 0, 'YXZ');
            c.group.scale.setScalar(fit(w, h, cellW, cellH));
            c.shade = 0.3 + 0.7 * clamp(cz, 0, 1);
          }
        });
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Totem Wall: a perspective wall of vertical columns scrolling in alternate
// directions, each column offset in time.

/** Pool rows per column: enough to cover a tilted frame with small, wide cards. */
function totemRows(C: number, A: number) {
  const pitchMin = ((2 * A * 0.6) / C) * 0.75;
  return clamp(Math.ceil(2.6 / pitchMin) + 2, 6, 20);
}

export const totemWall: TemplateDef = {
  id: 'totem-wall',
  name: 'Totem Wall',
  category: '3d',
  defaultSlots: 10,
  camera: 'perspective',
  defaults: { cardSize: 30, cardRatio: '4:5', easing: 'smooth', motion: 'stepped', direction: 'up' },
  directions: UD,
  hide: ['cardSize'],
  params: [
    int('cols', 'Columns', 3, 7, 5),
    num('width', 'Wall width', 60, 160, 110),
    num('gap', 'Gap', 0, 40, 8),
    num('angle', 'Wall angle', -50, 50, -22, '°'),
    num('tilt', 'Tilt', -30, 30, 10, '°'),
    num('cascade', 'Cascade', 0, 100, 30),
  ],
  structure: (p) => String(p.cols),
  build(b) {
    const C = Number(b.params.cols) || 5;
    const ROWS = totemRows(C, b.A);
    const cards = b.createCards(C * ROWS);
    return {
      update(u) {
        const dir = u.str('direction') === 'down' ? -1 : 1;
        const S = u.slotCount;
        const gap = u.num('gap') / 100;
        const cascade = (u.num('cascade') / 100) * 0.8;
        const cellW = (2 * u.A * (u.num('width') / 100)) / C;
        const [w0, h0] = u.dims(0);
        const pitch = (h0 / w0) * cellW * (1 - gap) + cellW * gap;
        const total = ROWS * pitch;
        const shift = Math.max(1, Math.floor(S / C));
        u.root.rotation.set(u.num('tilt') * DEG, u.num('angle') * DEG, 0, 'YXZ');
        for (let col = 0; col < C; col++) {
          const cd = col % 2 ? -dir : dir;
          // Columns scroll through every slot once per loop.
          const s = u.advance(u.p * S - col * cascade) * cd;
          const k0 = Math.floor(s);
          for (let r = 0; r < ROWS; r++) {
            const c = cards[col * ROWS + r];
            // Virtual row index nearest this pool card keeps slots periodic.
            const j = k0 + wrapSigned(r - k0, ROWS);
            const y = (j - s) * pitch;
            if (Math.abs(y) > total / 2) {
              c.group.visible = false;
              continue;
            }
            c.slot = mod(j + col * shift, S);
            const [w, h] = u.dims(c.slot);
            c.setSize(w, h);
            c.group.position.set((col - (C - 1) / 2) * cellW, -y, 0);
            c.group.scale.setScalar(fit(w, h, cellW * (1 - gap), pitch - cellW * gap));
            c.shade = 1 - 0.25 * Math.min(1, Math.abs(y) / 1.4);
          }
        }
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Parallax Totem: loosely scattered cards in several depth layers drifting
// vertically; deeper layers look smaller and slower.

export const parallaxTotem: TemplateDef = {
  id: 'parallax-totem',
  name: 'Parallax Totem',
  category: '3d',
  defaultSlots: 10,
  camera: 'perspective',
  defaults: { cardSize: 30, cardRatio: 'auto', easing: 'linear', motion: 'continuous', direction: 'up' },
  directions: UD,
  hide: ['motion'],
  params: [
    int('layers', 'Layers', 2, 4, 3),
    int('perLayer', 'Cards per layer', 3, 8, 5),
    num('depth', 'Layer depth', 20, 200, 80),
    num('spread', 'Horizontal spread', 20, 100, 75),
    int('speed', 'Cycles per loop', 1, 3, 1),
  ],
  structure: (p) => `${p.layers}|${p.perLayer}`,
  build(b) {
    const L = Number(b.params.layers) || 3;
    const M = Number(b.params.perLayer) || 5;
    const cards = b.createCards(L * M);
    return {
      update(u) {
        const dir = u.str('direction') === 'down' ? -1 : 1;
        const camZ = u.camera.position.z;
        const gapZ = (u.num('depth') / 100) * u.U;
        const spread = u.num('spread') / 100;
        const cycles = u.num('speed');
        for (let l = 0; l < L; l++) {
          const z = -l * gapZ;
          const k = (camZ - z) / camZ; // how much bigger the visible area is at this depth
          const [, hMax] = u.dims(0);
          // One period spans the visible height plus a card, so wrapping is offscreen.
          const period = Math.max(2 * k + hMax * 1.4, M * hMax * 0.75);
          const pitch = period / M;
          const off = dir * u.p * period * cycles;
          for (let m = 0; m < M; m++) {
            const i = l * M + m;
            const c = cards[i];
            const y = mod(m * pitch + off + hashRand(i, 41) * pitch * 0.4 + period / 2, period) - period / 2;
            // Alternate sides so each layer fills the width without stacking.
            const side = (m % 2 ? 1 : -1) * (0.25 + 0.75 * hashRand(i, 42));
            c.setSize(...u.dims(i));
            c.group.position.set(side * u.A * k * spread * 0.75, y, z);
            c.group.scale.setScalar(1 - 0.08 * l);
            c.shade = 1 - 0.2 * l;
            c.setOrder(100 - l * 10);
          }
        }
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Cover Ring Vertical: Cover Ring turned on its side; cards roll over a
// horizontal axis with the centre card enlarged.

const vRingCount = (n: number) => clamp(n, 5, 14);

export const coverRingVertical: TemplateDef = {
  id: 'cover-ring-vertical',
  name: 'Cover Ring Vertical',
  category: '3d',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 40, cardRatio: '4:3', easing: 'smooth', motion: 'stepped', direction: 'up' },
  directions: UD,
  params: [
    num('radius', 'Radius', 40, 200, 85),
    num('focus', 'Focus scale', 100, 160, 125),
    num('dim', 'Side dimming', 0, 100, 55),
    num('tilt', 'Tilt', -30, 30, 0, '°'),
  ],
  structure: (_p, n) => String(vRingCount(n)),
  build(b) {
    const N = vRingCount(b.slotCount);
    const cards = b.createCards(N);
    return {
      update(u) {
        const dir = u.str('direction') === 'down' ? -1 : 1;
        const s = dir * u.advance(u.p * N);
        const R = (u.num('radius') / 100) * u.U;
        const focus = u.num('focus') / 100 - 1;
        const dim = u.num('dim') / 100;
        u.root.rotation.y = u.num('tilt') * DEG;
        cards.forEach((c, i) => {
          const a = wrapSigned(i - s, N);
          const th = (a / N) * TAU;
          const near = Math.max(0, 1 - Math.abs(a));
          c.setSize(...u.dims(i));
          // Upcoming cards wait below and roll up over the front.
          c.group.position.set(0, -Math.sin(th) * R, Math.cos(th) * R - R + near * 0.05 * u.U);
          c.group.rotation.x = th;
          c.group.scale.setScalar(1 + focus * near);
          c.shade = 1 - (dim * (1 - Math.cos(th))) / 2;
        });
      },
    };
  },
};
