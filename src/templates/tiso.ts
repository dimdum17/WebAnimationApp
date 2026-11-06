import * as THREE from 'three';
import type { TemplateDef } from './types';
import { multipleAtLeast, LR, CW, wrapSigned } from './helpers';
import { clamp, DEG, mod, TAU } from '@/lib/math';
import { easeInOutCubic } from '@/engine/easing';

const isoOrbitCount = (n: number) => clamp(n, 5, 14);

export const isoOrbit: TemplateDef = {
  id: 'iso-orbit',
  name: 'Iso Orbit',
  category: 'isometric',
  defaultSlots: 8,
  camera: 'orthographic',
  defaults: { cardSize: 34, cardRatio: '1:1', easing: 'smooth', motion: 'continuous', direction: 'cw' },
  directions: CW,
  params: [
    { type: 'number', key: 'tilt', label: 'Tilt', min: 0, max: 100, step: 1, unit: '%', default: 70 },
    { type: 'number', key: 'radius', label: 'Orbit radius', min: 30, max: 150, step: 1, unit: '%', default: 72 },
    { type: 'number', key: 'float', label: 'Float', min: 0, max: 100, step: 1, unit: '%', default: 30 },
  ],
  structure: (_p, n) => String(isoOrbitCount(n)),
  build(b) {
    const N = isoOrbitCount(b.slotCount);
    const iso = new THREE.Group();
    b.root.add(iso);
    const cards = b.createCards(N, iso);
    return {
      update(u) {
        // Rotate 45° in-plane first, then tip the plane back: the classic iso diamond.
        iso.rotation.set((u.num('tilt') / 100) * 55 * DEG, 0, 45 * DEG);
        const dir = u.str('direction') === 'ccw' ? 1 : -1;
        const rot = (dir * u.advance(u.p * N) * TAU) / N;
        const R = (u.num('radius') / 100) * u.U;
        const bob = (u.num('float') / 100) * 0.15 * u.U;
        cards.forEach((c, i) => {
          const th = (i / N) * TAU + rot;
          c.setSize(...u.dims(i));
          c.group.position.set(Math.cos(th) * R, Math.sin(th) * R, bob * (0.5 + 0.5 * Math.sin(TAU * 2 * u.p + i * 1.3)));
          c.shade = 0.84 - 0.16 * Math.sin(th + Math.PI / 4);
        });
      },
    };
  },
};

function isoWaveShape(cols: number, A: number) {
  const cell = (2 * Math.max(A, 1)) / cols;
  const span = 2 * Math.sqrt(A * A + 1) * 1.5;
  return { cell, span, G: Math.ceil(span / cell) + 2 };
}

export const isoWave: TemplateDef = {
  id: 'iso-wave',
  name: 'Iso Wave',
  category: 'isometric',
  defaultSlots: 10,
  camera: 'orthographic',
  defaults: { cardSize: 84, cardRatio: '1:1', easing: 'linear', motion: 'continuous', direction: 'right' },
  directions: LR,
  params: [
    { type: 'number', key: 'tilt', label: 'Tilt', min: 0, max: 100, step: 1, unit: '%', default: 70 },
    { type: 'number', key: 'lift', label: 'Wave height', min: 0, max: 100, step: 1, unit: '%', default: 50 },
    { type: 'number', key: 'columns', label: 'Columns', min: 3, max: 7, step: 1, default: 4, integer: true },
    { type: 'number', key: 'waves', label: 'Waves per loop', min: 1, max: 4, step: 1, default: 2, integer: true },
  ],
  structure: (p, n) => `${p.columns}|${n}`,
  build(b) {
    const cols = Number(b.params.columns);
    const { G } = isoWaveShape(cols, b.A);
    const M = multipleAtLeast(b.slotCount, G);
    const iso = new THREE.Group();
    b.root.add(iso);
    const cards = b.createCards(G * M, iso);
    return {
      update(u) {
        const { cell, span } = isoWaveShape(cols, u.A);
        const tilt = u.num('tilt') / 100;
        u.root.rotation.z = 35 * DEG;
        iso.rotation.set(tilt * 35 * DEG, -tilt * 50 * DEG, 0);
        const dir = u.str('direction') === 'left' ? -1 : 1;
        const s = dir * u.advance(u.p * u.slotCount);
        const amp = (u.num('lift') / 100) * cell * 1.2;
        const W = u.num('waves');
        const fill = u.num('cardSize') / 100;
        const limit = span / 2 + cell;
        cards.forEach((c, i) => {
          const r = Math.floor(i / M);
          const k = i % M;
          const x = (mod(k + s, M) - M / 2) * cell;
          if (Math.abs(x) > limit) {
            c.group.visible = false;
            return;
          }
          const y = (r - (G - 1) / 2) * cell;
          const h01 = 0.5 + 0.5 * Math.sin(TAU * W * u.p - ((x + y) / cell) * 0.55);
          c.slot = k + r * 3;
          const [w, h] = u.dims(c.slot);
          const sc = (cell * fill) / Math.max(w, h);
          c.setSize(w * sc, h * sc);
          c.group.position.set(x, y, amp * h01 * h01);
          c.shade = 0.72 + 0.28 * h01;
        });
      },
    };
  },
};

