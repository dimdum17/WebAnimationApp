import { BRAND_SAMPLE_COUNT, renderBrandSamples } from './brandSamples';
import { useStore } from './store';
import { importImage, ImportError } from '@/persistence/assets';
import { StorageFullError } from '@/persistence/db';
import { uid } from '@/lib/id';
import { MAX_SLOTS } from '@/types/project';

function reportError(e: unknown, name?: string) {
  const { toast } = useStore.getState();
  if (e instanceof StorageFullError) toast('Storage full — delete old projects to free space', 'error');
  else if (e instanceof ImportError) toast(`${name ? `${name}: ` : ''}${e.message}`, 'error');
  else toast(`${name ? `${name}: ` : ''}Could not import image`, 'error');
}

async function importMany(files: Blob[], names: string[] = []) {
  const ids: string[] = [];
  for (let i = 0; i < files.length; i++) {
    try {
      ids.push(await importImage(files[i]));
    } catch (e) {
      reportError(e, names[i]);
    }
  }
  return ids;
}

/**
 * Places images into empty slots starting at `startIndex` (or the first empty slot),
 * adding slots as needed up to MAX_SLOTS.
 */
export async function addFilesToSlots(files: File[], startIndex?: number) {
  const ids = await importMany(files, files.map((f) => f.name));
  placeAssets(ids, startIndex);
}

export function placeAssets(ids: string[], startIndex?: number) {
  if (!ids.length) return;
  let dropped = 0;
  useStore.getState().edit((d) => {
    const queue = [...ids];
    if (startIndex !== undefined && d.slots[startIndex]) {
      d.slots[startIndex].assetId = queue.shift()!;
    }
    for (const s of d.slots) {
      if (!queue.length) break;
      if (!s.assetId) s.assetId = queue.shift()!;
    }
    while (queue.length && d.slots.length < MAX_SLOTS) {
      d.slots.push({ id: uid('s_'), assetId: queue.shift()! });
    }
    dropped = queue.length;
  });
  if (dropped) useStore.getState().toast(`${dropped} image(s) skipped — maximum ${MAX_SLOTS} slots`, 'info');
}

export async function loadSampleImages() {
  const st = useStore.getState();
  const count = Math.min(BRAND_SAMPLE_COUNT, Math.max(st.project.slots.length, 6));
  const blobs = await renderBrandSamples(count);
  if (!blobs.length) {
    st.toast('Could not create sample images', 'error');
    return;
  }
  const ids = await importMany(blobs);
  useStore.getState().edit((d) => {
    d.slots = d.slots.map((s, i) => ({ ...s, assetId: ids[i % ids.length] ?? s.assetId }));
  });
}
