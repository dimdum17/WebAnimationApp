import * as THREE from 'three';

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const sdf = /* glsl */ `
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
`;

const cardFragment = /* glsl */ `
uniform sampler2D uMap;
uniform vec4 uCorners;
uniform float uHasMap;
uniform float uImgAspect;
uniform vec2 uSize;
uniform float uRadius;
uniform float uOpacity;
uniform float uShade;
uniform vec3 uPlaceholder;
uniform vec4 uFrame;
uniform float uCoverAspect;
uniform vec3 uClip;
varying vec2 vUv;
${sdf}
float sdRoundBox4(vec2 p, vec2 b, vec4 r) {
  r.xy = (p.x > 0.0) ? r.xy : r.zw;
  r.x = (p.y > 0.0) ? r.x : r.y;
  vec2 q = abs(p) - b + r.x;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
}
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  float d = sdRoundBox4(p, uSize * 0.5, uRadius * uCorners);
  float aa = max(fwidth(d), 1e-5);
  float a = 1.0 - smoothstep(-aa, aa * 0.5, d);
  // Optional linear mask: hides the side where dot(p, uClip.xy) > uClip.z.
  float cd = dot(p, uClip.xy) - uClip.z;
  float caa = max(fwidth(cd), 1e-5);
  a *= 1.0 - smoothstep(-caa, caa, cd);

  vec2 fuv = uFrame.xy + vUv * uFrame.zw;
  vec2 uv = fuv;
  float ca = uCoverAspect;
  if (uImgAspect > ca) {
    uv.x = (uv.x - 0.5) * ca / uImgAspect + 0.5;
  } else {
    uv.y = (uv.y - 0.5) * uImgAspect / ca + 0.5;
  }
  uv.y = 1.0 - uv.y;

  vec3 col;
  if (uHasMap > 0.5) {
    col = texture2D(uMap, uv).rgb;
  } else {
    float g = 0.06 * (1.0 - fuv.y) + 0.03 * fuv.x;
    col = uPlaceholder + g;
  }
  float shade = gl_FrontFacing ? uShade : uShade * 0.55;
  gl_FragColor = vec4(col * shade, a * uOpacity);
  if (gl_FragColor.a < 0.003) discard;
}
`;

const shadowFragment = /* glsl */ `
uniform vec2 uSize;
uniform vec2 uCardSize;
uniform vec2 uOffset;
uniform float uRadius;
uniform float uBlur;
uniform float uSpread;
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
${sdf}
void main() {
  vec2 p = (vUv - 0.5) * uSize - uOffset;
  vec2 b = uCardSize * 0.5 + uSpread;
  float d = sdRoundBox(p, max(b, vec2(0.0001)), max(uRadius + uSpread, 0.0));
  float blur = max(uBlur, 0.002);
  float a = 1.0 - smoothstep(-blur, blur, d);
  gl_FragColor = vec4(uColor, a * uOpacity);
  if (gl_FragColor.a < 0.003) discard;
}
`;

const plane = new THREE.PlaneGeometry(1, 1);

export interface ShadowConfig {
  enabled: boolean;
  x: number;
  y: number;
  blur: number;
  spread: number;
  opacity: number;
  color: THREE.Color;
}

export class Card {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly shadow: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  readonly shadowMat: THREE.ShaderMaterial;
  /** Index into the project's slots. Templates may change it per frame. */
  slot = 0;
  w = 1;
  h = 1;
  opacity = 1;
  shade = 1;

