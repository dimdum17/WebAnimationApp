import { EASING_OPTIONS } from '@/engine/easing';
import type { ChoiceParam, NumberParam, ParamDef, TemplateDef, Params } from './types';
import type { Project } from '@/types/project';

export const CARD_RATIOS = ['auto', '1:1', '4:3', '3:4', '4:5', '16:9', '9:16'];

/** Global params shared across templates. */
export const SHARED_PARAMS: NumberParam[] = [
  { type: 'number', key: 'padding', label: 'Padding', min: 0, max: 30, step: 0.5, unit: '%', default: 6 },
  { type: 'number', key: 'cornerRadius', label: 'Corner radius', min: 0, max: 25, step: 0.5, unit: '%', default: 3 },
];

export const SHADOW_PARAMS: NumberParam[] = [
  { type: 'number', key: 'shadowX', label: 'X', min: -10, max: 10, step: 0.1, unit: '%', default: 0 },
  { type: 'number', key: 'shadowY', label: 'Y', min: -10, max: 10, step: 0.1, unit: '%', default: 1 },
  { type: 'number', key: 'shadowBlur', label: 'Blur', min: 0, max: 10, step: 0.1, unit: '%', default: 1.5 },
  { type: 'number', key: 'shadowSpread', label: 'Spread', min: -5, max: 5, step: 0.05, unit: '%', default: -0.25 },
  { type: 'number', key: 'shadowOpacity', label: 'Opacity', min: 0, max: 100, step: 1, unit: '%', default: 40 },
];

export const SHARED_DEFAULTS: Params = {
  padding: 6,
  cornerRadius: 3,
  shadowEnabled: false,
  shadowX: 0,
  shadowY: 1,
  shadowBlur: 1.5,
  shadowSpread: -0.25,
  shadowOpacity: 40,
  shadowColor: '#000000',
};

/** Per-template common params (card size, ratio, easing, motion, direction). */
export function commonParams(def: TemplateDef): ParamDef[] {
  const cardSize: NumberParam = {
    type: 'number',
    key: 'cardSize',
    label: 'Card size',
    min: 10,
    max: 100,
    step: 1,
    unit: '%',
    default: def.defaults.cardSize,
  };
  const ratio: ChoiceParam = {
    type: 'segmented',
    key: 'cardRatio',
    label: 'Card ratio',
    options: CARD_RATIOS.map((r) => ({ value: r, label: r === 'auto' ? 'Auto' : r })),
    default: def.defaults.cardRatio,
  };
  const easing: ChoiceParam = {
    type: 'select',
    key: 'easing',
    label: 'Easing',
    options: EASING_OPTIONS,
    default: def.defaults.easing,
  };
  const motion: ChoiceParam = {
    type: 'segmented',
    key: 'motion',
    label: 'Motion',
    options: [
      { value: 'continuous', label: 'Continuous' },
      { value: 'stepped', label: 'Stepped' },
    ],
    default: def.defaults.motion,
  };
  const direction: ChoiceParam = {
    type: 'segmented',
    key: 'direction',
    label: 'Direction',
    options: def.directions,
    default: def.defaults.direction,
  };
  return [cardSize, ratio, easing, motion, direction];
}

export function allTemplateParams(def: TemplateDef): ParamDef[] {
  return [...commonParams(def), ...def.params];
}

/** Common params shown in the panel: drops ones the template hides or has no options for. */
export function visibleCommonParams(def: TemplateDef): ParamDef[] {
  const hidden = new Set<string>(def.hide ?? []);
  if (def.directions.length === 0) hidden.add('direction');
  return commonParams(def).filter((p) => !hidden.has(p.key));
}

export function templateDefaults(def: TemplateDef): Params {
  const out: Params = {};
  for (const p of allTemplateParams(def)) out[p.key] = p.default;
  return out;
}

export function isKeyframeable(p: ParamDef): p is NumberParam {
  return p.type === 'number' && !p.integer;
}

export function sharedPath(key: string) {
  return `shared.${key}`;
}
export function tplPath(templateId: string, key: string) {
  return `tpl.${templateId}.${key}`;
}

export function getTemplateValue(project: Project, def: TemplateDef, key: string) {
  const stored = project.templateParams[def.id]?.[key];
  if (stored !== undefined) return stored;
  const pd = allTemplateParams(def).find((p) => p.key === key);
  return pd?.default;
}
