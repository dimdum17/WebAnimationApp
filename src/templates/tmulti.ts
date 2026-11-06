import type { NumberParam, TemplateDef, UpdateCtx } from './types';
import { CW, LR, multipleAtLeast, wrapSigned } from './helpers';
import { clamp, DEG, hashRand, mod, TAU } from '@/lib/math';
import { ease } from '@/engine/easing';
import { applyPose, backOut, blend, fit, fitGrid, gridPos, pose, runScenes, type Layout, type Morph, type Pose } from './scenes';

/*
 * Multiscene templates: each one plays two to four layouts in sequence and
 * blends between them (see scenes.ts). Every template exposes only the
 * controls it actually uses.
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
const int = (key: string, label: string, min: number, max: number, def: number): NumberParam => ({
  type: 'number',
  key,
  label,
  min,
  max,
  step: 1,
  default: def,
  integer: true,
});
const transition = (def = 35) => num('transition', 'Transition', 10, 70, def);
const stagger = (def = 40) => num('stagger', 'Stagger', 0, 100, def);

const pct = (u: UpdateCtx, key: string) => u.num(key) / 100;
const range = (lo: number, hi: number) => (n: number) => clamp(n, lo, hi);
const center = (i: number, N: number) => i - (N - 1) / 2;

// ---------------------------------------------------------------------------

const flybyN = range(6, 12);

/*
 * Flyby Rolodex — five beats modelled on the reference recording:
 * 1. hero: a single card holds in the centre;
 * 2. flyby: the camera pans sideways in eased steps across a scattered,
 *    depth-layered collage, pausing on each featured card;
 * 3. column: everything snaps into a narrow vertical strip scrolling upward;
 * 4. stack: the strip collapses into a front-facing deck that pushes in;
 * 5. rolodex: big cards hinged on their bottom edge fall toward the viewer
 *    one at a time, cycling the whole deck back to the hero card.
 */
export const flybyRolodex: TemplateDef = {
  id: 'flyby-rolodex',
  name: 'Flyby Rolodex',
  category: 'multiscene',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 40, cardRatio: '4:5', easing: 'smooth', motion: 'continuous', direction: '' },
  directions: [],
  hide: ['motion', 'cardSize'],
  params: [
    num('hero', 'Hero size', 40, 90, 70),
    num('spread', 'Flyby spread', 40, 150, 90),
    num('depth', 'Flyby depth', 0, 100, 50),
    num('column', 'Column width', 12, 45, 24),
    num('scroll', 'Column scroll', 0, 100, 35),
    num('size', 'Rolodex size', 50, 100, 85),
    num('lean', 'Rolodex lean', 0, 30, 10, '°'),
    transition(30),
  ],
  structure: (_p, n) => String(flybyN(n)),
  build(b) {
    const cards = b.createCards(flybyN(b.slotCount));
    const N = cards.length;
    return {
      update(u) {
        const easing = u.str('easing');
        // Eased steps: move during the first 65% of each step, then hold.
        const steps = (x: number) => {
          const k = Math.floor(x);
          return k + ease(easing, clamp((x - k) / 0.65, 0, 1));
        };
        const A = u.A;
        const heroFr = pct(u, 'hero');
        const sizeFr = pct(u, 'size');
        const lean = u.num('lean') * DEG;
        const depth = pct(u, 'depth') * 1.6;
        const big = (i: number, fr: number) => {
          const [w, h] = u.dims(i);
          return fit(w, h, 2 * A * fr, 2 * fr);
        };

        // 2. Flyby: even cards ride the centre line, odd ones sit above/below
        //    and further back, so the pan gets natural parallax.
        const [w0, h0] = u.dims(0);
        const featS = fit(w0, h0, 2 * A * 0.5, 1.1);
        const pitch = w0 * featS * 0.62 * pct(u, 'spread');
        const stops = Math.max(1, Math.floor((N - 1) / 2));
        const flyby: Layout = (i, t) => {
          const [w, h] = u.dims(i);
          const pan = steps(t * stops) * 2;
          const odd = i % 2 === 1;
          const s = fit(w, h, 2 * A * 0.5, 1.1) * (odd ? 0.55 + 0.15 * hashRand(i, 21) : 1);
          const side = i % 4 === 1 ? 1 : -1;
          return pose({
            x: (i - pan) * pitch,
            y: odd ? side * (0.5 + 0.2 * hashRand(i, 22)) : (hashRand(i, 23) - 0.5) * 0.12,
            z: odd ? -depth * (0.4 + 0.6 * hashRand(i, 24)) : 0,
            s,
            order: odd ? 0 : 10,
          });
        };

        // 1. Hero: card 0 alone; the rest wait invisibly at their flyby spots.
        const hero: Layout = (i) => (i === 0 ? pose({ s: big(0, heroFr), order: 20 }) : { ...flyby(i, 0), o: 0 });

        // 3. Column: a narrow strip scrolling upward, ending on card 0 centred.
        const colW = pct(u, 'column') * 2 * A;
        const colPitch = (h0 / w0) * colW + colW * 0.06;
        const colTotal = N * colPitch;
        const travel = pct(u, 'scroll') * N;
        // Card i sits i pitches below the scroll head, which rises over time.
        const column: Layout = (i, t) => {
          const [w] = u.dims(i);
          const y = mod((-(1 - t) * travel - i) * colPitch + colTotal / 2, colTotal) - colTotal / 2;
          return pose({ y, s: colW / w, o: clamp((colTotal / 2 - Math.abs(y)) / (colPitch * 0.5), 0, 1) });
        };

        // 4. Stack: front-facing deck, top edges peeking, pushing in.
        const stack: Layout = (i, t) => {
          const peek = 0.045 * (1 - 0.6 * t);
          return pose({
            y: i * peek - 0.05,
            z: -i * 0.01,
            s: big(i, sizeFr * 0.82) * (1 + 0.14 * t) * (1 - i * 0.015),
            shade: 1 - 0.05 * i,
            o: i < 7 ? 1 : 0,
            order: 100 - i,
          });
        };

        // 5. Rolodex: shared hinge under the front card. `d` is a card's place
        //    in the deck (0 = front); d in [-1, 0) means it is falling forward.
        const rS = big(0, sizeFr);
        const pivotY = -((h0 * rS) / 2) * Math.cos(lean);
        const fallEnd = Math.PI * 0.8;
        const rolodex: Layout = (i, t) => {
          const [, h] = u.dims(i);
          const s = big(i, sizeFr);
          const f = steps(t * N);
          const d = mod(i - f + 1, N) - 1;
          let th: number;
          let o = 1;
          let order: number;
          let shade: number;
          if (d < 0) {
            const q = -d;
            th = -lean + q * (fallEnd + lean);
            o = 1 - clamp((q - 0.7) / 0.3, 0, 1);
            order = 200;
            shade = 1 - 0.45 * Math.sin(Math.min(q, 1) * Math.PI * 0.5);
          } else {
            th = -lean - Math.min(d, 4) * 0.09;
            o = clamp(N - 1 - d, 0, 1) * (d < 5 ? 1 : 0);
            order = 100 - d;
            shade = 1 - 0.12 * Math.min(d, 4);
          }
          const r = (h * s) / 2;
          return pose({ y: pivotY + r * Math.cos(th), z: r * Math.sin(th) - Math.min(Math.max(d, 0), 4) * 0.01, rx: th, s, o, shade, order });
        };

        runScenes(cards, u, [hero, flyby, column, stack, rolodex], {
          transition: pct(u, 'transition'),
          weights: [0.5, 2.6, 2.2, 0.9, 0.45 * N],
        });
      },
    };
  },
};

// ---------------------------------------------------------------------------

const bloomN = range(6, 14);

