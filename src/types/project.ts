export type Aspect = '16:9' | '4:3' | '1:1' | '4:5' | '3:4' | '9:16';

export const ASPECTS: Aspect[] = ['16:9', '4:3', '1:1', '4:5', '3:4', '9:16'];

export function aspectRatio(a: Aspect): number {
  const [w, h] = a.split(':').map(Number);
  return w / h;
}

export type ParamValue = number | string | boolean;

export type KeyframeEasing = 'linear' | 'smooth' | 'hold';

export interface Keyframe {
  id: string;
  /** Normalized 0..1 relative to loop duration. */
  time: number;
  value: number;
  easing: KeyframeEasing;
}

export type Background =
  | { type: 'colour'; color: string }
  | { type: 'gradient'; from: string; to: string; angle: number }
  | { type: 'image'; assetId: string | null; dim: number };

export type FontId =
  | 'Inter'
  | 'Space Grotesk'
  | 'Playfair Display'
  | 'DM Serif Display'
  | 'Bebas Neue'
  | 'JetBrains Mono';

export const FONTS: FontId[] = [
  'Inter',
  'Space Grotesk',
  'Playfair Display',
  'DM Serif Display',
  'Bebas Neue',
  'JetBrains Mono',
];

export interface TextLayer {
  id: string;
  visible: boolean;
  content: string;
  font: FontId;
  weight: 400 | 500 | 600 | 700;
  /** % of frame height */
  size: number;
  color: string;
  align: 'left' | 'center' | 'right';
  /** em * 100 */
  letterSpacing: number;
  /** % of frame */
  x: number;
  y: number;
  /** 0..100 */
  opacity: number;
  animIn: 'none' | 'fade' | 'slide-up' | 'scale';
}

export type LogoAnchor = 'tl' | 'tr' | 'bl' | 'br' | 'center';

export interface LogoLayer {
  assetId: string;
  visible: boolean;
  anchor: LogoAnchor;
  /** % of frame width */
  offsetX: number;
  offsetY: number;
  /** % of frame width */
  size: number;
  /** 0..100 */
  opacity: number;
}

export interface Slot {
  id: string;
  assetId: string | null;
}

export interface Project {
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  aspect: Aspect;
  templateId: string;
  slots: Slot[];
  duration: number;
  background: Background;
  mediaVisible: boolean;
  shared: Record<string, ParamValue>;
  templateParams: Record<string, Record<string, ParamValue>>;
  keyframes: Record<string, Keyframe[]>;
  texts: TextLayer[];
  logo: LogoLayer | null;
}

export interface ProjectRecord {
  project: Project;
  thumbnail: string | null;
}

export const MAX_SLOTS = 20;
export const MIN_DURATION = 5;
export const MAX_DURATION = 30;
