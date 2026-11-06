import type * as THREE from 'three';
import type { Card } from '@/engine/card';
import type { ParamValue } from '@/types/project';

export type CategoryId =
  | '3d'
  | 'multiscene'
  | 'bento'
  | 'isometric'
  | 'orbit'
  | 'carousel'
  | 'grid'
  | 'spotlight'
  | 'reveal'
  | 'stack';

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: '3d', label: '3D & Perspective' },
  { id: 'multiscene', label: 'Multiscene' },
  { id: 'bento', label: 'Bento' },
  { id: 'isometric', label: 'Isometric' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'carousel', label: 'Carousel & Flow' },
  { id: 'grid', label: 'Grid' },
  { id: 'spotlight', label: 'Spotlight & Focus' },
  { id: 'reveal', label: 'Reveal & Wipe' },
  { id: 'stack', label: 'Stack & Scatter' },
];

export interface Option {
  value: string;
  label: string;
}

export interface NumberParam {
  type: 'number';
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  default: number;
  /** Integer params are not keyframeable (they change structure). */
  integer?: boolean;
}

export interface ChoiceParam {
  type: 'segmented' | 'select';
  key: string;
  label: string;
  options: Option[];
  default: string;
}

export interface BoolParam {
  type: 'bool';
  key: string;
  label: string;
  default: boolean;
}

export interface ColorParam {
  type: 'color';
  key: string;
  label: string;
  default: string;
}

export type ParamDef = NumberParam | ChoiceParam | BoolParam | ColorParam;

export type Params = Record<string, ParamValue>;

/** Common per-template controls that a template can opt out of. */
export type CommonParamKey = 'cardSize' | 'cardRatio' | 'easing' | 'motion' | 'direction';

export interface FrameInfo {
  /** Half width of the frame in world units (frame half height is 1). */
  A: number;
  /** Frame's short side in world units. */
  U: number;
}

export interface BuildCtx extends FrameInfo {
  root: THREE.Group;
  slotCount: number;
  params: Params;
  /** Creates `n` cards and adds them to `parent` (defaults to root). */
  createCards(n: number, parent?: THREE.Object3D): Card[];
}

export interface UpdateCtx extends FrameInfo {
  /** Normalized loop progress 0..1 */
  p: number;
  t: number;
  duration: number;
  params: Params;
  slotCount: number;
  root: THREE.Group;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  /** Applies the template's easing/motion to a step position. */
  advance(x: number): number;
  /** Card width/height in world units for a slot, from card size & ratio. */
  dims(slot: number, scale?: number): [number, number];
  num(key: string): number;
  str(key: string): string;
}

export interface TemplateInstance {
  update(ctx: UpdateCtx): void;
  dispose?(): void;
}

export interface TemplateDef {
  id: string;
  name: string;
  category: CategoryId;
  defaultSlots: number;
  camera: 'perspective' | 'orthographic';
  fov?: number;
  defaults: {
    cardSize: number;
    cardRatio: string;
    easing: string;
    motion: 'continuous' | 'stepped';
    direction: string;
  };
  directions: Option[];
  /** Common controls this template ignores; they are hidden in the panel. */
  hide?: CommonParamKey[];
  params: ParamDef[];
  /** Values that, when changed, require rebuilding the scene. */
  structure?(params: Params, slotCount: number, frame: FrameInfo): string;
  build(ctx: BuildCtx): TemplateInstance;
}
