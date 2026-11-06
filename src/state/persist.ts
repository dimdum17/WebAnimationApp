import { useStore } from './store';
import { createProject } from './defaults';
import {
  StorageFullError,
  collectGarbage,
  deleteProjectRecord,
  loadProjectRecord,
  projectAssetIds,
  saveProjectRecord,
} from '@/persistence/db';
import { capturePreviewThumbnail } from '@/engine/preview';
import type { Project } from '@/types/project';

const LAST_KEY = 'gk-last-project';
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let warnedFull = false;

function rememberLast(id: string) {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Asset ids referenced by the open project and its undo/redo history. */
export function liveAssetIds(): string[] {
  const { project, past, future } = useStore.getState();
  return [project, ...past, ...future].flatMap(projectAssetIds);
}

export async function saveNow(project: Project = useStore.getState().project) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  try {
    await saveProjectRecord({ project, thumbnail: capturePreviewThumbnail() });
    rememberLast(project.id);
    warnedFull = false;
  } catch (e) {
    if (e instanceof StorageFullError) {
      if (!warnedFull) useStore.getState().toast('Storage full — delete old projects to keep saving', 'error');
      warnedFull = true;
    }
  }
}

/** Loads the last opened project (if any) and starts debounced autosave. */
export async function bootPersistence() {
  if (started) return;
  started = true;
  try {
    const id = localStorage.getItem(LAST_KEY);
    const rec = id ? await loadProjectRecord(id) : null;
    if (rec) useStore.getState().loadProject(rec.project);
  } catch {
    /* IndexedDB unavailable: work in memory */
  }
  rememberLast(useStore.getState().project.id);
  useStore.subscribe((s, prev) => {
    if (s.project === prev.project) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void saveNow(), 800);
  });
  window.addEventListener('pagehide', () => {
    if (timer) void saveNow();
  });
  collectGarbage(liveAssetIds()).catch(() => {});
}

export async function openProject(p: Project) {
  await saveNow();
  useStore.getState().loadProject(p);
  rememberLast(p.id);
}

export async function newProject() {
  await saveNow();
  const p = createProject();
  useStore.getState().loadProject(p);
  rememberLast(p.id);
}

export async function removeProject(id: string) {
  const current = useStore.getState().project.id;
  if (id === current) await newProject();
  await deleteProjectRecord(id, liveAssetIds());
}
