import type { TemplateDef } from './types';
import { LR, UD, multipleAtLeast } from './helpers';
import { clamp, DEG, fract, hashRand, mod, TAU } from '@/lib/math';
import { ease } from '@/engine/easing';

/** Cells that tile the whole frame with roughly square cells. */
function cellGrid(cols: number, A: number) {
  const rows = Math.max(1, Math.round(cols / A));
  return { rows, cw: (2 * A) / cols, ch: 2 / rows };
}

const ORDER_OPTIONS = [
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'random', label: 'Random' },
  { value: 'center', label: 'Center out' },
  { value: 'rows', label: 'Rows' },
];

/** 0..1 start offset for a grid cell in the chosen order. */
function cellDelay(order: string, r: number, c: number, rows: number, cols: number) {
  switch (order) {
    case 'random':
      return hashRand(r * cols + c, 31);
    case 'center': {
      const max = Math.hypot((rows - 1) / 2, (cols - 1) / 2);
      return max > 0 ? Math.hypot(r - (rows - 1) / 2, c - (cols - 1) / 2) / max : 0;
    }
    case 'rows':
      return rows * cols > 1 ? (r * cols + c) / (rows * cols - 1) : 0;
    default:
      return rows + cols > 2 ? (r + c) / (rows + cols - 2) : 0;
  }
}

function backOut(t: number, s: number) {
  const x = t - 1;
  return 1 + (s + 1) * x * x * x + s * x * x;
}

const cellParams = (def: number) =>
  ({ type: 'number', key: 'columns', label: 'Columns', min: 2, max: 6, step: 1, default: def, integer: true }) as const;

export const popGrid: TemplateDef = {
  id: 'pop-grid',
  name: 'Pop Grid',
  category: 'grid',
  defaultSlots: 12,
  camera: 'perspective',
  defaults: { cardSize: 88, cardRatio: '1:1', easing: 'smooth', motion: 'continuous', direction: 'diagonal' },
  directions: ORDER_OPTIONS,
  params: [
    { type: 'number', key: 'length', label: 'Pop length', min: 20, max: 90, step: 1, unit: '%', default: 45 },
    { type: 'number', key: 'stagger', label: 'Stagger', min: 0, max: 100, step: 1, unit: '%', default: 70 },
    { type: 'number', key: 'bounce', label: 'Bounce', min: 0, max: 100, step: 1, unit: '%', default: 50 },
    cellParams(3),
    { type: 'number', key: 'pops', label: 'Pops per loop', min: 1, max: 3, step: 1, default: 1, integer: true },
  ],
  structure: (p, _n, fr) => `${p.columns}|${cellGrid(Number(p.columns), fr.A).rows}`,
  build(b) {
    const cols = Number(b.params.columns);
    const { rows } = cellGrid(cols, b.A);
    const cards = b.createCards(cols * rows);
    return {
      update(u) {
        const { cw, ch } = cellGrid(cols, u.A);
        const cells = cols * rows;
        // Each cell cycles through `m` pages; whole pages per loop keep it seamless.
        const m = Math.max(2, Math.ceil(u.slotCount / cells));
        const W = m * u.num('pops');
        const L = u.num('length') / 100;
        const spread = (1 - L) * (u.num('stagger') / 100);
        const bounce = (u.num('bounce') / 100) * 2.4;
        const fill = u.num('cardSize') / 100;
        const order = u.str('direction');
        const easing = u.str('easing');
        cards.forEach((c, idx) => {
          const r = Math.floor(idx / cols);
          const col = idx % cols;
          const tt = u.p * W - cellDelay(order, r, col, rows, cols) * spread;
          const w = Math.floor(tt);
          const q = Math.min(1, (tt - w) / L);
          const page = mod(w + (q >= 0.5 ? 1 : 0), m);
          const sc = q < 0.5 ? 1 - ease(easing, q * 2) : backOut((q - 0.5) * 2, bounce);
          if (sc <= 0.001) {
            c.group.visible = false;
            return;
          }
          c.slot = idx + page * cells;
          const [dw, dh] = u.dims(c.slot);
          const fit = Math.min(cw / dw, ch / dh) * fill;
          c.setSize(dw * fit, dh * fit);
          c.group.position.set(-u.A + cw * (col + 0.5), 1 - ch * (r + 0.5), Math.max(0, sc - 1) * 0.2);
          c.group.scale.setScalar(sc);
          c.shade = 0.8 + 0.2 * Math.min(1, sc);
        });
      },
    };
  },
};

