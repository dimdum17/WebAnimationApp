export type EasingId = 'linear' | 'smooth' | 'snappy' | 'elastic';

export const EASING_OPTIONS: { value: EasingId; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'smooth', label: 'Smooth' },
  { value: 'snappy', label: 'Snappy' },
  { value: 'elastic', label: 'Elastic' },
];

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const easeInOutQuint = (t: number) =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;

const easeOutBack = (t: number) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export function ease(id: string, t: number): number {
  switch (id) {
    case 'smooth':
      return easeInOutCubic(t);
    case 'snappy':
      return easeInOutQuint(t);
    case 'elastic':
      return easeOutBack(t);
    default:
      return t;
  }
}
