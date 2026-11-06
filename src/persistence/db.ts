import { createStore, get, set, del, entries, keys } from 'idb-keyval';
import type { Project, ProjectRecord } from '@/types/project';
import { normalizeProject } from '@/state/defaults';

const projectStore = createStore('gk-projects', 'projects');
const assetStore = createStore('gk-assets', 'assets');

export class StorageFullError extends Error {}

function wrap<T>(p: Promise<T>): Promise<T> {
  return p.catch((e: unknown) => {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      throw new StorageFullError('Storage full');
    }
    throw e;
  });
}

export async function saveProjectRecord(rec: ProjectRecord) {
  await wrap(set(rec.project.id, rec, projectStore));
}

export async function loadProjectRecord(id: string): Promise<ProjectRecord | null> {
  const rec = await get<ProjectRecord>(id, projectStore);
  if (!rec) return null;
  return { ...rec, project: normalizeProject(rec.project) };
}

export async function listProjectRecords(): Promise<ProjectRecord[]> {
  const all = await entries<string, ProjectRecord>(projectStore);
  return all
    .map(([, r]) => ({ ...r, project: normalizeProject(r.project) }))
    .sort((a, b) => b.project.updatedAt - a.project.updatedAt);
}

/** Deletes a project; `keep` protects assets still referenced in memory (open project, undo history). */
export async function deleteProjectRecord(id: string, keep: string[] = []) {
  await del(id, projectStore);
  await collectGarbage(keep);
}

export async function putAsset(id: string, blob: Blob) {
  await wrap(set(id, blob, assetStore));
}

export async function getAsset(id: string): Promise<Blob | undefined> {
  return get<Blob>(id, assetStore);
}

export function projectAssetIds(p: Project): string[] {
  const ids: string[] = [];
  for (const s of p.slots) if (s.assetId) ids.push(s.assetId);
  if (p.background.type === 'image' && p.background.assetId) ids.push(p.background.assetId);
  if (p.logo) ids.push(p.logo.assetId);
  return ids;
}

/** Deletes assets not referenced by any stored project. */
export async function collectGarbage(extraKeep: string[] = []) {
  const recs = await entries<string, ProjectRecord>(projectStore);
  const used = new Set(extraKeep);
  for (const [, r] of recs) for (const id of projectAssetIds(r.project)) used.add(id);
  const all = await keys<string>(assetStore);
  await Promise.all(all.filter((k) => !used.has(k)).map((k) => del(k, assetStore)));
}