export const bloomBelt: TemplateDef = {
  id: 'bloom-belt',
  name: 'Bloom Belt',
  category: 'multiscene',
  defaultSlots: 10,
  camera: 'perspective',
  defaults: { cardSize: 30, cardRatio: '3:4', easing: 'smooth', motion: 'continuous', direction: 'left' },
  directions: LR,
  hide: ['motion'],
  params: [
    num('bloom', 'Bloom radius', 10, 120, 45),
    num('gap', 'Belt gap', 0, 60, 12),
    num('tilt', 'Belt tilt', -30, 30, -12, '°'),
    stagger(40),
    transition(40),
  ],
  structure: (_p, n) => String(bloomN(n)),
  build(b) {
    const cards = b.createCards(bloomN(b.slotCount));
    const N = cards.length;
    return {
      update(u) {
        const R = pct(u, 'bloom') * u.U;
        const dir = u.str('direction') === 'right' ? -1 : 1;
        const tilt = u.num('tilt') * DEG;
        const [w0] = u.dims(0);
        const pitch = w0 * (1 + pct(u, 'gap'));
        const total = N * pitch;
        const bloom: Layout = (i, t) => {
          const th = (i / N) * TAU + t * 0.8;
          const [, h] = u.dims(i);
          const r = R * (0.75 + 0.25 * Math.sin(t * Math.PI)) + h * 0.4;
          return pose({ x: Math.cos(th) * r, y: Math.sin(th) * r, z: i * 0.002, rz: th - Math.PI / 2, s: 0.8 });
        };
        const belt: Layout = (i, t) => {
          const x = mod(i * pitch - dir * t * total * 0.5 + total / 2, total) - total / 2;
          return pose({
            x: x * Math.cos(tilt),
            y: x * Math.sin(tilt),
            rz: tilt,
            o: clamp((total / 2 - Math.abs(x)) / (pitch * 0.5), 0, 1),
          });
        };
        runScenes(cards, u, [bloom, belt], { transition: pct(u, 'transition'), stagger: pct(u, 'stagger') });
      },
    };
  },
};

// ---------------------------------------------------------------------------

const lensN = range(5, 12);

export const lensOrbit: TemplateDef = {
  id: 'lens-orbit',
  name: 'Lens Orbit',
  category: 'multiscene',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 34, cardRatio: '4:5', easing: 'smooth', motion: 'continuous', direction: 'left' },
  directions: LR,
  hide: ['motion'],
  params: [
    num('lens', 'Lens zoom', 100, 220, 160),
    num('width', 'Orbit width', 40, 150, 85),
    num('orbitTilt', 'Orbit tilt', 0, 80, 55, '°'),
    {
      type: 'select',
      key: 'style',
      label: 'Transition style',
      options: [
        { value: 'morph', label: 'Morph' },
        { value: 'swirl', label: 'Swirl' },
        { value: 'flip', label: 'Flip' },
        { value: 'burst', label: 'Burst' },
      ],
      default: 'morph',
    },
    transition(35),
  ],
  structure: (_p, n) => String(lensN(n)),
  build(b) {
    const cards = b.createCards(lensN(b.slotCount));
    const N = cards.length;
    return {
      update(u) {
        const lens = pct(u, 'lens');
        const dir = u.str('direction') === 'right' ? -1 : 1;
        const Rw = pct(u, 'width') * u.U;
        const tilt = u.num('orbitTilt') * DEG;
        const [w0] = u.dims(0);
        const pitch = w0 * 0.7;
        // A row of cards sliding under a magnifying lens at the centre.
        const row: Layout = (i, t) => {
          const x = center(i, N) * pitch - dir * (t - 0.5) * pitch * 2;
          const d = Math.abs(x) / (pitch * 1.6);
          const m = 1 + (lens - 1) * Math.max(0, 1 - d * d);
          const k = lens > 1 ? (m - 1) / (lens - 1) : 0;
          return pose({ x, z: (m - 1) * 0.25, s: 0.7 * m, shade: 0.7 + 0.3 * k, order: 10 * m });
        };
        const orbit: Layout = (i, t) => {
          const th = (i / N) * TAU + dir * t * Math.PI;
          const front = Math.cos(th);
          return pose({
            x: Math.sin(th) * Rw,
            y: -front * Rw * Math.sin(tilt) * 0.6,
            z: front * Rw * Math.cos(tilt) * 0.6,
            s: 0.7,
            shade: 0.55 + 0.45 * ((front + 1) / 2),
          });
        };
        const style = u.str('style');
        const arc = (t: number) => Math.sin(clamp(t, 0, 1) * Math.PI);
        let morph: Morph | undefined;
        let stg = 0;
        if (style === 'swirl') {
          // Cards spiral one full turn around the vertical axis into place.
          stg = 0.35;
          morph = (a, b, t) => {
            const P = blend(a, b, t);
            const angA = Math.atan2(a.x, a.z);
            const raw = Math.atan2(b.x, b.z) - angA;
            const ang = angA + (raw - TAU * Math.round(raw / TAU) + dir * TAU) * t;
            const r = Math.hypot(a.x, a.z) + (Math.hypot(b.x, b.z) - Math.hypot(a.x, a.z)) * t;
            // Cards turn with the sweep so they face the spiral's direction.
            return { ...P, x: Math.sin(ang) * r, z: Math.cos(ang) * r, ry: P.ry + dir * TAU * t };
          };
        } else if (style === 'flip') {
          // Each card hops forward and turns a full revolution, one after another.
          stg = 0.5;
          morph = (a, b, t) => {
            const P = blend(a, b, t);
            const h = arc(t);
            return { ...P, z: P.z + h * 0.35 * u.U, ry: P.ry + dir * TAU * t, s: P.s * (1 + 0.15 * h) };
          };
        } else if (style === 'burst') {
          // Cards blow outward through the lens, then regroup.
          stg = 0.2;
          morph = (a, b, t) => {
            const P = blend(a, b, t);
            const h = arc(t);
            const push = 1 + 0.9 * h;
            return {
              ...P,
              x: P.x * push,
              y: P.y * push + (P.x >= 0 ? 1 : -1) * h * 0.12 * u.U,
              z: P.z + h * 0.5 * u.U,
              rz: P.rz + (P.x >= 0 ? -1 : 1) * h * 0.35,
              s: P.s * (1 + 0.3 * h),
              shade: P.shade * (1 - 0.15 * h),
              order: P.order + h * 20,
            };
          };
        }
        runScenes(cards, u, [row, orbit], { transition: pct(u, 'transition'), stagger: stg, morph });
      },
    };
  },
};

// ---------------------------------------------------------------------------

const stairN = range(6, 12);

export const stairway: TemplateDef = {
  id: 'stairway',
  name: 'Stairway',
  category: 'multiscene',
  defaultSlots: 9,
  camera: 'perspective',
  defaults: { cardSize: 34, cardRatio: '1:1', easing: 'smooth', motion: 'continuous', direction: 'up-right' },
  directions: [
    { value: 'up-right', label: 'Up-right' },
    { value: 'up-left', label: 'Up-left' },
  ],
  hide: ['motion'],
  params: [
    num('step', 'Step height', 0, 60, 22),
    num('depth', 'Step depth', 0, 100, 45),
    num('gap', 'Grid gap', 0, 40, 10),
    stagger(50),
    transition(40),
  ],
  structure: (_p, n) => String(stairN(n)),
  build(b) {
    const cards = b.createCards(stairN(b.slotCount));
    const N = cards.length;
    return {
      update(u) {
        const sx = u.str('direction') === 'up-left' ? -1 : 1;
        const step = pct(u, 'step');
        const depth = pct(u, 'depth') * 0.3 * u.U;
        const gap = pct(u, 'gap');
        const [w0, h0] = u.dims(0);
        const g = fitGrid(N, u.A, w0, h0, gap);
        // Cards climb a diagonal staircase that recedes into depth.
        const stairs: Layout = (i, t) => {
          const [w, h] = u.dims(i);
          const k = center(i, N) + (0.5 - t) * 2;
          return pose({
            x: k * w * 0.5 * sx,
            y: k * h * step,
            z: -k * depth,
            rx: 0.12,
            ry: -0.4 * sx,
            o: clamp(N / 2 + 0.5 - Math.abs(k), 0, 1),
            shade: clamp(0.85 - 0.04 * k, 0.5, 1),
          });
        };
        const grid: Layout = (i, t) => {
          const [w, h] = u.dims(i);
          const [x, y] = gridPos(i, N, g);
          return pose({ x, y, z: 0.02 * Math.sin(t * TAU + i), s: fit(w * (1 + gap), h * (1 + gap), g.cw, g.ch) });
        };
        runScenes(cards, u, [stairs, grid], { transition: pct(u, 'transition'), stagger: pct(u, 'stagger') });
      },
    };
  },
};

// ---------------------------------------------------------------------------

/*
 * Grid Dive — modelled on the reference recording:
 * 1. a dense grid that bleeds past every frame edge holds;
 * 2. the view dives into one card (neighbours still peeking at the edges);
 * 3. it tours neighbouring cards in eased pans with holds, briefly pulling
 *    back on long jumps;
 * 4. on the last stop the neighbours blow away, leaving one card on black;
 * 5. that card leaves upward and a short reel of single cards rises through
 *    the frame one at a time;
 * 6. the whole grid slides back in from the bottom-left.
 */
