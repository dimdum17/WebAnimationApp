import { uid } from '@/lib/id';
import { getAsset, putAsset } from './db';

export interface LoadedAsset {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  url: string;
}

const cache = new Map<string, LoadedAsset>();
const pending = new Map<string, Promise<LoadedAsset | null>>();
const failed = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

export function assetVersion() {
  return version;
}

export function subscribeAssets(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  version++;
  listeners.forEach((l) => l());
}

export function isAssetFailed(id: string) {
  return failed.has(id);
}

async function decode(id: string, blob: Blob): Promise<LoadedAsset> {
  const bitmap = await createImageBitmap(blob);
  return { bitmap, width: bitmap.width, height: bitmap.height, url: URL.createObjectURL(blob) };
}

export function getLoadedAsset(id: string | null | undefined): LoadedAsset | null {
  if (!id) return null;
  const hit = cache.get(id);
  if (hit) return hit;
  void ensureAsset(id);
  return null;
}

export function ensureAsset(id: string): Promise<LoadedAsset | null> {
  const hit = cache.get(id);
  if (hit) return Promise.resolve(hit);
  if (failed.has(id)) return Promise.resolve(null);
  let p = pending.get(id);
  if (!p) {
    p = (async () => {
      try {
        const blob = await getAsset(id);
        if (!blob) throw new Error('missing');
        const a = await decode(id, blob);
        cache.set(id, a);
        return a;
      } catch {
        failed.add(id);
        return null;
      } finally {
        pending.delete(id);
        notify();
      }
    })();
    pending.set(id, p);
  }
  return p;
}

export async function ensureAssets(ids: string[]) {
  return Promise.all(ids.map((id) => ensureAsset(id)));
}

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

export class ImportError extends Error {}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, q?: number) {
  return new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));
}

/**
 * Imports an image file: validates, downscales to `maxSide`, re-encodes, stores in IndexedDB.
 * Returns the new asset id.
 */
export async function importImage(
  file: Blob,
  opts: { maxSide?: number; maxBytes?: number; keepAlpha?: boolean } = {},
): Promise<string> {
  const { maxSide = 2560, maxBytes = 20 * 1024 * 1024, keepAlpha = false } = opts;
  if (file.type && !ACCEPTED_IMAGE_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
    throw new ImportError('Unsupported file type');
  }
  if (file.size > maxBytes) {
    throw new ImportError(`File is larger than ${Math.round(maxBytes / 1024 / 1024)} MB`);
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImportError('Could not read image');
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  let blob: Blob | null;
  if (keepAlpha) {
    blob = await canvasToBlob(canvas, 'image/png');
  } else {
    blob = await canvasToBlob(canvas, 'image/webp', 0.9);
    if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  }
  if (!blob) throw new ImportError('Could not encode image');
  const id = uid('a_');
  await putAsset(id, blob);
  const loaded = await decode(id, blob);
  cache.set(id, loaded);
  notify();
  return id;
}
