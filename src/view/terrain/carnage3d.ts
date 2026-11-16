// 3D pieces of Carnage at Devil's Run on the road tiles, from the grid alone (no licensed art):
// realistic animated fire (flames, embers, smoke, flickering glow) on fire spaces (and anywhere else something burns: a revealed fire hazard,
// a car ON FIRE!), and a placeholder launch ramp on ramp spaces until its model exists
// (assets/models/Ramp.glb, made from the prompts in design/art/carnage-ramp-prompts.md).
//
// The flames share one material: one call to tickFlames per frame animates every flame on the table.

import * as THREE from 'three';
import { GRID, spaceCenterPx, type TileData } from '../tile-grid';

/** Look of the fire: rising speed of the flames, flame height over width, embers and smoke per fire. */
export const FIRE_LOOK = { speed: 1.25, aspect: 1.7, embers: 14, smoke: 6 };

const NOISE_GLSL = /* glsl */ `
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
  }`;

/** Realistic flames: turbulent noise rising through a tapering body, coloured by heat, added to the light. */
const flameMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    attribute float aSeed;
    varying vec2 vUv;
    varying float vSeed;
    void main() { vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    varying float vSeed;
    ${NOISE_GLSL}
    void main() {
      float t = uTime * ${FIRE_LOOK.speed.toFixed(2)} + vSeed * 17.0;
      vec2 uv = vUv;
      // Domain-warped noise scrolling upward: the tongues of a real fire.
      vec2 q = vec2(uv.x * 2.2 + vSeed * 3.0, uv.y * 1.6 - t);
      float warp = fbm(q * 1.3 + vec2(0.0, t * 0.35));
      float n = fbm(q * 2.1 + warp * 1.6);
      float x = (uv.x - 0.5) * 2.0;
      float taper = mix(0.95, 0.12, pow(uv.y, 0.8));
      float body = 1.0 - smoothstep(taper * 0.45, taper, abs(x) + (n - 0.5) * 0.7 * (0.3 + uv.y));
      float heat = body * (1.15 - uv.y * 1.05) + (n - 0.45) * 0.9 * body;
      heat *= smoothstep(0.0, 0.08, uv.y); // soft at the base
      heat = clamp(heat * 1.5, 0.0, 1.0);
      vec3 col = mix(vec3(0.35, 0.03, 0.0), vec3(1.0, 0.28, 0.02), smoothstep(0.08, 0.42, heat));
      col = mix(col, vec3(1.0, 0.68, 0.18), smoothstep(0.42, 0.72, heat));
      col = mix(col, vec3(1.0, 0.96, 0.82), smoothstep(0.78, 1.0, heat));
      float a = smoothstep(0.04, 0.3, heat);
      gl_FragColor = vec4(col * a * 1.25, a);
    }`,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  toneMapped: false,
});

/** Embers: sparks rising from the fire, swaying, cooling from yellow to red, fading. */
const emberMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uScale: { value: 300 } },
  vertexShader: /* glsl */ `
    uniform float uTime, uScale;
    attribute vec4 aEmber; // x, z start; phase; speed
    varying float vLife;
    void main() {
      float life = fract(uTime * aEmber.w * 0.35 + aEmber.z);
      vLife = life;
      vec3 p = position;
      p.x = aEmber.x + sin(life * 9.0 + aEmber.z * 20.0) * 0.06 * life;
      p.z = aEmber.y + cos(life * 7.0 + aEmber.z * 13.0) * 0.06 * life;
      p.y = life * 1.0;
      vec4 mv = modelViewMatrix * vec4(p * vec3(1.0, position.y, 1.0), 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uScale * 0.07 * (1.0 - life * 0.6) / -mv.z; // about 0.07 world units across
    }`,
  fragmentShader: /* glsl */ `
    varying float vLife;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      vec3 c = mix(vec3(1.0, 0.85, 0.35), vec3(1.0, 0.25, 0.05), vLife);
      float a = (1.0 - smoothstep(0.1, 0.5, d)) * (1.0 - vLife);
      gl_FragColor = vec4(c * a, a);
    }`,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
});

/** Smoke: soft dark puffs rising above the flames, growing and thinning. */
const smokeMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uScale: { value: 300 } },
  vertexShader: /* glsl */ `
    uniform float uTime, uScale;
    attribute vec4 aPuff; // x, z start; phase; speed
    varying float vLife;
    varying float vSeed;
    void main() {
      float life = fract(uTime * aPuff.w * 0.12 + aPuff.z);
      vLife = life;
      vSeed = aPuff.z;
      vec3 p = vec3(aPuff.x + life * 0.25 * sin(aPuff.z * 30.0), (0.45 + life * 0.9) * position.y, aPuff.y + life * 0.15);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uScale * (0.35 + life * 0.8) / -mv.z; // a puff grows from 0.35 to 1.15 world units
    }`,
  fragmentShader: /* glsl */ `
    varying float vLife;
    varying float vSeed;
    ${NOISE_GLSL}
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c) + (vn(gl_PointCoord * 5.0 + vSeed * 40.0) - 0.5) * 0.18;
      if (d > 0.5) discard;
      float a = (1.0 - smoothstep(0.15, 0.5, d)) * smoothstep(0.0, 0.15, vLife) * (1.0 - vLife) * 0.45;
      gl_FragColor = vec4(vec3(0.09, 0.08, 0.08), a);
    }`,
  transparent: true,
  depthWrite: false,
  toneMapped: false,
});

/** Every flame made, so each frame can turn them toward the camera. */
const flames = new Set<THREE.Mesh>();
const qParent = new THREE.Quaternion();
let glowFlicker = 1;

/**
 * Animates the fire (flames, embers, smoke, the flickering glow) and turns each flame to face
 * `camera`. Call once per frame with the time in seconds and the drawing buffer's height in pixels.
 */
export function tickFlames(seconds: number, camera?: THREE.Camera, viewHeight = innerHeight): void {
  flameMaterial.uniforms.uTime.value = seconds;
  emberMaterial.uniforms.uTime.value = seconds;
  smokeMaterial.uniforms.uTime.value = seconds;
  // Point sizes are in pixels: world size times this, over the distance.
  const fov = (camera as THREE.PerspectiveCamera | undefined)?.fov ?? 30;
  const scale = viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  emberMaterial.uniforms.uScale.value = scale;
  smokeMaterial.uniforms.uScale.value = scale;
  glowFlicker = 0.75 + 0.15 * Math.sin(seconds * 13) + 0.1 * Math.sin(seconds * 23.7);
  if (glow) glow.opacity = glowFlicker;
  if (!camera) return;
  for (const f of flames) {
    if (!f.parent) { flames.delete(f); continue; }
    f.parent.getWorldQuaternion(qParent);
    f.quaternion.copy(qParent.invert().multiply(camera.quaternion));
  }
}

/**
 * One flame `size` world units wide, its base on the origin, facing the camera once tickFlames
 * runs. `seed` gives each flame its own turbulence.
 */
export function makeFlame(size: number, seed = Math.random()): THREE.Mesh {
  const g = new THREE.PlaneGeometry(size, size * FIRE_LOOK.aspect).translate(0, size * FIRE_LOOK.aspect / 2 - size * 0.08, 0);
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Array(g.getAttribute('position').count).fill(seed), 1));
  const m = new THREE.Mesh(g, flameMaterial);
  m.renderOrder = 6;
  flames.add(m);
  return m;
}

/** The glow a fire casts on the ground: an orange disc that flickers; made on first use (it needs a canvas). */
let glow: THREE.MeshBasicMaterial | null = null;
const glowMaterial = (): THREE.MeshBasicMaterial => (glow ??= (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,150,50,1)'); gr.addColorStop(0.45, 'rgba(255,80,15,.5)'); gr.addColorStop(1, 'rgba(255,50,10,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
})());

/** Points rising from a disc `radius` wide, `height` high: embers or smoke (one attribute of start x, z, phase, speed). */
function risers(n: number, radius: number, height: number, attr: string, material: THREE.ShaderMaterial, r: () => number): THREE.Points {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius;
    pos[i * 3 + 1] = height; // the shaders scale the rise by position.y
    data.set([Math.cos(a) * d, Math.sin(a) * d, r(), 0.6 + r() * 0.8], i * 4);
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute(attr, new THREE.BufferAttribute(data, 4));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height, 0), radius + height * 2);
  const p = new THREE.Points(g, material);
  p.renderOrder = attr === 'aPuff' ? 7 : 8;
  return p;
}

/** Small seeded generator (mulberry32), 0..1. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Options of the tile pieces: the world size of the tile frame along the road and across it. */
export interface CarnagePieceOptions { width: number; depth: number }

/** Centres (tile frame, world units, centred like the tile) of the spaces of terrain `code`. */
function cellsOf(tile: TileData, code: string, o: CarnagePieceOptions): { x: number; z: number; r: number; c: number }[] {
  const kx = o.width / GRID.frameW, kz = o.depth / GRID.frameH;
  const out: { x: number; z: number; r: number; c: number }[] = [];
  tile.terrain.forEach((row, r) => [...row].forEach((k, c) => {
    if (k !== code) return;
    const [px, py] = spaceCenterPx(r, c);
    out.push({ x: (px + GRID.tip / 2 - GRID.frameW / 2) * kx, z: (py - GRID.frameH / 2) * kz, r, c });
  }));
  return out;
}

/**
 * A cluster of flames over a space, `space` world units wide: three to five flames of different
 * sizes, as the tile art draws a fire space.
 */
export function flameCluster(space: number, seed: number): THREE.Group {
  const r = rng(seed);
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(space * 0.8, 24), glowMaterial());
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.01;
  g.add(disc);
  // Several overlapping flames give the fire depth; the middle one the tallest.
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const s = space * (0.42 + r() * 0.3) * (i === 0 ? 1.4 : 1);
    const f = makeFlame(s, r());
    f.position.set((r() - 0.5) * space * 0.5, 0, (r() - 0.5) * space * 0.4);
    g.add(f);
  }
  g.add(risers(FIRE_LOOK.embers, space * 0.3, space * 1.6, 'aEmber', emberMaterial, r));
  g.add(risers(FIRE_LOOK.smoke, space * 0.25, space * 1.2, 'aPuff', smokeMaterial, r));
  return g;
}

/** The flames standing on a face's fire spaces, or null when it has none. */
export function buildFireSpaces(tile: TileData, o: CarnagePieceOptions): THREE.Group | null {
  const cells = cellsOf(tile, 'F', o);
  if (!cells.length) return null;
  const space = GRID.pitch * o.width / GRID.frameW;
  const g = new THREE.Group();
  for (const c of cells) {
    const cl = flameCluster(space, (c.r * 31 + c.c * 7 + (tile.tile ?? 0) * 101) >>> 0);
    cl.position.set(c.x, 0, c.z);
    g.add(cl);
  }
  return g;
}

/**
 * A launch ramp, `space` world units long, rising toward +x (the lead tile, the way it is jumped),
 * on y = 0: a pale deck with a yellow arrow, dark sides and a yellow-and-black striped post at the
 * high end, as on the tiles. A placeholder until the ramp model exists.
 */
export function makeRamp(space: number): THREE.Group {
  const L = space * 0.78, W = space * 0.62, H = space * 0.34;
  const g = new THREE.Group();
  // The wedge: a triangular prism, low end at -x.
  const shape = new THREE.Shape([new THREE.Vector2(-L / 2, 0), new THREE.Vector2(L / 2, 0), new THREE.Vector2(L / 2, H)]);
  const wedge = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: false }).translate(0, 0, -W / 2);
  g.add(new THREE.Mesh(wedge, new THREE.MeshStandardMaterial({ color: '#3a3330', roughness: 0.8, flatShading: true })));
  // The deck, a little above the slope, with its arrow.
  const c = document.createElement('canvas');
  c.width = 256; c.height = 192;
  const x = c.getContext('2d')!;
  x.fillStyle = '#efe6d2'; x.fillRect(0, 0, 256, 192);
  x.strokeStyle = 'rgba(120,100,80,.35)'; x.lineWidth = 3;
  for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(0, i * 32); x.lineTo(256, i * 32); x.stroke(); }
  x.fillStyle = '#f2c230'; x.strokeStyle = '#7a5a10'; x.lineWidth = 6;
  x.beginPath(); x.moveTo(60, 76); x.lineTo(140, 76); x.lineTo(140, 46); x.lineTo(206, 96); x.lineTo(140, 146); x.lineTo(140, 116); x.lineTo(60, 116); x.closePath(); x.fill(); x.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const slope = Math.hypot(L, H);
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(slope, W * 0.96), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  deck.rotation.set(-Math.PI / 2, 0, Math.atan2(H, L));
  deck.position.set(0, H / 2 + 0.004, 0);
  g.add(deck);
  // The striped post across the high end.
  const s = document.createElement('canvas');
  s.width = 64; s.height = 256;
  const y = s.getContext('2d')!;
  for (let i = 0; i < 8; i++) { y.fillStyle = i % 2 ? '#16130f' : '#f2c230'; y.fillRect(0, i * 32, 64, 32); }
  const st = new THREE.CanvasTexture(s);
  st.colorSpace = THREE.SRGBColorSpace;
  const post = new THREE.Mesh(new THREE.BoxGeometry(space * 0.06, H * 1.25, W), new THREE.MeshStandardMaterial({ map: st, roughness: 0.6 }));
  post.position.set(L / 2 + space * 0.03, H * 1.25 / 2, 0);
  g.add(post);
  g.traverse(m => { if ((m as THREE.Mesh).isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

// ---------------------------------------------------------------- the ramp model

/**
 * The ramp model (assets/models/Ramp.glb, made with Meshy from design/art/carnage-ramp-prompts.md).
 * Meshy turned both views of the concept into objects, so the file holds two ramps side by side:
 * the one at x < 0 (deck with the big yellow arrow, sandbags) is kept. It rises toward -z; it is
 * turned to rise toward +x, the lead tile.
 */
const RAMP_MODEL = { keepBelowX: 0, yaw: -Math.PI / 2, length: 0.86 };
let rampModel: THREE.Object3D | null = null;
/** Every ramp on the table, so the model replaces the placeholder in all of them once loaded. */
const rampSlots = new Set<THREE.Group>();

/** The kept ramp of the model file, centred, rising toward +x, 1 unit long, its base on y = 0. */
function cutRamp(scene: THREE.Object3D): THREE.Object3D | null {
  let mesh: THREE.Mesh | null = null;
  scene.traverse(o => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
  if (!mesh) return null;
  const m = mesh as THREE.Mesh;
  const src = m.geometry.index ? m.geometry : m.geometry.toNonIndexed();
  const pos = src.getAttribute('position'), idx = src.index;
  const keep: number[] = [];
  const tri = (k: number): number => (idx ? idx.getX(k) : k);
  for (let t = 0; t < (idx ? idx.count : pos.count); t += 3) {
    const cx = (pos.getX(tri(t)) + pos.getX(tri(t + 1)) + pos.getX(tri(t + 2))) / 3;
    if (cx < RAMP_MODEL.keepBelowX) keep.push(tri(t), tri(t + 1), tri(t + 2));
  }
  const g = src.clone();
  g.setIndex(keep);
  const out = new THREE.Mesh(g, m.material);
  out.rotation.y = RAMP_MODEL.yaw;
  const holder = new THREE.Group();
  holder.add(out);
  const box = new THREE.Box3().setFromObject(holder);
  const k = 1 / Math.max(1e-6, box.max.x - box.min.x);
  holder.scale.setScalar(k);
  box.setFromObject(holder);
  holder.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const wrap = new THREE.Group();
  wrap.add(holder);
  wrap.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return wrap;
}

/** Loads the ramp model once; every ramp on the table (and later ones) then shows it instead of the placeholder. */
export async function useRampModel(url: string, load: (url: string) => Promise<THREE.Object3D | null>): Promise<void> {
  const scene = await load(url);
  rampModel = scene ? cutRamp(scene) : null;
  if (rampModel) for (const slot of rampSlots) fillRamp(slot);
}

function fillRamp(slot: THREE.Group): void {
  const space = slot.userData.space as number;
  slot.clear();
  if (rampModel) {
    const m = rampModel.clone(true);
    m.scale.setScalar(space * RAMP_MODEL.length);
    slot.add(m);
  } else slot.add(makeRamp(space));
}

/** A ramp `space` world units long, rising toward +x: the model when loaded, else the placeholder. */
export function rampPiece(space: number): THREE.Group {
  const slot = new THREE.Group();
  slot.userData.space = space;
  rampSlots.add(slot);
  fillRamp(slot);
  return slot;
}

/** The ramps standing on a face's ramp spaces, or null when it has none. */
export function buildRamps(tile: TileData, o: CarnagePieceOptions): THREE.Group | null {
  const cells = cellsOf(tile, 'P', o);
  if (!cells.length) return null;
  const space = GRID.pitch * o.width / GRID.frameW;
  const g = new THREE.Group();
  for (const c of cells) {
    const ramp = rampPiece(space);
    ramp.position.set(c.x, 0, c.z);
    g.add(ramp);
  }
  return g;
}