  constructor(public readonly index: number) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: cardFragment,
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uMap: { value: null },
        uHasMap: { value: 0 },
        uImgAspect: { value: 1 },
        uSize: { value: new THREE.Vector2(1, 1) },
        uRadius: { value: 0.02 },
        uOpacity: { value: 1 },
        uShade: { value: 1 },
        uPlaceholder: { value: new THREE.Color(0.32, 0.32, 0.35) },
        uFrame: { value: new THREE.Vector4(0, 0, 1, 1) },
        uCoverAspect: { value: 1 },
        uCorners: { value: new THREE.Vector4(1, 1, 1, 1) },
        uClip: { value: new THREE.Vector3(0, 0, 1) },
      },
    });
    this.mesh = new THREE.Mesh(plane, this.mat);
    this.shadowMat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: shadowFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uSize: { value: new THREE.Vector2(1, 1) },
        uCardSize: { value: new THREE.Vector2(1, 1) },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uRadius: { value: 0.02 },
        uBlur: { value: 0.02 },
        uSpread: { value: 0 },
        uColor: { value: new THREE.Color(0, 0, 0) },
        uOpacity: { value: 0.4 },
      },
    });
    this.shadow = new THREE.Mesh(plane, this.shadowMat);
    this.shadow.visible = false;
    this.group.add(this.shadow);
    this.group.add(this.mesh);
  }

  reset() {
    const g = this.group;
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0, 'XYZ');
    g.quaternion.identity();
    g.scale.set(1, 1, 1);
    g.visible = true;
    g.renderOrder = 0;
    this.mesh.renderOrder = 0;
    this.shadow.renderOrder = 0;
    this.opacity = 1;
    this.shade = 1;
    this.slot = this.index;
    (this.mat.uniforms.uFrame.value as THREE.Vector4).set(0, 0, 1, 1);
    (this.mat.uniforms.uCorners.value as THREE.Vector4).set(1, 1, 1, 1);
    (this.mat.uniforms.uClip.value as THREE.Vector3).set(0, 0, 1);
    this.clipped = false;
    this.coverAspect = 0;
  }

  private clipped = false;

  /**
   * Masks the card with a straight edge in card-local world units (origin at the
   * card centre, y up): the side where `nx * x + ny * y > offset` is hidden.
   */
  setClip(nx: number, ny: number, offset: number) {
    (this.mat.uniforms.uClip.value as THREE.Vector3).set(nx, ny, offset);
    this.clipped = true;
  }

  /** Corner radius multipliers: top-right, bottom-right, top-left, bottom-left. */
  setCorners(tr: number, br: number, tl: number, bl: number) {
    (this.mat.uniforms.uCorners.value as THREE.Vector4).set(tr, br, tl, bl);
  }

  /** Aspect used for cover-fitting; 0 = the card's own aspect. */
  coverAspect = 0;

  setSize(w: number, h: number) {
    this.w = Math.max(1e-4, w);
    this.h = Math.max(1e-4, h);
  }

  setFrame(x: number, y: number, sx: number, sy: number, coverAspect: number) {
    (this.mat.uniforms.uFrame.value as THREE.Vector4).set(x, y, sx, sy);
    this.coverAspect = coverAspect;
  }

  setOrder(order: number) {
    this.group.renderOrder = order;
    this.mesh.renderOrder = order;
    this.shadow.renderOrder = order;
  }

  apply(
    tex: THREE.Texture | null,
    imgAspect: number,
    radius: number,
    shadow: ShadowConfig,
    unit: number,
  ) {
    const u = this.mat.uniforms;
    u.uMap.value = tex;
    u.uHasMap.value = tex ? 1 : 0;
    // Placeholder tone varies per slot so neighbouring cards are distinguishable.
    const tone = [1, 0.78, 0.58][((this.slot % 3) + 3) % 3];
    (u.uPlaceholder.value as THREE.Color).setRGB(0.36 * tone, 0.36 * tone, 0.39 * tone);
    u.uImgAspect.value = imgAspect;
    (u.uSize.value as THREE.Vector2).set(this.w, this.h);
    u.uRadius.value = Math.min(radius, Math.min(this.w, this.h) / 2);
    u.uOpacity.value = this.opacity;
    u.uShade.value = this.shade;
    u.uCoverAspect.value = this.coverAspect || this.w / this.h;
    this.mesh.scale.set(this.w, this.h, 1);

    // The shadow is not masked, so clipped cards skip it.
    const show = shadow.enabled && shadow.opacity > 0 && this.opacity > 0.01 && !this.clipped;
    this.shadow.visible = show;
    if (show) {
      const s = this.shadowMat.uniforms;
      const ox = (shadow.x / 100) * unit;
      const oy = -(shadow.y / 100) * unit;
      const blur = (shadow.blur / 100) * unit;
      const spread = (shadow.spread / 100) * unit;
      const padX = Math.abs(ox) + blur * 2 + Math.max(spread, 0) + 0.01;
      const padY = Math.abs(oy) + blur * 2 + Math.max(spread, 0) + 0.01;
      const sw = this.w + padX * 2;
      const sh = this.h + padY * 2;
      (s.uSize.value as THREE.Vector2).set(sw, sh);
      (s.uCardSize.value as THREE.Vector2).set(this.w, this.h);
      (s.uOffset.value as THREE.Vector2).set(ox, oy);
      s.uRadius.value = u.uRadius.value;
      s.uBlur.value = blur;
      s.uSpread.value = spread;
      (s.uColor.value as THREE.Color).copy(shadow.color);
      s.uOpacity.value = (shadow.opacity / 100) * this.opacity;
      this.shadow.scale.set(sw, sh, 1);
      this.shadow.position.z = -0.004 * unit;
    }
  }

  dispose() {
    this.mat.dispose();
    this.shadowMat.dispose();
  }
}