// [col, row, zoomMultiplier] -> alternates between medium tour zoom and deep dive
const DIVE_PATH: [number, number, number][] = [
  [0, 0, 0.72],   // Stop 1: Medium zoom at centre
  [1, 0, 0.72],   // Stop 2: Horizontal pan right at medium zoom
  [0, 1, 1.0],    // Stop 3: Deep dive upward with hold
  [1, -1, 0.72],  // Stop 4: Pullback to medium zoom
  [-1, 0, 1.04],  // Stop 5: Diagonal intersection pan into full deep dive
  [0, -1, 0.78],  // Stop 6: Optional extra stop
];

/** Grid pitch (world units) and pool extents for a column count. */
function diveGrid(cols: number, A: number, U: number) {
  const pitch = U / cols;
  const hc = Math.ceil(A / pitch + 1.5);
  const hr = Math.ceil(1 / pitch + 0.5);
  return { pitch, hc, hr, C: 2 * hc + 1, R: 2 * hr + 1 };
}

type DiveSeg =
  | { k: 'grid' | 'dive' | 'blackout' | 'enter'; w: number }
  | { k: 'stop' | 'pan'; i: number; w: number }
  | { k: 'in' | 'hold' | 'out'; r: number; w: number };

export const gridDive: TemplateDef = {
  id: 'grid-dive',
  name: 'Grid Dive',
  category: 'multiscene',
  defaultSlots: 9,
  camera: 'perspective',
  defaults: { cardSize: 40, cardRatio: '1:1', easing: 'smooth', motion: 'continuous', direction: '' },
  directions: [],
  hide: ['motion', 'cardSize'],
  params: [
    int('cols', 'Grid columns', 3, 5, 3),
    num('gap', 'Grid gap', 0, 30, 6),
    num('zoom', 'Dive zoom', 50, 95, 88),
    int('stops', 'Tour stops', 2, 6, 5),
    int('reel', 'Solo cards', 0, 4, 3),
    num('hold', 'Hold', 0, 100, 50),
  ],
  structure: (p) => String(p.cols),
  build(b) {
    const g0 = diveGrid(Number(b.params.cols) || 3, b.A, b.U);
    const pool = b.createCards(g0.C * g0.R);
    return {
      update(u) {
        const { pitch, hc, hr, C } = g0;
        const S = u.slotCount;
        const easing = u.str('easing');
        const E = (t: number) => ease(easing, clamp(t, 0, 1));
        const cubicIn = (t: number) => t * t * t;
        const cubicOut = (t: number) => 1 - (1 - t) ** 3;
        const box = pitch * (1 - pct(u, 'gap'));
        const zf = pct(u, 'zoom');
        const H = 0.2 + 1.6 * pct(u, 'hold');
        const stops = Math.min(u.num('stops'), DIVE_PATH.length);
        const reelN = u.num('reel');

        // Staggered horizontal row offset (middle and bottom rows shifted left).
        const rowShift = (bb: number) => (bb === 0 ? -0.16 : bb < 0 ? -0.28 : 0) * pitch;

        const vstep = S > 3 ? Math.floor(S / 2) : 1;
        const cellOf = (idx: number): [number, number] => [(idx % C) - hc, Math.floor(idx / C) - hr];
        const slotOf = (a: number, bb: number) => mod(a - bb * vstep, S);
        const cellIdx = (a: number, bb: number) => (bb + hr) * C + (a + hc);
        const baseScale = (slot: number) => {
          const [w, h] = u.dims(slot);
          return fit(w, h, box, box);
        };
        const heroScale = (slot: number, mul = 1) => {
          const [w, h] = u.dims(slot);
          return fit(w, h, 2 * u.A * zf * mul, 2 * zf * mul);
        };
        const stopPos = (i: number): [number, number] => {
          const [a, bb] = DIVE_PATH[i];
          return [a * pitch + rowShift(bb), bb * pitch];
        };
        const stopZoom = (i: number) => {
          const [a, bb, zMul] = DIVE_PATH[i];
          const slot = slotOf(a, bb);
          return Math.max(1, heroScale(slot, zMul) / baseScale(slot));
        };

        // Timeline rebuilt each frame so hold/stops/reel stay live.
        const segs: DiveSeg[] = [
          { k: 'grid', w: 1.1 * H },
          { k: 'dive', w: 0.75 },
          { k: 'stop', i: 0, w: 0.45 * H },
        ];
        for (let i = 1; i < stops; i++) {
          const isDeepHold = DIVE_PATH[i][2] >= 1;
          segs.push({ k: 'pan', i, w: 0.7 }, { k: 'stop', i, w: (isDeepHold ? 0.85 : 0.4) * H });
        }
        segs.push({ k: 'blackout', w: 0.35 });
        for (let r = 0; r < reelN; r++) {
          segs.push({ k: 'in', r, w: 0.45 }, { k: 'hold', r, w: 0.5 * H }, { k: 'out', r, w: 0.32 });
        }
        segs.push({ k: 'enter', w: 0.85 });

        const total = segs.reduce((a, s) => a + s.w, 0);
        let acc = (u.p - Math.floor(u.p)) * total;
        let si = 0;
        while (si < segs.length - 1 && acc >= segs[si].w) acc -= segs[si++].w;
        const seg = segs[si];
        const lt = clamp(acc / seg.w, 0, 1);

        const last = stops - 1;
        const [ha, hb] = DIVE_PATH[last];
        const heroIdx = cellIdx(ha, hb);
        const heroSlot = slotOf(ha, hb);

        let cx = 0;
        let cy = 0;
        let Z = 1;
        let gridYOffset = 0;
        let gridMode = true;

        const at = (i: number) => {
          [cx, cy] = stopPos(i);
          Z = stopZoom(i);
        };

        if (seg.k === 'dive') {
          const Zs = stopZoom(0);
          const e = E(lt);
          Z = Math.pow(Zs, e);
          const [tx, ty] = stopPos(0);
          cx = tx * e;
          cy = ty * e;
        } else if (seg.k === 'stop') {
          at(seg.i);
          Z *= 1 + 0.02 * lt;
        } else if (seg.k === 'pan') {
          const [x0, y0] = stopPos(seg.i - 1);
          const [x1, y1] = stopPos(seg.i);
          const e = E(lt);
          cx = x0 + (x1 - x0) * e;
          cy = y0 + (y1 - y0) * e;
          const z0 = stopZoom(seg.i - 1) * 1.02;
          const z1 = stopZoom(seg.i);
          const dist = Math.hypot(x1 - x0, y1 - y0) / pitch;
          // Pull back slightly on diagonal multi-card jumps.
          const dip = dist > 1.2 ? 0.28 : 0.08;
          Z = Math.max(1, (z0 + (z1 - z0) * e) * (1 - dip * Math.sin(lt * Math.PI)));
        } else if (seg.k === 'enter') {
          // Entire grid slides vertically upward from the bottom back to origin.
          const e = 1 - cubicOut(lt);
          gridYOffset = -2.1 * e;
        } else if (seg.k !== 'grid') {
          gridMode = false;
        }

        if (gridMode) {
          pool.forEach((c, idx) => {
            const [a, bb] = cellOf(idx);
            c.slot = slotOf(a, bb);
            c.setSize(...u.dims(c.slot));
            const x = (a * pitch + rowShift(bb) - cx) * Z;
            const y = (bb * pitch - cy) * Z + gridYOffset;
            const s = baseScale(c.slot) * Z;
            applyPose(c, pose({ x, y, s, o: 1, order: idx === heroIdx ? 10 : 0 }));
          });
          return;
        }

        // Brief blackout cut followed by asymmetric solo cards + corner thumbnails.
        for (const c of pool) c.group.visible = false;
        if (seg.k === 'blackout') return;

        const placeCard = (idx: number, slot: number, x: number, y: number, sMul: number, order = 10) => {
          const c = pool[mod(idx, pool.length)];
          c.group.visible = true;
          c.slot = mod(slot, S);
          c.setSize(...u.dims(c.slot));
          applyPose(c, pose({ x, y, s: heroScale(c.slot, 1) * sMul, order }));
        };

        if (seg.k === 'in' || seg.k === 'hold' || seg.k === 'out') {
          const r = seg.r;
          const mainSlot = mod(heroSlot + 1 + r, S);
          const mainIdx = heroIdx + 1 + r * 3;
          const offY = 1.35;

          // First solo card is centred; subsequent solo cards shift slightly left.
          const mainX = r === 0 ? 0 : -0.14 * u.A;
          const mainScale = r === 0 ? 0.76 : 0.74;

          let y = 0;
          let sMul = mainScale;
          if (seg.k === 'in') {
            const e = cubicOut(lt);
            y = -offY * (1 - e);
            sMul = mainScale * (0.92 + 0.08 * e);
          } else if (seg.k === 'hold') {
            y = 0.03 * lt;
          } else {
            y = 0.03 + offY * cubicIn(lt);
          }

          placeCard(mainIdx, mainSlot, mainX, y, sMul, 20);

          // Corner mini-thumbnails peeking in on later solo beats.
          if (r >= 1) {
            const miniY = y * 0.65 - 0.42;
            placeCard(mainIdx + 1, mainSlot + 1, 0.78 * u.A, miniY, 0.22, 15);
          }
          if (r >= 2) {
            const topLeftY = y * 0.5 + 0.58;
            placeCard(mainIdx + 2, mainSlot + 2, -0.96 * u.A, topLeftY, 0.22, 12);
          }
        }
      },
    };
  },
};

