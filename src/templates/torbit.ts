import type { TemplateDef } from './types';
import { LR, CW } from './helpers';
import { clamp, DEG, fract, TAU } from '@/lib/math';
import { ease } from '@/engine/easing';

export const orbitBloom: TemplateDef = {
  id: 'orbit-bloom',
  name: 'Orbit Bloom',
  category: 'orbit',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 30, cardRatio: '3:4', easing: 'smooth', motion: 'continuous', direction: 'cw' },
  directions: CW,
  params: [
    { type: 'number', key: 'radius', label: 'Radius', min: 0, max: 120, step: 1, unit: '%', default: 40 },
    { type: 'number', key: 'bloom', label: 'Bloom angle', min: 0, max: 80, step: 1, unit: '°', default: 50 },
    { type: 'number', key: 'tilt', label: 'View tilt', min: -60, max: 60, step: 1, unit: '°', default: 25 },
    { type: 'number', key: 'count', label: 'Petals', min: 4, max: 12, step: 1, default: 8, integer: true },
  ],
  structure: (p) => String(p.count),
  build(b) {
    const N = Number(b.params.count);
    const cards = b.createCards(N);
    return {
      update(u) {
        const dir = u.str('direction') === 'ccw' ? 1 : -1;
        const rot = (dir * u.advance(u.p * N) * TAU) / N;
        const R = (u.num('radius') / 100) * u.U;
        // Petals open and close twice per loop.
        const bloom = u.num('bloom') * DEG * (0.55 + 0.45 * Math.sin(TAU * 2 * u.p));
        u.root.rotation.x = -u.num('tilt') * DEG;
        cards.forEach((c, i) => {
          const th = (i / N) * TAU + rot;
          const [w, h] = u.dims(i);
          const r = R + h / 2;
          c.setSize(w, h);
          c.group.position.set(Math.cos(th) * r, Math.sin(th) * r, i * 0.0005);
          // Point the petal outward, then twist it around its own radial axis.
          c.group.rotation.set(0, bloom, th - Math.PI / 2, 'ZYX');
          c.shade = 0.65 + 0.35 * Math.cos(bloom);
        });
      },
    };
  },
};

export const ferrisWheel: TemplateDef = {
  id: 'ferris-wheel',
  name: 'Ferris Wheel',
  category: 'orbit',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 26, cardRatio: '4:5', easing: 'smooth', motion: 'continuous', direction: 'cw' },
  directions: CW,
  params: [
    { type: 'number', key: 'radius', label: 'Wheel radius', min: 20, max: 120, step: 1, unit: '%', default: 62 },
    { type: 'number', key: 'turn', label: 'Wheel turn', min: 0, max: 70, step: 1, unit: '°', default: 24 },
    { type: 'number', key: 'swing', label: 'Cabin swing', min: 0, max: 100, step: 1, unit: '%', default: 40 },
    { type: 'number', key: 'count', label: 'Cabins', min: 4, max: 14, step: 1, default: 8, integer: true },
  ],
  structure: (p) => String(p.count),
  build(b) {
    const N = Number(b.params.count);
    const cards = b.createCards(N);
    return {
      update(u) {
        const dir = u.str('direction') === 'ccw' ? 1 : -1;
        const rot = (dir * u.advance(u.p * N) * TAU) / N;
        const R = (u.num('radius') / 100) * u.U;
        const turn = u.num('turn') * DEG;
        const swing = (u.num('swing') / 100) * 0.12;
        u.root.rotation.y = turn;
        cards.forEach((c, i) => {
          const th = (i / N) * TAU + rot + Math.PI / 2;
          const [w, h] = u.dims(i);
          const px = Math.cos(th) * R;
          c.setSize(w, h);
          // Cabins hang below the rim, stay upright and face the camera.
          c.group.position.set(px, Math.sin(th) * R - h * 0.35, 0);
          c.group.rotation.set(0, -turn, Math.sin(TAU * u.p * N + i * 1.7) * swing);
          c.shade = 0.8 - 0.2 * (R > 0 ? (px * Math.sin(turn)) / R : 0);
        });
      },
    };
  },
};