export const gridReveal: TemplateDef = {
  id: 'grid-reveal',
  name: 'Grid Reveal',
  category: 'grid',
  defaultSlots: 12,
  camera: 'perspective',
  defaults: { cardSize: 88, cardRatio: '1:1', easing: 'smooth', motion: 'continuous', direction: 'diagonal' },
  directions: ORDER_OPTIONS,
  params: [
    { type: 'number', key: 'stagger', label: 'Stagger', min: 0, max: 100, step: 1, unit: '%', default: 70 },
    { type: 'number', key: 'rise', label: 'Rise', min: 0, max: 100, step: 1, unit: '%', default: 40 },
    cellParams(3),
    { type: 'number', key: 'cycles', label: 'Cycles per loop', min: 1, max: 4, step: 1, default: 2, integer: true },
  ],
  structure: (p, _n, fr) => `${p.columns}|${cellGrid(Number(p.columns), fr.A).rows}`,
  build(b) {
    const cols = Number(b.params.columns);
    const { rows } = cellGrid(cols, b.A);
    const cards = b.createCards(cols * rows);
    return {
      update(u) {
        const { cw, ch } = cellGrid(cols, u.A);
        const cells = cols * rows;
        const x = u.p * u.num('cycles');
        const cycle = Math.floor(x);
        const f = x - cycle;
        const seg = 0.42;
        const dur = Math.max(0.04, seg * (1 - u.num('stagger') / 100));
        const rise = (u.num('rise') / 100) * ch * 0.5;
        const fill = u.num('cardSize') / 100;
        const order = u.str('direction');
        const easing = u.str('easing');
        cards.forEach((c, idx) => {
          const r = Math.floor(idx / cols);
          const col = idx % cols;
          const start = cellDelay(order, r, col, rows, cols) * (seg - dur);
          // The grid is empty at every cycle boundary, so page changes are never seen.
          const inE = ease(easing, clamp((f - start) / dur, 0, 1));
          const outE = ease(easing, clamp((f - (1 - seg) - start) / dur, 0, 1));
          const v = inE * (1 - outE);
          if (v <= 0.002) {
            c.group.visible = false;
            return;
          }
          c.slot = idx + cycle * cells;
          const [dw, dh] = u.dims(c.slot);
          const fit = Math.min(cw / dw, ch / dh) * fill;
          c.setSize(dw * fit, dh * fit);
          c.group.position.set(-u.A + cw * (col + 0.5), 1 - ch * (r + 0.5) - (1 - inE) * rise + outE * rise, 0);
          c.group.scale.setScalar(0.7 + 0.3 * v);
          c.opacity = v;
        });
      },
    };
  },
};

/** Items per masonry column: enough to cover the frame (plus tilt) at the shortest item height. */
function masonryPeriod(cols: number, A: number, n: number) {
  const colW = (2 * A) / cols;
  const minH = (colW / 1.7) * 0.7;
  const maxH = (colW / 0.6) * 1.3;
  return multipleAtLeast(n, Math.ceil((2.8 + maxH) / minH));
}

export const masonryScroll: TemplateDef = {
  id: 'masonry-scroll',
  name: 'Masonry Scroll',
  category: 'grid',
  defaultSlots: 12,
  camera: 'perspective',
  defaults: { cardSize: 92, cardRatio: 'auto', easing: 'linear', motion: 'continuous', direction: 'up' },
  directions: UD,
  params: [
    { type: 'number', key: 'columns', label: 'Columns', min: 2, max: 6, step: 1, default: 3, integer: true },
    { type: 'number', key: 'variation', label: 'Height variation', min: 0, max: 100, step: 1, unit: '%', default: 60 },
    { type: 'number', key: 'speed', label: 'Speed', min: 1, max: 3, step: 1, unit: 'x', default: 1, integer: true },
    { type: 'number', key: 'tilt', label: 'Tilt', min: 0, max: 45, step: 1, unit: '°', default: 0 },
    {
      type: 'segmented',
      key: 'pattern',
      label: 'Columns move',
      options: [
        { value: 'alternate', label: 'Alternate' },
        { value: 'together', label: 'Together' },
      ],
      default: 'alternate',
    },
  ],
  structure: (p, n, fr) => `${p.columns}|${masonryPeriod(Number(p.columns), fr.A, n)}`,
  build(b) {
    const cols = Number(b.params.columns);
    const P = masonryPeriod(cols, b.A, b.slotCount);
    const cards = b.createCards(cols * P);
    const hs = new Array<number>(P);
    const cum = new Array<number>(P);
    return {
      update(u) {
        const colW = (2 * u.A) / cols;
        const fill = u.num('cardSize') / 100;
        const w = colW * fill;
        const gap = Math.max(0.01, colW - w);
        const vary = (u.num('variation') / 100) * 0.3;
        const base = u.str('direction') === 'down' ? -1 : 1;
        const alternate = u.str('pattern') === 'alternate';
        const t = u.advance(u.p * P * u.num('speed')) / P;
        u.root.rotation.x = -u.num('tilt') * DEG;
        for (let c = 0; c < cols; c++) {
          let L = 0;
          for (let i = 0; i < P; i++) {
            const [dw, dh] = u.dims(i * cols + c);
            const ratio = clamp(dw / dh, 0.6, 1.7);
            const v = 1 + vary * (((i * 7 + c * 3) % 5) / 2 - 1);
            hs[i] = (w / ratio) * v;
            cum[i] = L;
            L += hs[i] + gap;
          }
          const cd = alternate && c % 2 === 1 ? -base : base;
          const o = cd * t * L + c * 0.37 * colW;
          for (let i = 0; i < P; i++) {
            const card = cards[c * P + i];
            const h = hs[i];
            const y = mod(1 - (cum[i] + h / 2) + o + L / 2, L) - L / 2;
            if (Math.abs(y) > 1.4 + h / 2) {
              card.group.visible = false;
              continue;
            }
            card.slot = i * cols + c;
            card.setSize(w, h);
            card.group.position.set(-u.A + colW * (c + 0.5), y, 0);
          }
        }
      },
    };
  },
};