// ---------------------------------------------------------------------------

const paradeN = range(5, 12);

export const popParade: TemplateDef = {
  id: 'pop-parade',
  name: 'Pop Parade',
  category: 'multiscene',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 36, cardRatio: '4:5', easing: 'smooth', motion: 'continuous', direction: 'left' },
  directions: LR,
  hide: ['motion'],
  params: [
    num('bounce', 'Pop bounce', 0, 100, 60),
    num('spacing', 'Parade gap', 0, 80, 15),
    num('tilt', 'Parade tilt', -30, 30, 0, '°'),
    num('hop', 'Hop height', 0, 100, 40),
    transition(30),
  ],
  structure: (_p, n) => String(paradeN(n)),
  build(b) {
    const cards = b.createCards(paradeN(b.slotCount));
    const N = cards.length;
    return {
      update(u) {
        const bounce = pct(u, 'bounce') * 2.4;
        const dir = u.str('direction') === 'right' ? -1 : 1;
        const tilt = u.num('tilt') * DEG;
        const hop = pct(u, 'hop') * 0.2;
        const [w0, h0] = u.dims(0);
        const pitch = w0 * 0.75 * (1 + pct(u, 'spacing'));
        // Cards pop onto a loose pile one by one.
        const pop: Layout = (i, t) => {
          const local = (t - (i / N) * 0.8) / 0.18;
          if (local <= 0) return pose({ s: 0, o: 0 });
          return pose({
            x: (hashRand(i, 5) - 0.5) * w0 * 0.4,
            y: (hashRand(i, 6) - 0.5) * h0 * 0.3,
            z: i * 0.01,
            rz: (hashRand(i, 7) - 0.5) * 0.5,
            s: 0.9 * backOut(clamp(local, 0, 1), bounce),
            order: i,
          });
        };
        // Then march across the frame in a hopping line.
        const parade: Layout = (i, t) => {
          const x = center(i, N) * pitch - dir * t * pitch;
          const y = Math.abs(Math.sin((t * 4 + i * 0.5) * Math.PI)) * h0 * hop;
          return pose({ x: x * Math.cos(tilt) - y * Math.sin(tilt), y: x * Math.sin(tilt) + y * Math.cos(tilt), rz: tilt, s: 0.75 });
        };
        runScenes(cards, u, [pop, parade], { transition: pct(u, 'transition') });
      },
    };
  },
};

// ---------------------------------------------------------------------------

const tripleN = (n: number) => 3 * Math.ceil(clamp(n, 6, 15) / 3);

export const tripleScene: TemplateDef = {
  id: 'triple-scene',
  name: 'Triple Scene',
  category: 'multiscene',
  defaultSlots: 9,
  camera: 'perspective',
  defaults: { cardSize: 40, cardRatio: '4:5', easing: 'smooth', motion: 'continuous', direction: '' },
  directions: [],
  hide: ['motion', 'cardSize'],
  params: [num('gap', 'Gap', 0, 40, 8), num('scroll', 'Scroll distance', 0, 100, 50), num('fan', 'Stack fan', 0, 100, 50), transition(35)],
  structure: (_p, n) => String(tripleN(n)),
  build(b) {
    const cards = b.createCards(tripleN(b.slotCount));
    const N = cards.length;
    const per = N / 3;
    return {
      update(u) {
        const gap = pct(u, 'gap');
        const scroll = pct(u, 'scroll');
        const fan = pct(u, 'fan');
        // Three columns scrolling in alternate directions.
        const columns: Layout = (i, t) => {
          const [w, h] = u.dims(i);
          const col = i % 3;
          const row = Math.floor(i / 3);
          const cw = (2 * u.A) / 3;
          const s = (cw * (1 - gap)) / w;
          const pitch = h * s + cw * gap;
          const dir = col % 2 ? -1 : 1;
          return pose({ x: (col - 1) * cw, y: ((per - 1) / 2 - row) * pitch + dir * scroll * (t - 0.5) * pitch * 2, s });
        };
        // Three rows scrolling sideways.
        const rows: Layout = (i, t) => {
          const [w, h] = u.dims(i);
          const row = i % 3;
          const k = Math.floor(i / 3);
          const ch = 2 / 3;
          const s = (ch * (1 - gap)) / h;
          const pitch = w * s + ch * gap;
          const dir = row % 2 ? 1 : -1;
          return pose({ x: (k - (per - 1) / 2) * pitch + dir * scroll * (t - 0.5) * pitch * 2, y: (1 - row) * ch, s });
        };
        // Everything gathers into one fanned stack.
        const stack: Layout = (i, t) => {
          const [w, h] = u.dims(i);
          return pose({
            z: i * 0.004,
            rz: center(i, N) * 0.035 * fan * (0.6 + 0.4 * Math.sin(t * Math.PI)),
            s: fit(w, h, 2 * u.A * 0.7, 1.4),
            shade: 0.75 + (0.25 * i) / (N - 1),
            order: i,
          });
        };
        runScenes(cards, u, [columns, rows, stack], { transition: pct(u, 'transition') });
      },
    };
  },
};

// ---------------------------------------------------------------------------

const collageN = range(6, 12);

export const collageReel: TemplateDef = {
  id: 'collage-reel',
  name: 'Collage Reel',
  category: 'multiscene',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 38, cardRatio: 'auto', easing: 'smooth', motion: 'continuous', direction: 'left' },
  directions: LR,
  hide: ['motion'],
  params: [
    num('scatter', 'Collage spread', 20, 100, 70),
    num('rotation', 'Collage rotation', 0, 45, 18, '°'),
    num('gap', 'Reel gap', 0, 60, 10),
    num('focus', 'Reel focus', 100, 160, 125),
    transition(35),
  ],
  structure: (_p, n) => String(collageN(n)),
  build(b) {
    const cards = b.createCards(collageN(b.slotCount));
    const N = cards.length;
    return {
      update(u) {
        const scatter = pct(u, 'scatter');
        const rot = u.num('rotation') * DEG;
        const focus = pct(u, 'focus') - 1;
        const dir = u.str('direction') === 'right' ? -1 : 1;
        const [w0] = u.dims(0);
        const pitch = w0 * (1 + pct(u, 'gap'));
        const collage: Layout = (i, t) => {
          const [w, h] = u.dims(i);
          return pose({
            x: (hashRand(i, 1) * 2 - 1) * Math.max(0, u.A - w * 0.4) * scatter + Math.sin(t * TAU + i) * 0.02 * u.U,
            y: (hashRand(i, 2) * 2 - 1) * Math.max(0, 1 - h * 0.4) * scatter,
            z: i * 0.003,
            rz: (hashRand(i, 3) * 2 - 1) * rot,
            s: 0.75 + 0.25 * hashRand(i, 4),
            order: i,
          });
        };
        const reel: Layout = (i, t) => {
          const a = i - ((N - 1) / 2 + dir * (t - 0.5) * 2);
          const near = Math.max(0, 1 - Math.abs(a));
          return pose({ x: a * pitch, z: near * 0.1, s: 1 + focus * near, shade: 0.75 + 0.25 * near, order: near * 10 });
        };
        runScenes(cards, u, [collage, reel], { transition: pct(u, 'transition') });
      },
    };
  },
};

// ---------------------------------------------------------------------------

const fanN = range(4, 9);

