import type { Option } from './types';

export const LR: Option[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];
export const UD: Option[] = [
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
];
export const FB: Option[] = [
  { value: 'forward', label: 'Forward' },
  { value: 'backward', label: 'Backward' },
];
export const CW: Option[] = [
  { value: 'cw', label: 'Clockwise' },
  { value: 'ccw', label: 'Counter' },
];

/** Wraps `v` into [-n/2, n/2). */
export function wrapSigned(v: number, n: number) {
  return ((((v + n / 2) % n) + n) % n) - n / 2;
}

/** Smallest multiple of `n` that is >= `min`. */
export function multipleAtLeast(n: number, min: number) {
  return n * Math.ceil(min / n);
}
