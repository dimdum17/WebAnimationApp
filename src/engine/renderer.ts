import * as THREE from 'three';
import { Card, type ShadowConfig } from './card';
import { resolveParams } from './keyframes';
import { ease } from './easing';
import { drawBackground, drawLogo, drawTexts, type Bounds } from './overlays';
import { getTemplate } from '@/templates/registry';
import type { TemplateInstance, UpdateCtx, Params, FrameInfo } from '@/templates/types';
import { aspectRatio, type Project } from '@/types/project';
import { getLoadedAsset, type LoadedAsset } from '@/persistence/assets';
import { clamp, fract, mod } from '@/lib/math';

export interface RenderOptions {
  /** Render placeholders instead of images (template thumbnails). */
  placeholders?: boolean;
  overlays?: boolean;
}

function ratioValue(r: string): number | null {
  if (r === 'auto') return null;
  const [a, b] = r.split(':').map(Number);
  return a / b;
}

export class Engine {
  readonly canvas: HTMLCanvasElement;
  readonly glCanvas: HTMLCanvasElement;
  readonly textBounds = new Map<string, Bounds>();
  private ctx2d: CanvasRenderingContext2D;
  private gl: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private persp = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
  private ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  private padGroup = new THREE.Group();
  private root = new THREE.Group();
  private instance: TemplateInstance | null = null;
  private buildKey = '';
  private cards: Card[] = [];
  private textures = new Map<string, THREE.Texture>();
  private shadow: ShadowConfig = {
    enabled: false,
    x: 0,
    y: 0,
    blur: 0,
    spread: 0,
    opacity: 0,
    color: new THREE.Color(),
  };
  contextLost = false;
  width = 1;
  height = 1;

