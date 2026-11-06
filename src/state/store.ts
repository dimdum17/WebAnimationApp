import { create } from 'zustand';
import type { Keyframe, Project } from '@/types/project';
import { createProject } from './defaults';
import { findKeyAt } from '@/engine/keyframes';
import { uid } from '@/lib/id';

export type Theme = 'dark' | 'light';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'error' | 'success';
}

interface State {
  project: Project;
  time: number;
  playing: boolean;
  past: Project[];
  future: Project[];
  gesture: boolean;
  gesturePushed: boolean;

  leftTab: 'templates' | 'layers';
  focusSection: { id: string; nonce: number } | null;
  keyframesOpen: boolean;
  selectedKey: { path: string; id: string } | null;
  theme: Theme;
  exportOpen: boolean;
  projectsOpen: boolean;
  exporting: boolean;
  toasts: Toast[];

  edit(fn: (draft: Project) => void): void;
  beginGesture(): void;
  endGesture(): void;
  undo(): void;
  redo(): void;
  loadProject(p: Project): void;
  setTime(t: number): void;
  setPlaying(p: boolean): void;
  set(partial: Partial<State>): void;
  toast(message: string, tone?: Toast['tone']): void;
}

const HISTORY_LIMIT = 100;

function initialTheme(): Theme {
  try {
    const t = localStorage.getItem('gk-theme');
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* ignore */
  }
  return 'dark';
}

export const useStore = create<State>((set, get) => ({
  project: createProject(),
  time: 0,
  playing: true,
  past: [],
  future: [],
  gesture: false,
  gesturePushed: false,
  leftTab: 'templates',
  focusSection: null,
  keyframesOpen: false,
  selectedKey: null,
  theme: initialTheme(),
  exportOpen: false,
  projectsOpen: false,
  exporting: false,
  toasts: [],

  edit(fn) {
    const { project, past, gesture, gesturePushed } = get();
    const draft = structuredClone(project);
    fn(draft);
    draft.updatedAt = Date.now();
    const push = !gesture || !gesturePushed;
    set({
      project: draft,
      past: push ? [...past, project].slice(-HISTORY_LIMIT) : past,
      future: push ? [] : get().future,
      gesturePushed: gesture ? true : gesturePushed,
    });
  },
  beginGesture() {
    set({ gesture: true, gesturePushed: false });
  },
  endGesture() {
    set({ gesture: false, gesturePushed: false });
  },
  undo() {
    const { past, project, future } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], selectedKey: null });
  },
  redo() {
    const { past, project, future } = get();
    if (!future.length) return;
    const next = future[0];
    set({ project: next, past: [...past, project], future: future.slice(1), selectedKey: null });
  },
  loadProject(p) {
    set({ project: p, past: [], future: [], time: 0, selectedKey: null });
  },
  setTime(t) {
    set({ time: t });
  },
  setPlaying(p) {
    set({ playing: p });
  },
  set(partial) {
    set(partial);
  },
  toast(message, tone = 'info') {
    const id = uid('toast_');
    set({ toasts: [...get().toasts, { id, message, tone }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3800);
  },
}));

export const t01Of = (time: number, duration: number) =>
  Math.min(1, Math.max(0, time / duration));

// ---------- Value + keyframe helpers ----------

function sortKeys(kfs: Keyframe[]) {
  kfs.sort((a, b) => a.time - b.time);
}

/**
 * Writes a numeric value. If the path is animated, upserts a keyframe at the current
 * time (auto-key); otherwise calls `writeStatic`.
 */
export function setAnimatable(path: string, value: number, writeStatic: (d: Project) => void) {
  const { time, edit } = useStore.getState();
  edit((d) => {
    const kfs = d.keyframes[path];
    if (kfs && kfs.length) {
      const t = t01Of(time, d.duration);
      const hit = findKeyAt(kfs, t, d.duration);
      if (hit) hit.value = value;
      else {
        kfs.push({ id: uid('k_'), time: t, value, easing: 'smooth' });
        sortKeys(kfs);
      }
    } else {
      writeStatic(d);
    }
  });
}

/** Diamond click: add keyframe at current time, or remove if one exists there. */
export function toggleKeyframe(path: string, currentValue: number) {
  const { time, edit } = useStore.getState();
  edit((d) => {
    const t = t01Of(time, d.duration);
    const kfs = d.keyframes[path] ?? [];
    const hit = findKeyAt(kfs, t, d.duration);
    if (hit) {
      const rest = kfs.filter((k) => k !== hit);
      if (rest.length) d.keyframes[path] = rest;
      else delete d.keyframes[path];
    } else {
      kfs.push({ id: uid('k_'), time: t, value: currentValue, easing: 'smooth' });
      sortKeys(kfs);
      d.keyframes[path] = kfs;
    }
  });
}

export function removeKeyframesWithPrefix(d: Project, prefix: string) {
  for (const k of Object.keys(d.keyframes)) if (k.startsWith(prefix)) delete d.keyframes[k];
}
