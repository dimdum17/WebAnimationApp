import { uid } from '@/lib/id';
import type { Project, Slot, TextLayer } from '@/types/project';
import { SHARED_DEFAULTS } from '@/templates/shared';
import { getTemplate, DEFAULT_TEMPLATE_ID } from '@/templates/registry';

export function makeSlots(n: number): Slot[] {
  return Array.from({ length: n }, () => ({ id: uid('s_'), assetId: null }));
}

export function createProject(name = 'Untitled showcase'): Project {
  const def = getTemplate(DEFAULT_TEMPLATE_ID);
  const now = Date.now();
  return {
    version: 1,
    id: uid('p_'),
    name,
    createdAt: now,
    updatedAt: now,
    aspect: '9:16',
    templateId: def.id,
    slots: makeSlots(def.defaultSlots),
    duration: 10,
    background: { type: 'colour', color: '#101014' },
    mediaVisible: true,
    shared: { ...SHARED_DEFAULTS },
    templateParams: {},
    keyframes: {},
    texts: [],
    logo: null,
  };
}

export function createTextLayer(): TextLayer {
  return {
    id: uid('t_'),
    visible: true,
    content: 'Your headline',
    font: 'Space Grotesk',
    weight: 600,
    size: 6,
    color: '#ffffff',
    align: 'center',
    letterSpacing: -2,
    x: 50,
    y: 14,
    opacity: 100,
    animIn: 'fade',
  };
}

/** Fills in missing fields for projects saved by older builds. */
export function normalizeProject(raw: Partial<Project>): Project {
  const base = createProject();
  const p = { ...base, ...raw } as Project;
  p.version = 1;
  p.shared = { ...SHARED_DEFAULTS, ...(raw.shared ?? {}) };
  p.templateParams = raw.templateParams ?? {};
  p.keyframes = raw.keyframes ?? {};
  p.texts = raw.texts ?? [];
  p.logo = raw.logo ?? null;
  if (!Array.isArray(p.slots) || p.slots.length === 0) p.slots = makeSlots(1);
  try {
    getTemplate(p.templateId);
  } catch {
    p.templateId = DEFAULT_TEMPLATE_ID;
  }
  if (p.mediaVisible === undefined) p.mediaVisible = true;
  return p;
}
