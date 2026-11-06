import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  getFirstEncodableVideoCodec,
  type VideoCodec,
} from 'mediabunny';
import { Engine } from '@/engine/renderer';
import { ensureAssets } from '@/persistence/assets';
import { projectAssetIds } from '@/persistence/db';
import { aspectRatio, type Aspect, type Project } from '@/types/project';

export type ExportFormat = 'mp4' | 'webm';

export const RESOLUTIONS = [
  { id: '720', label: '720p', short: 720 },
  { id: '1080', label: '1080p', short: 1080 },
  { id: '1440', label: '2K', short: 1440 },
] as const;
export type ResolutionId = (typeof RESOLUTIONS)[number]['id'];

export const FPS_OPTIONS = [24, 30, 60] as const;

const CODECS: Record<ExportFormat, VideoCodec[]> = {
  mp4: ['avc', 'hevc', 'av1'],
  webm: ['vp9', 'av1', 'vp8'],
};

/** Output size with the given short side; dimensions are even for encoder compatibility. */
export function exportSize(aspect: Aspect, short: number) {
  const a = aspectRatio(aspect);
  const even = (n: number) => Math.round(n / 2) * 2;
  return a >= 1 ? { width: even(short * a), height: short } : { width: short, height: even(short / a) };
}

export function webCodecsAvailable() {
  return typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window;
}

export async function findCodec(format: ExportFormat, width: number, height: number, fps: number) {
  if (!webCodecsAvailable()) return null;
  return getFirstEncodableVideoCodec(CODECS[format], { width, height, frameRate: fps, quality: QUALITY_HIGH });
}

export class ExportCanceled extends Error {
  constructor() {
    super('Export canceled');
  }
}

export interface ExportOptions {
  format: ExportFormat;
  short: number;
  fps: number;
  signal: AbortSignal;
  onProgress(fraction: number): void;
}

/**
 * Renders the project frame by frame at deterministic times (i / fps) into an offscreen
 * engine and encodes with WebCodecs via Mediabunny. Frame N/fps equals frame 0, so the
 * loop is seamless.
 */
export async function exportVideo(project: Project, opts: ExportOptions): Promise<Blob> {
  const { width, height } = exportSize(project.aspect, opts.short);
  const codec = await findCodec(opts.format, width, height, opts.fps);
  if (!codec) throw new Error(`This browser cannot encode ${opts.format.toUpperCase()} at ${width}×${height}.`);

  await ensureAssets(projectAssetIds(project));
  await document.fonts?.ready;

  const engine = new Engine(width, height);
  const target = new BufferTarget();
  const output = new Output({
    format: opts.format === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
    target,
  });
  const source = new CanvasSource(engine.canvas, { codec, quality: QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: opts.fps });

  try {
    await output.start();
    const frames = Math.max(1, Math.round(project.duration * opts.fps));
    const dt = 1 / opts.fps;
    for (let i = 0; i < frames; i++) {
      if (opts.signal.aborted) throw new ExportCanceled();
      engine.render(project, i * dt);
      if (engine.contextLost) throw new Error('The graphics context was lost during export.');
      await source.add(i * dt, dt);
      opts.onProgress((i + 1) / frames);
      // Let the progress UI paint periodically.
      if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
    }
    if (opts.signal.aborted) throw new ExportCanceled();
    await output.finalize();
    const mime = opts.format === 'mp4' ? 'video/mp4' : 'video/webm';
    return new Blob([target.buffer!], { type: mime });
  } catch (e) {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => {});
    throw e;
  } finally {
    engine.dispose();
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function fileSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'gerakinaja'
  );
}