export const orbitRings: TemplateDef = {
  id: 'orbit-rings',
  name: 'Orbit Rings',
  category: 'orbit',
  defaultSlots: 10,
  camera: 'perspective',
  defaults: { cardSize: 44, cardRatio: '4:5', easing: 'smooth', motion: 'stepped', direction: 'cw' },
  directions: CW,
  params: [
    { type: 'number', key: 'inner', label: 'Inner radius', min: 20, max: 150, step: 1, unit: '%', default: 62 },
    { type: 'number', key: 'outer', label: 'Outer radius', min: 40, max: 220, step: 1, unit: '%', default: 105 },
    { type: 'number', key: 'tilt', label: 'Ring tilt', min: 0, max: 85, step: 1, unit: '°', default: 24 },
    { type: 'number', key: 'ringSize', label: 'Ring card size', min: 15, max: 80, step: 1, unit: '%', default: 38 },
  ],
  build(b) {
    const [heroA, heroB] = b.createCards(2);
    const inner = b.createCards(6);
    const outer = b.createCards(10);
    return {
      update(u) {
        const x = u.p * u.slotCount;
        const k = Math.floor(x);
        const f = fract(x);
        const L = u.str('motion') === 'stepped' ? 0.3 : 1;
        const q = ease(u.str('easing'), clamp((f - (1 - L)) / L, 0, 1));
        heroA.slot = k;
        heroA.setSize(...u.dims(k));
        heroB.slot = k + 1;
        heroB.setSize(...u.dims(k + 1));
        heroB.group.position.z = 0.002;
        heroB.opacity = q;

        const dir = u.str('direction') === 'ccw' ? -1 : 1;
        const tilt = u.num('tilt') * DEG;
        const scale = u.num('ringSize') / 100;
        const ring = (cards: typeof inner, R: number, spin: number, slot0: number) => {
          cards.forEach((c, i) => {
            const th = (i / cards.length) * TAU + spin;
            const front = Math.cos(th);
            c.slot = slot0 + i;
            c.setSize(...u.dims(c.slot, scale));
            // Ring lies in the XZ plane, tipped toward the camera by `tilt`.
            c.group.position.set(Math.sin(th) * R, -front * R * Math.sin(tilt), front * R * Math.cos(tilt));
            c.shade = 0.6 + 0.4 * ((front + 1) / 2);
          });
        };
        ring(inner, (u.num('inner') / 100) * u.U, dir * TAU * u.p, 1);
        ring(outer, (u.num('outer') / 100) * u.U, -dir * TAU * u.p + 0.3, 7);
      },
    };
  },
};

const orbitCount = (n: number) => clamp(n, 4, 12);

export const orbitCarousel: TemplateDef = {
  id: 'orbit-carousel',
  name: 'Orbit Carousel',
  category: 'orbit',
  defaultSlots: 8,
  camera: 'perspective',
  defaults: { cardSize: 32, cardRatio: '3:4', easing: 'smooth', motion: 'continuous', direction: 'left' },
  directions: LR,
  params: [
    { type: 'number', key: 'width', label: 'Orbit width', min: 30, max: 160, step: 1, unit: '%', default: 85 },
    { type: 'number', key: 'depth', label: 'Orbit depth', min: 10, max: 160, step: 1, unit: '%', default: 70 },
    { type: 'number', key: 'tilt', label: 'Tilt', min: 0, max: 45, step: 1, unit: '°', default: 14 },
  ],
  structure: (_p, n) => String(orbitCount(n)),
  build(b) {
    const N = orbitCount(b.slotCount);
    const cards = b.createCards(N);
    return {
      update(u) {
        const dir = u.str('direction') === 'right' ? -1 : 1;
        const rot = (dir * u.advance(u.p * N) * TAU) / N;
        const ow = (u.num('width') / 100) * u.U;
        const od = (u.num('depth') / 100) * u.U;
        const tilt = u.num('tilt') * DEG;
        u.root.rotation.x = tilt;
        cards.forEach((c, i) => {
          const th = (i / N) * TAU + rot;
          const front = Math.cos(th);
          const [w, h] = u.dims(i);
          c.setSize(w, h);
          c.group.position.set(Math.sin(th) * ow, 0, front * od - od);
          c.group.rotation.x = -tilt;
          c.group.scale.setScalar(1 + 0.2 * Math.max(0, front));
          c.shade = 0.45 + 0.55 * ((front + 1) / 2);
        });
      },
    };
  },
};

export const photoOrbit: TemplateDef = {
  id: 'photo-orbit',
  name: 'Photo Orbit',
  category: 'orbit',
  defaultSlots: 12,
  camera: 'perspective',
  defaults: { cardSize: 22, cardRatio: '1:1', easing: 'linear', motion: 'continuous', direction: 'cw' },
  directions: CW,
  params: [
    { type: 'number', key: 'radius', label: 'Ring radius', min: 15, max: 110, step: 1, unit: '%', default: 55 },
    { type: 'number', key: 'cardRotation', label: 'Card rotation', min: 0, max: 100, step: 1, unit: '%', default: 100 },
    { type: 'number', key: 'count', label: 'Card count', min: 6, max: 24, step: 1, default: 12, integer: true },
    { type: 'number', key: 'tilt', label: 'Tilt', min: 0, max: 60, step: 1, unit: '°', default: 0 },
  ],
  structure: (p) => String(p.count),
  build(b) {
    const M = Number(b.params.count);
    const cards = b.createCards(M);
    return {
      update(u) {
        const dir = u.str('direction') === 'ccw' ? 1 : -1;
        const rot = (dir * u.advance(u.p * M) * TAU) / M;
        const R = (u.num('radius') / 100) * u.U;
        const cr = u.num('cardRotation') / 100;
        u.root.rotation.x = -u.num('tilt') * DEG;
        cards.forEach((c, i) => {
          const th = (i / M) * TAU + rot + Math.PI / 2;
          const [w, h] = u.dims(i);
          c.setSize(w, h);
          c.group.position.set(Math.cos(th) * R, Math.sin(th) * R, i * 0.0005);
          c.group.rotation.z = (th - Math.PI / 2) * cr;
        });
      },
    };
  },
};