export const fanShuffle: TemplateDef = {
  id: 'fan-shuffle',
  name: 'Fan Shuffle',
  category: 'multiscene',
  defaultSlots: 6,
  camera: 'perspective',
  defaults: { cardSize: 40, cardRatio: '3:4', easing: 'smooth', motion: 'continuous', direction: '' },
  directions: [],
  hide: ['motion'],
  params: [
    num('angle', 'Fan angle', 20, 160, 90, '°'),
    num('radius', 'Fan radius', 30, 200, 100),
    num('offset', 'Stack offset', 0, 100, 40),
    stagger(50),
    transition(35),
  ],
  structure: (_p, n) => String(fanN(n)),
  build(b) {
    const cards = b.createCards(fanN(b.slotCount));
    const N = cards.length;
    return {
      update(u) {
        const angle = u.num('angle') * DEG;
        const R = pct(u, 'radius') * u.U;
        const off = pct(u, 'offset') * 0.04 * u.U;
        // A tidy pile where cards slip out and back one at a time.
        const stack: Layout = (i, t) => {
          const [w] = u.dims(i);
          const local = t * N - i;
          const slip = local > 0 && local < 1 ? Math.sin(local * Math.PI) : 0;
          return pose({
            x: center(i, N) * off * 0.3 + slip * w * 0.75 * (i % 2 ? 1 : -1),
            y: center(i, N) * off * 0.5,
            z: i * 0.01,
            rz: (hashRand(i, 5) - 0.5) * 0.12,
            order: i,
          });
        };
        const fan: Layout = (i, t) => {
          const [, h] = u.dims(i);
          const a = (N > 1 ? i / (N - 1) - 0.5 : 0) * angle * (1 + 0.06 * Math.sin(t * TAU));
          return pose({ x: Math.sin(a) * R, y: Math.cos(a) * R - R + h * 0.15, z: i * 0.01, rz: -a, order: i });
        };
        const row: Layout = (i, t) => {
          const [w, h] = u.dims(i);
          const cw = (2 * u.A) / N;
          return pose({ x: center(i, N) * cw, y: Math.sin(t * TAU + i * 0.7) * 0.03 * u.U, s: Math.min(1, fit(w, h, cw * 0.92, 1.6)) });
        };
        runScenes(cards, u, [stack, fan, row], { transition: pct(u, 'transition'), stagger: pct(u, 'stagger') });
      },
    };
  },
};

// ---------------------------------------------------------------------------

const sweepN = range(6, 14);

export const sweepRing: TemplateDef = {
  id: 'sweep-ring',
  name: 'Sweep Ring',
  category: 'multiscene',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 30, cardRatio: '4:5', easing: 'smooth', motion: 'continuous', direction: 'cw' },
  directions: CW,
  hide: ['motion'],
  params: [
    num('hero', 'Hero size', 50, 100, 80),
    num('radius', 'Ring radius', 40, 180, 90),
    num('tilt', 'Ring tilt', -40, 40, 14, '°'),
    int('turns', 'Ring turns', 1, 3, 1),
    transition(35),
  ],
  structure: (_p, n) => String(sweepN(n)),
  build(b) {
    const cards = b.createCards(sweepN(b.slotCount));
    const N = cards.length;
    return {
      update(u) {
        const heroFr = pct(u, 'hero');
        const R = pct(u, 'radius') * u.U;
        const tilt = u.num('tilt') * DEG;
        const dir = u.str('direction') === 'ccw' ? -1 : 1;
        const turns = u.num('turns');
        // One hero card; the others wait hidden behind it.
        const hero: Layout = (i, t) => {
          if (i !== 0) return pose({ z: -0.4, s: 0.5, o: 0 });
          const [w, h] = u.dims(i);
          return pose({ z: 0.2, s: fit(w, h, 2 * u.A * heroFr, 2 * heroFr) * (1 + 0.05 * t), order: 20 });
        };
        // The deck sweeps out into a spinning ring and returns card 0 to the front.
        const ring: Layout = (i, t) => {
          const th = (i / N) * TAU + dir * t * TAU * turns;
          const front = Math.cos(th);
          return pose({
            x: Math.sin(th) * R,
            y: -front * R * Math.sin(tilt),
            z: front * R * Math.cos(tilt) - R,
            ry: th,
            shade: 0.5 + 0.5 * ((front + 1) / 2),
          });
        };
        runScenes(cards, u, [hero, ring], { transition: pct(u, 'transition') });
      },
    };
  },
};

// ---------------------------------------------------------------------------

const dialN = range(6, 14);

export const scatterDial: TemplateDef = {
  id: 'scatter-dial',
  name: 'Scatter Dial',
  category: 'multiscene',
  defaultSlots: 10,
  camera: 'perspective',
  defaults: { cardSize: 28, cardRatio: '4:5', easing: 'smooth', motion: 'continuous', direction: 'cw' },
  directions: CW,
  hide: ['motion'],
  params: [
    num('scatter', 'Scatter spread', 20, 100, 75),
    num('rotation', 'Scatter rotation', 0, 45, 25, '°'),
    num('radius', 'Dial radius', 30, 120, 65),
    num('spin', 'Dial turn', 0, 360, 120, '°'),
    transition(40),
  ],
  structure: (_p, n) => String(dialN(n)),
  build(b) {
    const cards = b.createCards(dialN(b.slotCount));
    const N = cards.length;
    return {
      update(u) {
        const scatter = pct(u, 'scatter');
        const rot = u.num('rotation') * DEG;
        const R = pct(u, 'radius') * u.U;
        const spin = u.num('spin') * DEG;
        const dir = u.str('direction') === 'ccw' ? -1 : 1;
        const scatterL: Layout = (i, t) => {
          const [w, h] = u.dims(i);
          return pose({
            x: (hashRand(i, 11) * 2 - 1) * Math.max(0, u.A - w * 0.5) * scatter,
            y: (hashRand(i, 12) * 2 - 1) * Math.max(0, 1 - h * 0.5) * scatter + Math.sin(t * TAU + i * 1.3) * 0.03 * u.U,
            z: i * 0.003,
            rz: (hashRand(i, 13) * 2 - 1) * rot,
            s: 0.8 + 0.2 * hashRand(i, 14),
            order: i,
          });
        };
        // Clock-face ring with every card pointing outward.
        const dial: Layout = (i, t) => {
          const th = (i / N) * TAU + dir * t * spin;
          return pose({ x: Math.sin(th) * R, y: Math.cos(th) * R, rz: -th, s: 0.8 });
        };
        runScenes(cards, u, [scatterL, dial], { transition: pct(u, 'transition') });
      },
    };
  },
};

// ---------------------------------------------------------------------------

const zoomN = range(6, 16);

export const gridZoom: TemplateDef = {
  id: 'grid-zoom',
  name: 'Grid Zoom',
  category: 'multiscene',
  defaultSlots: 12,
  camera: 'perspective',
  defaults: { cardSize: 40, cardRatio: '1:1', easing: 'smooth', motion: 'continuous', direction: '' },
  directions: [],
  hide: ['motion', 'cardSize'],
  params: [num('gap', 'Grid gap', 0, 40, 6), num('pair', 'Pair size', 60, 100, 92), num('single', 'Single size', 50, 100, 85), transition(35)],
  structure: (_p, n) => String(zoomN(n)),
  build(b) {
    const cards = b.createCards(zoomN(b.slotCount));
    const N = cards.length;
    return {
      update(u) {
        const gap = pct(u, 'gap');
        const pairFr = pct(u, 'pair');
        const single = pct(u, 'single');
        const [w0, h0] = u.dims(0);
        const g = fitGrid(N, u.A, w0, h0, gap);
        const vertical = u.A < 1;
        // Non-focused cards stay on the grid, zoomed past the frame edge.
        const zoomed = (i: number, Z: number) => {
          const [w, h] = u.dims(i);
          const [x, y] = gridPos(i, N, g);
          return pose({ x: x * Z, y: y * Z, s: fit(w * (1 + gap), h * (1 + gap), g.cw, g.ch) * Z, o: 0 });
        };
        const grid: Layout = (i, t) => ({ ...zoomed(i, 1 + 0.04 * t), o: 1 });
        // Two cards side by side (stacked in portrait frames).
        const pair: Layout = (i, t) => {
          if (i > 1) return zoomed(i, 2.6);
          const [w, h] = u.dims(i);
          const bw = vertical ? 2 * u.A * pairFr : u.A * pairFr * 0.96;
          const bh = vertical ? pairFr * 0.96 : 2 * pairFr;
          const o = i === 0 ? -1 : 1;
          return pose({
            x: vertical ? 0 : (o * u.A * pairFr) / 2,
            y: vertical ? (-o * pairFr) / 2 : 0,
            s: fit(w, h, bw, bh) * (1 + 0.03 * t),
          });
        };
        const one: Layout = (i, t) => {
          if (i > 0) return zoomed(i, 4);
          const [w, h] = u.dims(i);
          return pose({ z: 0.05, s: fit(w, h, 2 * u.A * single, 2 * single) * (1 + 0.03 * t), order: 5 });
        };
        runScenes(cards, u, [grid, pair, one], { transition: pct(u, 'transition') });
      },
    };
  },
};

// ---------------------------------------------------------------------------

const spreadN = range(4, 12);

