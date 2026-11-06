import { useSyncExternalStore } from 'react';
import { Engine } from './renderer';
import { TEMPLATES } from '@/templates/registry';
import { createProject, makeSlots } from '@/state/defaults';

/**
 * Template thumbnails, rendered once per session with the same deterministic engine used
 * for preview/export (placeholder cards, fixed mid-loop time).
 */
const thumbs = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;
let started = false;

const W = 320;
const H = 240;

async function generate() {
  let engine: Engine | null = null;
  try {
    engine = new Engine(W, H);
    for (const def of TEMPLATES) {
      const p = createProject();
      p.templateId = def.id;
      p.aspect = '4:3';
      p.slots = makeSlots(def.defaultSlots);
      p.background = { type: 'gradient', from: '#26262c', to: '#141417', angle: 160 };
      p.shared.padding = 4;
      engine.render(p, p.duration * 0.37, { placeholders: true, overlays: false });
      thumbs.set(def.id, engine.canvas.toDataURL('image/jpeg', 0.82));
      version++;
      listeners.forEach((l) => l());
      // Yield so the UI stays responsive while thumbnails render.
      await new Promise((r) => setTimeout(r, 16));
    }
  } catch {
    /* WebGL unavailable: cards fall back to their labels */
  } finally {
    engine?.dispose();
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!started) {
    started = true;
    setTimeout(() => void generate(), 300);
  }
  return () => listeners.delete(fn);
}

export function useTemplateThumb(id: string) {
  useSyncExternalStore(subscribe, () => version);
  return thumbs.get(id) ?? null;
}

/* ---------- Hover animation ---------- */
let hoverEngine: Engine | null = null;

/** Animates a template into the given 2D canvas (looping, real time). Returns a stop function. */
export function startHoverPreview(id: string, target: HTMLCanvasElement): () => void {
  const def = TEMPLATES.find((t) => t.id === id);
  if (!def) return () => {};
  try {
    hoverEngine ??= new Engine(W, H);
  } catch {
    return () => {};
  }
  const engine = hoverEngine;
  const p = createProject();
  p.templateId = def.id;
  p.aspect = '4:3';
  p.slots = makeSlots(def.defaultSlots);
  p.background = { type: 'gradient', from: '#26262c', to: '#141417', angle: 160 };
  p.shared.padding = 4;
  target.width = W;
  target.height = H;
  const ctx = target.getContext('2d');
  let raf = 0;
  let stopped = false;
  const start = performance.now();
  const dur = Math.max(0.1, p.duration);
  const frame = (now: number) => {
    if (stopped) return;
    const t = (((now - start) / 1000) % dur + dur) % dur;
    try {
      engine.render(p, t, { placeholders: true, overlays: false });
      ctx?.drawImage(engine.canvas, 0, 0, W, H);
    } catch {
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