function waveShape(cols: number, A: number) {
  const cell = (2 * A) / cols;
  const span = 2 * Math.sqrt(A * A + 1) * 1.5;
  return { cell, span, rows: Math.ceil(span / cell) + 1, perRow: Math.ceil(span / cell) + 3 };
}

export const waveGrid: TemplateDef = {
  id: 'wave-grid',
  name: 'Wave Grid',
  category: 'grid',
  defaultSlots: 12,
  camera: 'perspective',
  defaults: { cardSize: 86, cardRatio: '1:1', easing: 'linear', motion: 'continuous', direction: 'left' },
  directions: LR,
  params: [
    { type: 'number', key: 'columns', label: 'Columns', min: 3, max: 8, step: 1, default: 5, integer: true },
    { type: 'number', key: 'amplitude', label: 'Wave height', min: 0, max: 100, step: 1, unit: '%', default: 45 },
    { type: 'number', key: 'waves', label: 'Waves per loop', min: 1, max: 4, step: 1, default: 2, integer: true },
    { type: 'number', key: 'tilt', label: 'Tilt', min: 0, max: 60, step: 1, unit: '°', default: 38 },
  ],
  structure: (p, n) => `${p.columns}|${n}`,
  build(b) {
    const cols = Number(b.params.columns);
    const { rows, perRow } = waveShape(cols, b.A);
    const M = multipleAtLeast(b.slotCount, perRow);
    const cards = b.createCards(rows * M);
    return {
      update(u) {
        const { cell, span } = waveShape(cols, u.A);
        const fill = u.num('cardSize') / 100;
        const dir = u.str('direction') === 'right' ? 1 : -1;
        const s = dir * u.advance(u.p * u.slotCount);
        const amp = (u.num('amplitude') / 100) * cell * 0.9;
        const W = u.num('waves');
        u.root.rotation.x = -u.num('tilt') * DEG;
        const limit = span / 2 + cell;
        cards.forEach((c, i) => {
          const r = Math.floor(i / M);
          const k = i % M;
          const x = (mod(k + s, M) - M / 2) * cell;
          if (Math.abs(x) > limit) {
            c.group.visible = false;
            return;
          }
          const y = ((rows - 1) / 2 - r) * cell;
          // Phase depends only on position and whole wave cycles, so the loop is seamless.
          const phase = TAU * W * u.p - ((x * 0.9 + y * 0.6) / cell) * 0.9;
          c.slot = k + r * 3;
          const [w, h] = u.dims(c.slot);
          const sc = (cell * fill) / Math.max(w, h);
          c.setSize(w * sc, h * sc);
          c.group.position.set(x, y, amp * Math.sin(phase));
          c.group.rotation.x = amp > 0 ? Math.cos(phase) * 0.25 * (amp / cell) : 0;
          c.shade = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(phase));
        });
      },
    };
  },
};

function gridShape(cols: number, A: number) {
  const cellW = (2 * A) / cols;
  const rows = Math.max(1, Math.round(2 / cellW));
  return { cellW, cellH: 2 / rows, rows };
}

