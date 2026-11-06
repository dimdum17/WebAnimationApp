import type { NumberParam, TemplateDef } from './types';
import { clamp, mod, TAU } from '@/lib/math';
import { ease } from '@/engine/easing';
import { applyPose, fit, pose } from './scenes';

/*
 * Bento templates: cards of different sizes tiled into one rounded mosaic.
 * Layouts are described on a unit grid (see BentoLayout) so more card counts
 * can be added later by just supplying another rect list.
 */

/** [col, row, colSpan, rowSpan] on the layout's unit grid. */
type Rect = [number, number, number, number];

interface BentoLayout {
  cols: number;
  rows: number;
  rects: Rect[];
}

/** Seven cards on a 3 x 4 grid: two short rows plus one double-height row. */
const BENTO_7: BentoLayout = {
  cols: 3,
  rows: 4,
  rects: [
    [0, 0, 1, 1], // wide-ish top left
    [1, 0, 1, 2], // tall centre
    [2, 0, 1, 1], // top right
    [0, 1, 1, 1], // text-like block under the first
    [2, 1, 1, 1], // accent block under top right
    [0, 2, 1, 2], // tall bottom left
    [1, 2, 2, 2], // large bottom right
  ],
};

/** Three cards: one wide on top, two below. */
const BENTO_3: BentoLayout = {
  cols: 2,
  rows: 5,
  rects: [
    [0, 0, 2, 2],
    [0, 2, 1, 3],
    [1, 2, 1, 3],
  ],
};

/** Six cards on a 4 x 2 grid: wide + two small on top, two small + wide below. */
const BENTO_6: BentoLayout = {
  cols: 4,
  rows: 2,
  rects: [
    [0, 0, 2, 1],
    [2, 0, 1, 1],
    [3, 0, 1, 1],
    [0, 1, 1, 1],
    [1, 1, 1, 1],
    [2, 1, 2, 1],
  ],
};

/** Eight cards on a 4 x 6 grid: stacked pairs on the left, wide blocks on the right. */
const BENTO_8: BentoLayout = {
  cols: 4,
  rows: 6,
  rects: [
    [0, 0, 1, 2], // tall top left
    [0, 2, 1, 1], // short under it
    [1, 0, 1, 1], // top small
    [1, 1, 1, 2], // tall under the small one
    [2, 0, 2, 3], // large top right
    [0, 3, 1, 3], // tall bottom left
    [1, 3, 1, 3], // tall bottom centre
    [2, 3, 2, 3], // large bottom right
  ],
};

/** Nine cards on a 10 x 15 fine grid, with two tall blocks on the right edge. */
const BENTO_9: BentoLayout = {
  cols: 10,
  rows: 15,
  rects: [
    [0, 0, 3, 5], // coupon-like block
    [3, 0, 2, 5],
    [5, 0, 2, 5],
    [7, 0, 3, 7], // tall top right
    [0, 5, 3, 5],
    [3, 5, 4, 5], // wide centre
    [0, 10, 4, 5],
    [4, 10, 3, 5],
    [7, 7, 3, 8], // tall bottom right
  ],
};

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Cell rectangles in world units, filling the frame (padding is applied by the renderer). */
function layoutCells(L: BentoLayout, A: number, gap: number): Cell[] {
  const cw = (2 * A - (L.cols - 1) * gap) / L.cols;
  const ch = (2 - (L.rows - 1) * gap) / L.rows;
  return L.rects.map(([c, r, cs, rs]) => {
    const w = cs * cw + (cs - 1) * gap;
    const h = rs * ch + (rs - 1) * gap;
    return { x: -A + c * (cw + gap) + w / 2, y: 1 - r * (ch + gap) - h / 2, w, h };
  });
}

/** Tour order through the mosaic (cell indices): tall centre, big block, then the rest. */
const TOUR_7 = [1, 6, 5, 0, 2, 4];
const TOUR_3 = [0, 1, 2];
const TOUR_6 = [0, 5, 2, 4, 1, 3];
const TOUR_8 = [4, 7, 0, 5, 2, 6];
const TOUR_9 = [5, 3, 8, 0, 6, 4];

type Seg =
  | { k: 'grid' | 'dive' | 'blackout' | 'enter'; w: number }
  | { k: 'stop' | 'pan'; i: number; w: number }
  | { k: 'in' | 'hold' | 'out'; r: number; w: number };

const pctParam = (key: string, label: string, min: number, max: number, def: number): NumberParam => ({
  type: 'number',
  key,
  label,
  min,
  max,
  step: 1,
  unit: '%',
  default: def,
});
const intParam = (key: string, label: string, min: number, max: number, def: number): NumberParam => ({
  type: 'number',
  key,
  label,
  min,
  max,
  step: 1,
  default: def,
  integer: true,
});