function spreadTemplate(axis: 'rows' | 'columns'): TemplateDef {
  const isRows = axis === 'rows';
  return {
    id: isRows ? 'spread-rows' : 'spread-columns',
    name: isRows ? 'Spread Rows' : 'Spread Columns',
    category: 'multiscene',
    defaultSlots: 8,
    camera: 'perspective',
    defaults: { cardSize: 34, cardRatio: '4:5', easing: 'smooth', motion: 'continuous', direction: '' },
    directions: [],
    hide: ['motion'],
    params: [
      int('lines', isRows ? 'Rows' : 'Columns', 1, 4, 2),
      num('gap', 'Gap', 0, 60, 12),
      num('drift', 'Drift', 0, 100, 40),
      stagger(60),
      transition(40),
    ],
    structure: (_p, n) => String(spreadN(n)),
    build(b) {
      const cards = b.createCards(spreadN(b.slotCount));
      const N = cards.length;
      return {
        update(u) {
          const L = Math.min(u.num('lines'), N);
          const per = Math.ceil(N / L);
          const gap = pct(u, 'gap');
          const drift = pct(u, 'drift');
          // Cards gather in a loose pile at the centre...
          const stack: Layout = (i) => {
            const [w, h] = u.dims(i);
            return pose({
              x: (hashRand(i, 8) - 0.5) * w * 0.12,
              y: (hashRand(i, 9) - 0.5) * h * 0.12,
              z: i * 0.01,
              rz: (hashRand(i, 10) - 0.5) * 0.2,
              s: 0.9,
              order: i,
            });
          };
          // ...then deal out into drifting lines.
          const spread: Layout = (i, t) => {
            const [w, h] = u.dims(i);
            const line = Math.floor(i / per);
            const k = i % per;
            const cnt = Math.min(per, N - line * per);
            const d = (line % 2 ? 1 : -1) * drift * (t - 0.5);
            if (isRows) {
              const cell = (2 * u.A) / per;
              const across = 2 / L;
              const s = Math.min(1, fit(w * (1 + gap), h * (1 + gap), cell, across));
              return pose({ x: (k - (cnt - 1) / 2 + d) * cell, y: ((L - 1) / 2 - line) * across, s });
            }
            const cell = 2 / per;
            const across = (2 * u.A) / L;
            const s = Math.min(1, fit(w * (1 + gap), h * (1 + gap), across, cell));
            return pose({ x: (line - (L - 1) / 2) * across, y: ((cnt - 1) / 2 - k + d) * cell, s });
          };
          runScenes(cards, u, [stack, spread], { transition: pct(u, 'transition'), stagger: pct(u, 'stagger') });
        },
      };
    },
  };
}

export const spreadRows = spreadTemplate('rows');
export const spreadColumns = spreadTemplate('columns');

// ---------------------------------------------------------------------------

/*
 * Mosaic Revolve — a grid flips over to its flip side, lifts off into a wheel
 * carousel (a cylinder seen from inside) that spins several steps, settles
 * back into the grid, then flips back to the starting faces so the loop closes.
 */
export const mosaicRevolve: TemplateDef = {
  id: 'mosaic-revolve',
  name: 'Mosaic Revolve',
  category: 'multiscene',
  defaultSlots: 12,
  camera: 'perspective',
  defaults: { cardSize: 90, cardRatio: '1:1', easing: 'smooth', motion: 'continuous', direction: 'left' },
  directions: LR,
  hide: ['motion', 'cardSize'],
  params: [
    int('columns', 'Columns', 2, 6, 3),
    num('gap', 'Grid gap', 0, 30, 6),
    num('flipStagger', 'Flip stagger', 0, 100, 60),
    num('radius', 'Wheel radius', 60, 250, 120),
    num('size', 'Wheel card size', 30, 90, 60),
    num('spacing', 'Wheel spacing', 0, 60, 10),
    num('turn', 'Wheel turn', 1, 8, 4, ' steps'),
    transition(45),
    stagger(50),
  ],
  structure: (p, _n, frame) => `${p.columns}|${frame.A.toFixed(3)}`,
  build(b) {
    const cols = Number(b.params.columns);
    const shape = (A: number) => {
      const cellW = (2 * A) / cols;
      const rows = Math.max(1, Math.round(2 / cellW));
      return { cellW, cellH: 2 / rows, rows };
    };
    const cards = b.createCards(cols * shape(b.A).rows);
    const N = cards.length;
    const seg = (p: number, a: number, z: number) => clamp((p - a) / (z - a), 0, 1);
    return {
      update(u) {
        const easing = u.str('easing');
        const { cellW, cellH, rows } = shape(u.A);
        const gap = pct(u, 'gap');
        const fill = 1 - gap;
        const dir = u.str('direction') === 'right' ? -1 : 1;
        const R = pct(u, 'radius') * u.U;
        const wheelH = pct(u, 'size') * 2;
        const maxTh = 1.45;
        const maxZ = u.camera.position.z * 0.7;
        const mid = Math.floor(N / 2);
        const turn = u.num('turn');

        const gridPose = (i: number): Pose => {
          const [w, h] = u.dims(i);
          const r = Math.floor(i / cols);
          const col = i % cols;
          return pose({
            x: -u.A + cellW * (col + 0.5),
            y: 1 - (cellH * (r + 0.5)),
            s: fit(w, h, cellW * fill, cellH * fill),
          });
        };
        const wheelPose = (i: number, spin: number): Pose => {
          const [w, h] = u.dims(i);
          const s = fit(w, h, 99, wheelH);
          const step = (w * s * (1 + pct(u, 'spacing'))) / R;
          const th = wrapSigned(i - mid - spin, N) * step;
          const z = R * (1 - Math.cos(th));
          const o = Math.abs(th) > maxTh ? 0 : clamp((maxTh - Math.abs(th)) / 0.25, 0, 1) * clamp((maxZ - z) / (0.15 * maxZ), 0, 1);
          return pose({
            x: Math.sin(th) * R,
            z,
            ry: -th,
            s,
            o,
            shade: 1 - 0.35 * Math.min(1, Math.abs(th) / 1.2),
            order: Math.round(50 - Math.abs(th) * 20),
          });
        };

        const tr = pct(u, 'transition');
        const flipLen = 0.16;
        const rest = 1 - 2 * flipLen;
        const morphLen = (rest * tr) / 2;
        const t1 = flipLen;
        const t2 = t1 + morphLen;
        const t3 = t2 + rest * (1 - tr);
        const t4 = t3 + morphLen;
        const stg = pct(u, 'stagger') * 0.6;
        const flipStg = pct(u, 'flipStagger') * 0.7;
        const span = Math.max(1, rows + cols - 2);
        const maxD = Math.max(1, mid, N - 1 - mid);
        const p = u.p - Math.floor(u.p);
        // Cards nearest the wheel's centre lift off first.
        const morphAt = (i: number, m: number) => {
          const d = Math.abs(i - mid) / maxD;
          return ease(easing, clamp((m - d * stg) / (1 - stg), 0, 1));
        };
        const lift = (P: Pose, m: number, i: number) => {
          const k = Math.sin(Math.PI * morphAt(i, m)) * 0.35;
          return { ...P, z: P.z + k, order: P.order + (k > 0.01 ? 20 : 0) };
        };

        cards.forEach((c, i) => {
          c.setSize(...u.dims(i));
          let P: Pose;
          let slot = i;
          if (p < t1 || p >= t4) {
            // Flip over (out) or flip back (return).
            const out = p < t1;
            const f = out ? p / t1 : (p - t4) / (1 - t4);
            const r = Math.floor(i / cols);
            const delay = (((r + (i % cols)) / span) * flipStg);
            const angle = ease(easing, clamp((f - delay) / (1 - flipStg), 0, 1)) * Math.PI;
            const flipped = angle > Math.PI / 2;
            const front = out ? i : i + N;
            const back = out ? i + N : i;
            slot = flipped ? back : front;
            P = { ...gridPose(i), ry: flipped ? angle - Math.PI : angle, shade: 1 - 0.45 * Math.sin(angle) };
          } else if (p < t2) {
            slot = i + N;
            const m = seg(p, t1, t2);
            P = lift(blend(gridPose(i), wheelPose(i, 0), morphAt(i, m)), m, i);
          } else if (p < t3) {
            slot = i + N;
            P = wheelPose(i, dir * turn * ease(easing, seg(p, t2, t3)));
          } else {
            slot = i + N;
            const m = seg(p, t3, t4);
            P = lift(blend(wheelPose(i, dir * turn), gridPose(i), morphAt(i, m)), m, i);
          }
          c.slot = slot;
          applyPose(c, P);
        });
      },
    };
  },
};

