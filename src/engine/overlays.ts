import type { Project, TextLayer } from '@/types/project';
import { resolveNumber } from './keyframes';
import { easeOutCubic } from './easing';
import { getLoadedAsset } from '@/persistence/assets';
import { clamp } from '@/lib/math';

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function drawBackground(ctx: CanvasRenderingContext2D, p: Project, w: number, h: number) {
  const bg = p.background;
  ctx.save();
  if (bg.type === 'colour') {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, w, h);
  } else if (bg.type === 'gradient') {
    const a = (bg.angle * Math.PI) / 180;
    const vx = Math.sin(a);
    const vy = -Math.cos(a);
    const half = (Math.abs(w * vx) + Math.abs(h * vy)) / 2;
    const cx = w / 2;
    const cy = h / 2;
    const g = ctx.createLinearGradient(cx - vx * half, cy - vy * half, cx + vx * half, cy + vy * half);
    g.addColorStop(0, bg.from);
    g.addColorStop(1, bg.to);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = '#101014';
    ctx.fillRect(0, 0, w, h);
    const asset = getLoadedAsset(bg.assetId);
    if (asset) {
      const s = Math.max(w / asset.width, h / asset.height);
      const dw = asset.width * s;
      const dh = asset.height * s;
      ctx.drawImage(asset.bitmap, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }
    if (bg.dim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${clamp(bg.dim / 100, 0, 1)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
  ctx.restore();
}

const ANIM_IN = 0.6;

export function resolveText(p: Project, layer: TextLayer, t01: number) {
  const r = (k: 'x' | 'y' | 'size' | 'opacity') =>
    resolveNumber(p, `text.${layer.id}.${k}`, layer[k], t01);
  return { x: r('x'), y: r('y'), size: r('size'), opacity: r('opacity') };
}

export function drawTexts(
  ctx: CanvasRenderingContext2D,
  p: Project,
  time: number,
  w: number,
  h: number,
  bounds?: Map<string, Bounds>,
) {
  const t01 = time / p.duration;
  const intro = clamp(time / ANIM_IN, 0, 1);
  const e = easeOutCubic(intro);
  for (const layer of p.texts) {
    if (!layer.visible || !layer.content.trim()) continue;
    const v = resolveText(p, layer, t01);
    const size = (v.size / 100) * h;
    let alpha = clamp(v.opacity / 100, 0, 1);
    let dy = 0;
    let scale = 1;
    if (layer.animIn !== 'none') alpha *= e;
    if (layer.animIn === 'slide-up') dy = (1 - e) * h * 0.04;
    if (layer.animIn === 'scale') scale = 0.85 + 0.15 * e;

    const lines = layer.content.split('\n');
    const lh = size * 1.1;
    ctx.save();
    ctx.font = `${layer.weight} ${size}px "${layer.font}"`;
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
      `${(layer.letterSpacing / 100) * size}px`;
    ctx.textAlign = layer.align;
    ctx.textBaseline = 'middle';
    const cx = (v.x / 100) * w;
    const cy = (v.y / 100) * h + dy;
    const widths = lines.map((l) => ctx.measureText(l).width);
    const bw = Math.max(...widths, size * 0.5);
    const bh = lh * lines.length;
    const left = layer.align === 'left' ? cx : layer.align === 'right' ? cx - bw : cx - bw / 2;
    bounds?.set(layer.id, { x: left, y: cy - bh / 2, w: bw, h: bh });
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.fillStyle = layer.color;
    lines.forEach((line, i) => {
      ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * lh);
    });
    ctx.restore();
  }
}

export function drawLogo(ctx: CanvasRenderingContext2D, p: Project, time: number, w: number, h: number) {
  const logo = p.logo;
  if (!logo || !logo.visible) return;
  const asset = getLoadedAsset(logo.assetId);
  if (!asset) return;
  const t01 = time / p.duration;
  const size = resolveNumber(p, 'logo.size', logo.size, t01);
  const opacity = resolveNumber(p, 'logo.opacity', logo.opacity, t01);
  const lw = (size / 100) * w;
  const lh = lw * (asset.height / asset.width);
  const ox = (logo.offsetX / 100) * w;
  const oy = (logo.offsetY / 100) * w;
  let x = 0;
  let y = 0;
  switch (logo.anchor) {
    case 'tl':
      x = ox;
      y = oy;
      break;
    case 'tr':
      x = w - lw - ox;
      y = oy;
      break;
    case 'bl':
      x = ox;
      y = h - lh - oy;
      break;
    case 'br':
      x = w - lw - ox;
      y = h - lh - oy;
      break;
    default:
      x = (w - lw) / 2 + ox;
      y = (h - lh) / 2 + oy;
  }
  ctx.save();
  ctx.globalAlpha = clamp(opacity / 100, 0, 1);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(asset.bitmap, x, y, lw, lh);
  ctx.restore();
}