/*
 * Bento —  Grid Dive style, starting and ending on the full mosaic:
 * 1. the bento mosaic holds;
 * 2. the camera dives into one block, then tours the others in eased pans
 *    (pulling back slightly on long jumps);
 * 3. on the last stop the neighbours blow outward and fade, leaving one block;
 * 4. single blocks rise through the frame (with small companions peeking in);
 * 5. the whole mosaic slides back in from the bottom.
 */
function makeBento(id: string, name: string, L: BentoLayout, tour: number[]): TemplateDef {
  const count = L.rects.length;
  return {
  id,
  name,
  category: 'bento',
  defaultSlots: count,
  camera: 'perspective',
  fov: 30,
  defaults: { cardSize: 100, cardRatio: '1:1', easing: 'smooth', motion: 'continuous', direction: '' },
  directions: [],
  hide: ['cardSize', 'cardRatio', 'motion'],
  params: [
    pctParam('gap', 'Gap', 0, 10, 3),
    pctParam('zoom', 'Dive zoom', 50, 100, 88),
    intParam('stops', 'Tour stops', 2, Math.min(6, count), Math.min(4, count)),
    intParam('reel', 'Solo cards', 0, 3, Math.min(2, count - 1)),
    pctParam('hold', 'Hold', 0, 100, 50),
    pctParam('stagger', 'Entry stagger', 0, 100, 50),
    pctParam('drift', 'Image drift', 0, 100, 30),
  ],
  build(b) {
    const cards = b.createCards(L.rects.length);
    const N = cards.length;
    return {
      update(u) {
        const easing = u.str('easing');
        const E = (t: number) => ease(easing, clamp(t, 0, 1));
        const cubicIn = (t: number) => t * t * t;
        const cubicOut = (t: number) => 1 - (1 - t) ** 3;
        const gap = (u.num('gap') / 100) * 2;
        const cells = layoutCells(L, u.A, gap);
        const zf = u.num('zoom') / 100;
        const H = 0.2 + 1.6 * (u.num('hold') / 100);
        const stops = Math.min(u.num('stops'), tour.length);
        const reelN = u.num('reel');
        const stagger = u.num('stagger') / 100;
        const drift = u.num('drift') / 100;

        const stopPos = (i: number): [number, number] => [cells[tour[i]].x, cells[tour[i]].y];
        const stopZoom = (i: number) => {
          const c = cells[tour[i]];
          return Math.max(1, fit(c.w, c.h, 2 * u.A * zf, 2 * zf));
        };

        const segs: Seg[] = [
          { k: 'grid', w: 1.1 * H },
          { k: 'dive', w: 0.75 },
          { k: 'stop', i: 0, w: 0.5 * H },
        ];
        for (let i = 1; i < stops; i++) segs.push({ k: 'pan', i, w: 0.7 }, { k: 'stop', i, w: 0.45 * H });
        segs.push({ k: 'blackout', w: 0.4 });
        for (let r = 0; r < reelN; r++) {
          segs.push({ k: 'in', r, w: 0.45 }, { k: 'hold', r, w: 0.5 * H }, { k: 'out', r, w: 0.32 });
        }
        segs.push({ k: 'enter', w: 0.9 });

        const total = segs.reduce((a, s) => a + s.w, 0);
        let acc = (u.p - Math.floor(u.p)) * total;
        let si = 0;
        while (si < segs.length - 1 && acc >= segs[si].w) acc -= segs[si++].w;
        const seg = segs[si];
        const lt = clamp(acc / seg.w, 0, 1);

        const heroCell = tour[stops - 1];
        let cx = 0;
        let cy = 0;
        let Z = 1;
        if (seg.k === 'dive') {
          const e = E(lt);
          const [tx, ty] = stopPos(0);
          Z = Math.pow(stopZoom(0), e);
          cx = tx * e;
          cy = ty * e;
        } else if (seg.k === 'stop') {
          [cx, cy] = stopPos(seg.i);
          Z = stopZoom(seg.i) * (1 + 0.02 * lt);
        } else if (seg.k === 'pan') {
          const [x0, y0] = stopPos(seg.i - 1);
          const [x1, y1] = stopPos(seg.i);
          const e = E(lt);
          cx = x0 + (x1 - x0) * e;
          cy = y0 + (y1 - y0) * e;
          const z0 = stopZoom(seg.i - 1) * 1.02;
          const z1 = stopZoom(seg.i);
          const dist = Math.hypot(x1 - x0, y1 - y0);
          const dip = dist > 1.2 ? 0.28 : 0.1;
          Z = Math.max(1, (z0 + (z1 - z0) * e) * (1 - dip * Math.sin(lt * Math.PI)));
        } else if (seg.k === 'blackout') {
          [cx, cy] = stopPos(stops - 1);
          Z = stopZoom(stops - 1) * 1.02;
        }

        // Slow image drift; identical at p = 0 and 1.
        const setDrift = (c: (typeof cards)[number], cell: { w: number; h: number }, i: number) => {
          if (drift <= 0) return;
          const z = 1 + drift * 0.14 * (0.5 - 0.5 * Math.cos(TAU * u.p));
          const sz = 1 / z;
          const room = (1 - sz) / 2;
          const ph = TAU * u.p + i * 2.1;
          c.setFrame(room + room * Math.sin(ph) * 0.8, room + room * Math.cos(ph) * 0.8, sz, sz, cell.w / cell.h);
        };

        const mosaic = seg.k === 'grid' || seg.k === 'dive' || seg.k === 'stop' || seg.k === 'pan' || seg.k === 'enter' || seg.k === 'blackout';
        if (mosaic) {
          cards.forEach((c, i) => {
            const cell = cells[i];
            c.setSize(cell.w, cell.h);
            setDrift(c, cell, i);
            let x = (cell.x - cx) * Z;
            let y = (cell.y - cy) * Z;
            let s = Z;
            let o = 1;
            if (seg.k === 'enter') {
              // Blocks rise into place from below, staggered in reading order.
              const d = N > 1 ? i / (N - 1) : 0;
              const e = cubicOut(clamp((lt - d * stagger * 0.5) / (1 - stagger * 0.5), 0, 1));
              y += -2.3 * (1 - e);
            } else if (seg.k === 'blackout') {
              if (i === heroCell) {
                o = 1 - clamp((lt - 0.55) / 0.45, 0, 1);
                s *= 1 + 0.05 * lt;
              } else {
                // Neighbours blow outward from the hero block and fade.
                const e = cubicIn(lt);
                const dx = cell.x - cells[heroCell].x;
                const dy = cell.y - cells[heroCell].y;
                const len = Math.hypot(dx, dy) || 1;
                x += (dx / len) * e * 1.6 * Z;
                y += (dy / len) * e * 1.6 * Z;
                s *= 1 - 0.25 * e;
                o = 1 - clamp(lt * 1.5, 0, 1);
              }
            }
            applyPose(c, pose({ x, y, s, o, order: i === heroCell ? 10 : 0 }));
          });
          return;
        }

        // Solo reel: one block at a time rises through, with small companions.
        for (const c of cards) c.group.visible = false;
        const r = (seg as { r: number }).r;
        const place = (idx: number, x: number, y: number, box: number, order: number) => {
          const ci = mod(idx, N);
          const c = cards[ci];
          const cell = cells[ci];
          c.group.visible = true;
          c.setSize(cell.w, cell.h);
          setDrift(c, cell, ci);
          applyPose(c, pose({ x, y, s: fit(cell.w, cell.h, 2 * u.A * box, 2 * box), order }));
        };
        const offY = 1.35;
        const mainX = r === 0 ? 0 : -0.14 * u.A;
        const mainBox = r === 0 ? 0.76 : 0.74;
        let y = 0;
        let box = mainBox;
        if (seg.k === 'in') {
          const e = cubicOut(lt);
          y = -offY * (1 - e);
          box = mainBox * (0.92 + 0.08 * e);
        } else if (seg.k === 'hold') {
          y = 0.03 * lt;
        } else {
          y = 0.03 + offY * cubicIn(lt);
        }
        const mainIdx = heroCell + 1 + r * 3;
        place(mainIdx, mainX, y, box, 20);
        if (r >= 1) place(mainIdx + 1, 0.78 * u.A, y * 0.65 - 0.42, 0.22, 15);
        if (r >= 2) place(mainIdx + 2, -0.96 * u.A, y * 0.5 + 0.58, 0.22, 12);
      },
    };
  },
}; }

export const bento3 = makeBento('bento-3', 'Bento 3', BENTO_3, TOUR_3);
export const bento6 = makeBento('bento-6', 'Bento 6', BENTO_6, TOUR_6);
export const bento7 = makeBento('bento-7', 'Bento 7', BENTO_7, TOUR_7);
export const bento8 = makeBento('bento-8', 'Bento 8', BENTO_8, TOUR_8);
export const bento9 = makeBento('bento-9', 'Bento 9', BENTO_9, TOUR_9);