// ---------------------------------------------------------------------------

/*
 * Turnstile Grid — flip grid and wheel carousel fused into one continuous
 * motion. Each tile flips *while* it flies off the grid, so it lands on the
 * wheel already showing its new face; the wheel starts spinning while tiles
 * are still arriving and slows down as they leave. On the way back each tile
 * completes its full 360° turn and drops into its own cell, closing the loop.
 * Tiles are mapped column by column onto the wheel, so paths never cross.
 */
export const turnstileGrid: TemplateDef = {
  id: 'turnstile-grid',
  name: 'Turnstile Grid',
  category: 'multiscene',
  defaultSlots: 12,
  camera: 'perspective',
  defaults: { cardSize: 90, cardRatio: '1:1', easing: 'smooth', motion: 'continuous', direction: 'left' },
  directions: LR,
  hide: ['motion', 'cardSize'],
  params: [
    int('columns', 'Columns', 2, 6, 3),
    num('gap', 'Grid gap', 0, 30, 6),
    num('hold', 'Grid hold', 0, 60, 24),
    num('lift', 'Flight lift', 0, 100, 45),
    num('radius', 'Wheel radius', 60, 250, 120),
    num('size', 'Wheel card size', 30, 90, 58),
    num('spacing', 'Wheel spacing', 0, 60, 10),
    int('laps', 'Wheel laps', 1, 3, 1),
    stagger(55),
    transition(40),
  ],
  structure: (p, _n, frame) => `${p.columns}|${frame.A.toFixed(3)}`,
  build(b) {
    const cols = Number(b.params.columns);
    const shape = (A: number) => {
      const cellW = (2 * A) / cols;
      const rows = Math.max(1, Math.round(2 / cellW));
      return { cellW, cellH: 2 / rows, rows };
    };
    const cards = b.createCards(cols * shape(b.A).rows);
    const N = cards.length;
    const seg = (p: number, a: number, z: number) => (z > a ? clamp((p - a) / (z - a), 0, 1) : 1);
    // Zero velocity at both ends, so the spin eases in and out with no jolt.
    const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
    return {
      update(u) {
        const easing = u.str('easing');
        const { cellW, cellH, rows } = shape(u.A);
        const fill = 1 - pct(u, 'gap');
        const dir = u.str('direction') === 'right' ? -1 : 1;
        const R = pct(u, 'radius') * u.U;
        const wheelH = pct(u, 'size') * 2;
        const lift = pct(u, 'lift') * 0.45 * u.U;
        const maxTh = 1.45;
        const maxZ = u.camera.position.z * 0.7;
        const span = Math.max(1, rows + cols - 2);
        const stg = pct(u, 'stagger') * 0.75;

        // Timeline: grid hold (split across the loop seam) | fly out | wheel | fly back.
        const hold = pct(u, 'hold');
        const rest = 1 - hold;
        const fly = (rest * pct(u, 'transition')) / 2;
        const a = hold / 2;
        const bOut = a + fly;
        const cBack = 1 - hold / 2 - fly;
        const d = 1 - hold / 2;
        const p = u.p - Math.floor(u.p);
        // Whole laps bring every tile back to its own wheel spot, then its own cell.
        const spin = dir * u.num('laps') * N * smoother(seg(p, a, d));

        const [w0, h0] = u.dims(0);
        const s0 = fit(w0, h0, 99, wheelH);
        // Keep the wrap-around seam outside the visible arc for small decks.
        const step = Math.max((w0 * s0 * (1 + pct(u, 'spacing'))) / R, (2 * maxTh + 0.3) / N);

        const gridPose = (i: number): Pose => {
          const [w, h] = u.dims(i);
          const r = Math.floor(i / cols);
          const col = i % cols;
          return pose({ x: -u.A + cellW * (col + 0.5), y: 1 - cellH * (r + 0.5), s: fit(w, h, cellW * fill, cellH * fill) });
        };
        const wheelPose = (i: number, ref = spin): Pose => {
          const [w, h] = u.dims(i);
          // Column-major order: left columns land on the left of the wheel.
          const v = (i % cols) * rows + Math.floor(i / cols) - (N - 1) / 2;
          // Wrap against `ref` so tiles in flight follow a continuous target.
          const th = (v - spin + (wrapSigned(v - ref, N) - (v - ref))) * step;
          const z = R * (1 - Math.cos(th));
          const o = Math.abs(th) > maxTh ? 0 : clamp((maxTh - Math.abs(th)) / 0.25, 0, 1) * clamp((maxZ - z) / (0.15 * maxZ), 0, 1);
          return pose({
            x: Math.sin(th) * R,
            z,
            ry: -th,
            s: fit(w, h, 99, wheelH),
            o,
            shade: 1 - 0.35 * Math.min(1, Math.abs(th) / 1.2),
            order: Math.round(50 - Math.abs(th) * 20),
          });
        };

        cards.forEach((c, i) => {
          c.setSize(...u.dims(i));
          const delay = ((Math.floor(i / cols) + (i % cols)) / span) * stg;
          const local = (g: number) => ease(easing, clamp((g - delay) / (1 - stg), 0, 1));
          let P: Pose;
          // Total flip angle: 0 → π on the way out, π → 2π on the way back.
          let angle: number;
          if (p < a || p >= d) {
            P = gridPose(i);
            angle = 0;
          } else if (p >= bOut && p < cBack) {
            P = wheelPose(i);
            angle = Math.PI;
          } else {
            const out = p < bOut;
            const m = out ? local(seg(p, a, bOut)) : local(seg(p, cBack, d));
            const wheel = wheelPose(i, dir * u.num('laps') * N * smoother(seg(out ? bOut : cBack, a, d)));
            const from = out ? gridPose(i) : wheel;
            const to = out ? wheel : gridPose(i);
            P = blend(from, to, m);
            // Fade only toward hidden wheel spots, never through the grid.
            P.o = out ? lerp1(1, to.o, m) : lerp1(from.o, 1, m);
            const arc = Math.sin(Math.PI * m);
            P.z += arc * lift;
            P.s *= 1 + 0.12 * arc;
            P.order += arc > 0.02 ? 100 : 0;
            angle = Math.PI * (out ? m : 1 + m);
          }
          // A tile renders one face; past each half turn swap to the other slot.
          const k = Math.round(angle / Math.PI);
          c.slot = k % 2 === 1 ? i + N : i;
          P.ry += angle - k * Math.PI;
          P.shade *= 1 - 0.4 * Math.abs(Math.sin(angle));
          applyPose(c, P);
        });
      },
    };
  },
};

const lerp1 = (x: number, y: number, t: number) => x + (y - x) * t;

// ---------------------------------------------------------------------------

/*
 * Flip Wrap — flip grid and wheel carousel joined by a bend instead of a
 * flight. The grid flips through a few sets of images, then the whole sheet
 * curls into the inside of a cylinder (extra columns swing in from the frame
 * edges) and spins as a wheel carousel, flattens back into the grid and flips
 * once more to the opening faces, closing the loop. Every tile stays on one
 * continuous sheet the whole time, so nothing crosses, pops or jumps.
 */