export const flipGrid: TemplateDef = {
  id: 'flip-grid',
  name: 'Flip Grid',
  category: 'grid',
  defaultSlots: 12,
  camera: 'perspective',
  defaults: { cardSize: 94, cardRatio: '1:1', easing: 'smooth', motion: 'stepped', direction: 'horizontal' },
  directions: [
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'vertical', label: 'Vertical' },
  ],
  params: [
    { type: 'number', key: 'columns', label: 'Columns', min: 2, max: 6, step: 1, default: 3, integer: true },
    { type: 'number', key: 'stagger', label: 'Flip stagger', min: 0, max: 100, step: 1, unit: '%', default: 60 },
  ],
  structure: (p) => String(p.columns),
  build(b) {
    const cols = Number(b.params.columns);
    const { rows } = gridShape(cols, b.A);
    const cards = b.createCards(cols * rows);
    return {
      update(u) {
        const { cellW, cellH } = gridShape(cols, u.A);
        const fill = u.num('cardSize') / 100;
        const vertical = u.str('direction') === 'vertical';
        const stepped = u.str('motion') === 'stepped';
        const easing = u.str('easing');
        const x = u.p * u.slotCount;
        const k = Math.floor(x);
        const f = fract(x);
        const window = stepped ? 0.6 : 1;
        const stg = (u.num('stagger') / 100) * 0.7 * window;
        const span = Math.max(1, rows + cols - 2);
        cards.forEach((c, i) => {
          const r = Math.floor(i / cols);
          const col = i % cols;
          const delay = ((r + col) / span) * stg + (1 - window);
          const local = clamp((f - delay) / (window - stg), 0, 1);
          const angle = ease(easing, local) * Math.PI;
          const flipped = angle > Math.PI / 2;
          c.slot = i + k + (flipped ? 1 : 0);
          const rot = flipped ? angle - Math.PI : angle;
          c.setSize(cellW * fill, cellH * fill);
          c.group.position.set(-u.A + cellW * (col + 0.5), 1 - cellH * (r + 0.5), 0);
          if (vertical) c.group.rotation.x = rot;
          else c.group.rotation.y = rot;
          c.shade = 1 - 0.45 * Math.sin(angle);
        });
      },
    };
  },
};

function tickerShape(cols: number, A: number) {
  const cell = ((2 * A) / cols) * 1.1;
  const diag = 2 * Math.sqrt(A * A + 1) * 1.15;
  const rows = Math.ceil(diag / cell) + 1;
  const perRow = Math.ceil(diag / cell) + 4;
  return { cell, diag, rows, perRow };
}

export const tickerTilt: TemplateDef = {
  id: 'ticker-tilt',
  name: 'Ticker Tilt',
  category: 'grid',
  defaultSlots: 12,
  camera: 'perspective',
  defaults: { cardSize: 90, cardRatio: '1:1', easing: 'linear', motion: 'continuous', direction: 'left' },
  directions: LR,
  params: [
    { type: 'number', key: 'angle', label: 'Tilt angle', min: -45, max: 45, step: 1, unit: '°', default: -16 },
    { type: 'number', key: 'columns', label: 'Columns', min: 2, max: 8, step: 1, default: 4, integer: true },
    { type: 'number', key: 'speed', label: 'Speed', min: 1, max: 3, step: 1, unit: 'x', default: 1, integer: true },
    { type: 'number', key: 'depthTilt', label: 'Perspective', min: 0, max: 45, step: 1, unit: '°', default: 18 },
  ],
  structure: (p, n) => `${p.columns}|${n}`,
  build(b) {
    const cols = Number(b.params.columns);
    const { rows, perRow } = tickerShape(cols, b.A);
    const M = multipleAtLeast(b.slotCount, perRow);
    const cards = b.createCards(rows * M);
    return {
      update(u) {
        const { cell, diag } = tickerShape(cols, u.A);
        const fill = u.num('cardSize') / 100;
        const dir = u.str('direction') === 'right' ? 1 : -1;
        const s = u.advance(u.p * u.slotCount * u.num('speed'));
        u.root.rotation.z = u.num('angle') * DEG;
        u.root.rotation.x = -u.num('depthTilt') * DEG;
        const limit = diag / 2 + cell;
        cards.forEach((c, i) => {
          const r = Math.floor(i / M);
          const k = i % M;
          const rd = r % 2 === 0 ? dir : -dir;
          const x = (mod(k + rd * s + r * 0.35, M) - M / 2) * cell;
          if (Math.abs(x) > limit) {
            c.group.visible = false;
            return;
          }
          c.slot = k + r * 5;
          const [w, h] = u.dims(c.slot);
          const sc = (cell * fill) / Math.max(w, h);
          c.setSize(w * sc, h * sc);
          c.group.position.set(x, ((rows - 1) / 2 - r) * cell, 0);
        });
      },
    };
  },
};