  constructor(width: number, height: number, canvas?: HTMLCanvasElement) {
    this.canvas = canvas ?? document.createElement('canvas');
    this.glCanvas = document.createElement('canvas');
    this.ctx2d = this.canvas.getContext('2d', { alpha: false })!;
    this.gl = new THREE.WebGLRenderer({
      canvas: this.glCanvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.gl.setClearColor(0x000000, 0);
    this.gl.setPixelRatio(1);
    this.glCanvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
    });
    this.glCanvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
    });
    this.scene.add(this.padGroup);
    this.padGroup.add(this.root);
    this.setSize(width, height);
  }

  setSize(w: number, h: number) {
    w = Math.max(2, Math.round(w));
    h = Math.max(2, Math.round(h));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.setSize(w, h, false);
  }

  private texture(asset: LoadedAsset, id: string): THREE.Texture {
    let tex = this.textures.get(id);
    if (!tex) {
      tex = new THREE.Texture(asset.bitmap);
      tex.flipY = false;
      tex.colorSpace = THREE.NoColorSpace;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = this.gl.capabilities.getMaxAnisotropy();
      tex.needsUpdate = true;
      this.textures.set(id, tex);
    }
    return tex;
  }

  /** Drop textures for assets that are no longer used. */
  private pruneTextures(used: Set<string>) {
    if (this.textures.size <= used.size + 8) return;
    for (const [id, tex] of this.textures) {
      if (!used.has(id)) {
        tex.dispose();
        this.textures.delete(id);
      }
    }
  }

  private clearScene() {
    this.instance?.dispose?.();
    this.instance = null;
    for (const c of this.cards) c.dispose();
    this.cards = [];
    this.root.clear();
  }

  private resetRoot() {
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.root.scale.set(1, 1, 1);
    for (const child of this.root.children) {
      if (!this.cards.some((c) => c.group === child)) {
        child.position.set(0, 0, 0);
        child.rotation.set(0, 0, 0);
        child.scale.set(1, 1, 1);
      }
    }
  }

  render(project: Project, time: number, opts: RenderOptions = {}) {
    const { width: w, height: h } = this;
    const def = getTemplate(project.templateId);
    const duration = project.duration;
    const tt = mod(time, duration);
    const t01 = tt / duration;
    const params: Params = resolveParams(project, def, t01);
    const A = aspectRatio(project.aspect);
    const frame: FrameInfo = { A, U: 2 * Math.min(A, 1) };
    const slotCount = Math.max(1, project.slots.length);
    const num = (k: string) => Number(params[k] ?? 0);
    const str = (k: string) => String(params[k] ?? '');

    // (Re)build when structure changes.
    const key = `${def.id}|${A.toFixed(4)}|${slotCount}|${def.structure?.(params, slotCount, frame) ?? ''}`;
    if (key !== this.buildKey) {
      this.clearScene();
      this.buildKey = key;
      this.instance = def.build({
        ...frame,
        root: this.root,
        slotCount,
        params,
        createCards: (n, parent) => {
          const out: Card[] = [];
          for (let i = 0; i < n; i++) {
            const c = new Card(this.cards.length);
            (parent ?? this.root).add(c.group);
            this.cards.push(c);
            out.push(c);
          }
          return out;
        },
      });
    }

    const slotAsset = (slot: number): LoadedAsset | null => {
      if (opts.placeholders) return null;
      const s = project.slots[mod(Math.round(slot), slotCount)];
      return getLoadedAsset(s?.assetId);
    };

    // Camera reset.
    const cam = def.camera === 'orthographic' ? this.ortho : this.persp;
    if (cam === this.persp) {
      const fov = def.fov ?? 35;
      cam.fov = fov;
      cam.aspect = A;
      cam.near = 0.01;
      cam.far = 200;
      cam.position.set(0, 0, 1 / Math.tan(((fov / 2) * Math.PI) / 180));
    } else {
      this.ortho.left = -A;
      this.ortho.right = A;
      this.ortho.top = 1;
      this.ortho.bottom = -1;
      this.ortho.zoom = 1;
      cam.position.set(0, 0, 50);
    }
    cam.rotation.set(0, 0, 0);
    cam.updateProjectionMatrix();

    const padScale = 1 - (2 * clamp(num('padding'), 0, 45)) / 100;
    this.padGroup.scale.setScalar(padScale);
    this.resetRoot();
    for (const c of this.cards) c.reset();

    const easing = str('easing');
    const stepped = str('motion') === 'stepped';
    const cardSize = num('cardSize');
    const ratio = ratioValue(str('cardRatio'));

    const ctx: UpdateCtx = {
      ...frame,
      p: t01,
      t: tt,
      duration,
      params,
      slotCount,
      root: this.root,
      camera: cam,
      num,
      str,
      advance(x) {
        const base = Math.floor(x);
        const f = fract(x);
        if (stepped) {
          const hold = 0.4;
          return base + (f < hold ? 0 : ease(easing === 'linear' ? 'smooth' : easing, (f - hold) / (1 - hold)));
        }
        return base + ease(easing, f);
      },
      dims(slot, scale = 1) {
        let r = ratio;
        if (r === null) {
          const a = slotAsset(slot);
          r = a ? clamp(a.width / a.height, 0.5, 2) : 1;
        }
        const s = frame.U * (cardSize / 100) * scale;
        const sq = Math.sqrt(r);
        return [s * sq, s / sq];
      },
    };

    this.instance?.update(ctx);
    this.root.visible = project.mediaVisible;

    // Apply materials.
    const radius = (num('cornerRadius') / 100) * frame.U;
    const sh = this.shadow;
    sh.enabled = Boolean(params.shadowEnabled);
    sh.x = num('shadowX');
    sh.y = num('shadowY');
    sh.blur = num('shadowBlur');
    sh.spread = num('shadowSpread');
    sh.opacity = num('shadowOpacity');
    sh.color.set(str('shadowColor') || '#000000');
    const used = new Set<string>();
    for (const c of this.cards) {
      const slotIdx = mod(Math.round(c.slot), slotCount);
      const s = project.slots[slotIdx];
      const asset = slotAsset(slotIdx);
      let tex: THREE.Texture | null = null;
      if (asset && s?.assetId) {
        tex = this.texture(asset, s.assetId);
        used.add(s.assetId);
      }
      c.group.visible = c.group.visible && c.opacity > 0.002;
      c.apply(tex, asset ? asset.width / asset.height : 1, radius, sh, frame.U);
    }
    this.pruneTextures(used);

    // Composite.
    const g = this.ctx2d;
    drawBackground(g, project, w, h);
    if (!this.contextLost) {
      this.gl.render(this.scene, cam);
      g.drawImage(this.glCanvas, 0, 0, w, h);
    }
    if (opts.overlays !== false) {
      this.textBounds.clear();
      drawTexts(g, project, tt, w, h, this.textBounds);
      drawLogo(g, project, tt, w, h);
    }
  }

  dispose() {
    this.clearScene();
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
    this.gl.dispose();
    this.gl.forceContextLoss();
  }
}
