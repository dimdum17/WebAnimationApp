import type { Engine } from './renderer';

/** The live preview engine, used for project thumbnails. */
let current: Engine | null = null;

export function setPreviewEngine(e: Engine | null) {
  current = e;
}

export function capturePreviewThumbnail(maxSide = 240): string | null {
  if (!current) return null;
  const src = current.canvas;
  const s = Math.min(1, maxSide / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * s));
  c.height = Math.max(1, Math.round(src.height * s));
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}