const ISO_DIRS = [
  { value: 'up-right', label: 'Up-right' },
  { value: 'down-left', label: 'Down-left' },
  { value: 'down-right', label: 'Down-right' },
  { value: 'up-left', label: 'Up-left' },
];

export const isoCascade: TemplateDef = {
  id: 'iso-cascade',
  name: 'Iso Cascade',
  category: 'isometric',
  defaultSlots: 10,
  camera: 'orthographic',
  defaults: { cardSize: 42, cardRatio: '1:1', easing: 'smooth', motion: 'continuous', direction: 'up-right' },
  directions: ISO_DIRS,
  params: [
    { type: 'number', key: 'tilt', label: 'Tilt', min: 0, max: 100, step: 1, unit: '%', default: 70 },
    { type: 'number', key: 'spacing', label: 'Spacing', min: 5, max: 100, step: 1, unit: '%', default: 40 },
  ],
  structure: (_p, n) => String(multipleAtLeast(n, 36)),
  build(b) {
    const lanes = 3;
    const M = multipleAtLeast(b.slotCount, 36);
    const iso = new THREE.Group();
    b.root.add(iso);
    const cards = b.createCards(lanes * M, iso);
    return {
      update(u) {
        const d = u.str('direction');
        const rz = d === 'up-right' || d === 'down-left' ? 35 : -35;
        const sign = d === 'up-right' || d === 'down-right' ? 1 : -1;
        const tilt = u.num('tilt') / 100;
        u.root.rotation.z = rz * DEG;
        iso.rotation.set(tilt * 35 * DEG, -tilt * 50 * DEG, 0);
        const s = sign * u.advance(u.p * u.slotCount);
        const [w0, h0] = u.dims(0);
        const pitch = w0 * (0.15 + u.num('spacing') / 100);
        const laneGap = h0 * 1.12;
        const limit = (u.A + 1) * 2.2 + w0;
        cards.forEach((c, i) => {
          const lane = Math.floor(i / M);
          const k = i % M;
          const x = (mod(k + s + lane * 0.5, M) - M / 2) * pitch;
          if (Math.abs(x) > limit) {
            c.group.visible = false;
            return;
          }
          c.slot = k + lane * 3;
          const [w, h] = u.dims(c.slot);
          c.setSize(w, h);
          c.group.position.set(x, (lane - (lanes - 1) / 2) * laneGap, k * 0.0001);
          c.shade = 1 - Math.abs(lane - 1) * 0.08;
        });
      },
    };
  },
};

const focusCount = (n: number) => clamp(n, 3, 10);

export const isoFocus: TemplateDef = {
  id: 'iso-focus',
  name: 'Iso Focus',
  category: 'isometric',
  defaultSlots: 8,
  camera: 'orthographic',
  defaults: { cardSize: 34, cardRatio: '4:5', easing: 'smooth', motion: 'stepped', direction: 'right' },
  directions: LR,
  params: [
    { type: 'number', key: 'tilt', label: 'Tilt', min: 0, max: 100, step: 1, unit: '%', default: 65 },
    { type: 'number', key: 'lift', label: 'Lift', min: 0, max: 100, step: 1, unit: '%', default: 45 },
    { type: 'number', key: 'spacing', label: 'Spacing', min: 5, max: 100, step: 1, unit: '%', default: 32 },
  ],
  structure: (_p, n) => String(focusCount(n)),
  build(b) {
    const K = focusCount(b.slotCount);
    const cards = b.createCards(K);
    const qIso = new THREE.Quaternion();
    const qFace = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    return {
      update(u) {
        const dir = u.str('direction') === 'left' ? -1 : 1;
        const tilt = u.num('tilt') / 100;
        e.set(tilt * 35 * DEG, -tilt * 50 * DEG, 0);
        qIso.setFromEuler(e);
        const f = mod(dir * u.advance(u.p * K), K);
        const [w0] = u.dims(0);
        const pitch = w0 * (0.15 + u.num('spacing') / 100);
        const lift = (u.num('lift') / 100) * u.U * 0.5;
        cards.forEach((c, i) => {
          const d = wrapSigned(i - f, K);
          const near = easeInOutCubic(clamp(1 - Math.abs(d), 0, 1));
          const [w, h] = u.dims(i);
          c.setSize(w, h);
          v.set((i - (K - 1) / 2) * pitch, 0, 0).applyQuaternion(qIso);
          c.group.position.set(v.x, v.y + near * lift, v.z + near * 5);
          c.group.quaternion.copy(qIso).slerp(qFace, near);
          c.group.scale.setScalar(1 + near * 0.3);
          c.shade = 0.75 + 0.25 * near;
        });
      },
    };
  },
};