export const flipWrap: TemplateDef = {
  id: 'flip-wrap',
  name: 'Flip Wrap',
  category: 'multiscene',
  defaultSlots: 12,
  camera: 'perspective',
  defaults: { cardSize: 90, cardRatio: '1:1', easing: 'smooth', motion: 'continuous', direction: 'left' },
  directions: LR,
  hide: ['motion', 'cardSize'],
  params: [
    int('columns', 'Columns', 2, 6, 3),
    num('gap', 'Grid gap', 0, 30, 6),
    int('flips', 'Grid flips', 0, 4, 2),
    num('flipStagger', 'Flip stagger', 0, 100, 60),
    num('radius', 'Wheel radius', 60, 250, 110),
    num('size', 'Wheel scale', 40, 100, 72),
    num('spacing', 'Wheel spacing', 0, 60, 12),
    num('tilt', 'Wheel tilt', -20, 20, 6, '°'),
    int('turn', 'Wheel turn (columns)', 1, 8, 3),
    transition(45),
  ],
  structure: (p, _n, frame) => `${p.columns}|${frame.A.toFixed(3)}`,
  build(b) {
    const cols = Number(b.params.columns);
    const shape = (A: number) => {
      const cellW = (2 * A) / cols;
      const rows = Math.max(1, Math.round(2 / cellW));
      return { cellW, cellH: 2 / rows, rows };
    };
    const rows = shape(b.A).rows;
    // Sheet columns: the grid plus enough spares to fill the wheel's arc.
    const M = cols + 2 * Math.max(3, cols);
    const cards = b.createCards(M * rows);
    const N = cols * rows;
    const seg = (p: number, a: number, z: number) => (z > a ? clamp((p - a) / (z - a), 0, 1) : 1);
    const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
    return {
      update(u) {
        const easing = u.str('easing');
        const { cellW, cellH } = shape(u.A);
        const fill = 1 - pct(u, 'gap');
        const dir = u.str('direction') === 'right' ? -1 : 1;
        const R = pct(u, 'radius') * u.U;
        const maxTh = 1.45;
        const maxZ = u.camera.position.z * 0.7;
        const F = u.num('flips');
        const turn = dir * u.num('turn');

        // Timeline: F flips | bend in | wheel | bend out | flip back home.
        const fl = 0.11;
        const rest = 1 - (F + 1) * fl;
        const bendLen = (rest * pct(u, 'transition')) / 2;
        const t0 = F * fl;
        const t1 = t0 + bendLen;
        const t3 = 1 - fl;
        const t2 = t3 - bendLen;
        const p = u.p - Math.floor(u.p);

        // Bend amount 0 (flat grid) .. 1 (wheel); the spin spans the whole
        // wheel section and starts/stops with zero velocity.
        const m = p < t1 ? ease(easing, seg(p, t0, t1)) : 1 - ease(easing, seg(p, t2, t3));
        const center = turn * smoother(seg(p, t0, t3));
        const Z = lerp1(1, pct(u, 'size'), m);
        const spread = Z * lerp1(1, 1 + pct(u, 'spacing'), m);
        const pitchX = cellW * spread;
        const pitchY = cellH * spread;
        const kappa = m / R;
        const tilt = u.num('tilt') * DEG * m;
        const ct = Math.cos(tilt);
        const st = Math.sin(tilt);
        const mid = (cols - 1) / 2;
        const span = Math.max(1, rows + cols - 2);
        const flipStg = pct(u, 'flipStagger') * 0.49;
        // Grid content: set k, sheet column j, row r (column-major, so the
        // wheel continues the grid's sequence sideways).
        const slotOf = (k: number, j: number, r: number) => k * N + j * rows + r;

        cards.forEach((c, idx) => {
          const pc = idx % M;
          const r = Math.floor(idx / M);
          // Nearest sheet column for this pool column, centred on the view.
          const j = pc + M * Math.round((center + mid - pc) / M);
          const q = j - center - mid;

          // Flip state: only during the flat-grid sections.
          let angle = 0;
          let from = slotOf(F, j, r);
          let to = from;
          let local = -1;
          if (p < t0) {
            const f = Math.min(F - 1, Math.floor(p / fl));
            local = (p - f * fl) / fl;
            from = slotOf(f, j, r);
            to = slotOf(f + 1, j, r);
          } else if (p >= t3) {
            local = (p - t3) / fl;
            to = slotOf(0, j - turn, r);
          }
          if (local >= 0) {
            const col = clamp(Math.round(q + mid), 0, cols - 1);
            const delay = ((r + col) / span) * flipStg;
            angle = ease(easing, clamp((local - 0.15 - delay) / (0.7 - flipStg), 0, 1)) * Math.PI;
          }
          const flipped = angle > Math.PI / 2;
          c.slot = flipped ? to : from;
          const [w, h] = u.dims(c.slot);
          c.setSize(w, h);

          // Sheet → cylinder (inside view): sides swing toward the viewer.
          const sx = q * pitchX;
          const th = sx * kappa;
          const x = kappa > 1e-6 ? Math.sin(th) / kappa : sx;
          const z = kappa > 1e-6 ? (1 - Math.cos(th)) / kappa : 0;
          const y = ((rows - 1) / 2 - r) * pitchY;
          const a = Math.abs(th);
          const o =
            a > maxTh
              ? 0
              : clamp((maxTh - a) / 0.25, 0, 1) *
                clamp((maxZ - z) / (0.15 * maxZ), 0, 1) *
                clamp((M / 2 - 0.5 - Math.abs(q)) / 0.5, 0, 1);
          applyPose(
            c,
            pose({
              x,
              y: y * ct - z * st,
              z: y * st + z * ct,
              rx: tilt,
              ry: -th + (flipped ? angle - Math.PI : angle),
              s: fit(w, h, cellW * fill, cellH * fill) * Z,
              o,
              shade: (1 - 0.35 * Math.min(1, a / 1.2)) * (1 - 0.45 * Math.sin(angle)),
              order: Math.round(50 - a * 20),
            }),
          );
        });
      },
    };
  },
};

// ---------------------------------------------------------------------------

/*
 * Diagonal Wheel — diagonal carousel and ferris wheel on one strip. The cards
 * ride a diagonal line (shrinking toward both ends); the line then curls into a
 * circle, upright cabins hang from the rim and spin as a ferris wheel, and the
 * circle unrolls back into the diagonal. The same ring of cards is used the
 * whole time, so nothing pops or jumps and the loop closes on itself.
 */
export const diagonalWheel: TemplateDef = {
  id: 'diagonal-wheel',
  name: 'Diagonal Wheel',
  category: 'multiscene',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 36, cardRatio: '4:5', easing: 'smooth', motion: 'stepped', direction: 'up' },
  directions: [
    { value: 'up', label: 'Up-left' },
    { value: 'down', label: 'Down-right' },
  ],
  params: [
    num('angle', 'Line angle', 15, 75, 40, '°'),
    num('spacing', 'Line spacing', 20, 120, 55),
    num('falloff', 'Side scale', 40, 100, 78),
    num('radius', 'Wheel radius', 20, 120, 58),
    num('turn', 'Wheel turn', 0, 70, 22, '°'),
    num('swing', 'Cabin swing', 0, 100, 40),
    num('wheelTime', 'Wheel time', 10, 80, 40),
    transition(60),
  ],
  structure: (_p, n) => String(multipleAtLeast(n, 8)),
  build(b) {
    const N = multipleAtLeast(b.slotCount, 8);
    const cards = b.createCards(N);
    const seg = (p: number, a: number, z: number) => (z > a ? clamp((p - a) / (z - a), 0, 1) : 1);
    return {
      update(u) {
        const dir = u.str('direction') === 'down' ? -1 : 1;
        const s = dir * u.advance(u.p * u.slotCount);
        const ang = u.num('angle') * DEG;
        const f = pct(u, 'falloff');
        const R = pct(u, 'radius') * u.U;
        const turn = u.num('turn') * DEG;
        const swing = pct(u, 'swing') * 0.12;
        const [w0] = u.dims(0);
        const pitch = w0 * pct(u, 'spacing');
        const pw = (TAU * R) / N;
        const wheelScale = Math.min(1, (pw * 0.92) / w0);

        // Timeline: line hold | curl in | wheel | curl out | line hold.
        const S = (1 - pct(u, 'wheelTime')) / 2;
        const hold = S * (1 - pct(u, 'transition'));
        const pm = Math.min(u.p - Math.floor(u.p), 1 - (u.p - Math.floor(u.p)));
        const m = ease(u.str('easing'), seg(pm, hold, S));
        const kappa = m / R;
        const th = ang * (1 - m);
        const cth = Math.cos(th);
        const sth = Math.sin(th);
        const edge = Math.min(4.5, N / 2 - 0.5);
        u.root.rotation.y = turn * m;

        cards.forEach((c, i) => {
          const j = i + N * Math.round((s - i) / N);
          const a = (j - s) * dir;
          const d = Math.abs(a);
          const g = f > 0.999 ? d : (1 - Math.pow(f, d)) / (1 - f);
          const arc = lerp1(Math.sign(a) * g * pitch, a * pw, m);
          const phi = arc * kappa;
          const x = kappa > 1e-6 ? Math.sin(phi) / kappa : arc;
          const y = kappa > 1e-6 ? (1 - Math.cos(phi)) / kappa - m * R : 0;
          c.slot = j;
          const [w, h] = u.dims(j);
          c.setSize(w, h);
          const sc = lerp1(Math.pow(f, d), wheelScale, m);
          applyPose(
            c,
            pose({
              x: x * cth + y * sth,
              y: -x * sth + y * cth - h * 0.35 * m * sc,
              z: -d * 0.02 * (1 - m),
              ry: -turn * m,
              rz: Math.sin(TAU * u.p * N + i * 1.7) * swing * m,
              s: sc,
              o: lerp1(clamp(edge - d, 0, 1), 1, m),
              shade: lerp1(1 - Math.min(d, 4) * 0.1, 0.8 - 0.2 * Math.sin(phi) * Math.sin(turn), m),
              order: Math.round(10 - d),
            }),
          );
        });
      },
    };
  },
};
