// 3D pieces of Carnage at Devil's Run on the road tiles, from the grid alone (no licensed art):
// a particle fire (flames, smoke, flickering glow) on fire spaces (and anywhere else something burns: a revealed fire hazard,
// a car ON FIRE!), and a placeholder launch ramp on ramp spaces until its model exists
// (assets/models/Ramp.glb, made from the prompts in design/art/carnage-ramp-prompts.md).
//
// The fires share their materials: one call to tickFlames per frame animates every fire on the table.

import * as THREE from 'three';
import { GRID, spaceCenterPx, type TileData } from '../tile-grid';

/**
 * Look of the fire, a particle system: `flames` particles per fire rise from the base, sway, shrink
 * and cool (white-yellow, orange, deep red), added to the light so they build into a body of flame;
 * `smoke` puffs rise above them, grow and thin. `rise`: how high a flame goes, in spaces.
 */
export const FIRE_LOOK = { flames: 110, smoke: 14, rise: 1.7, flameLife: 1.0, smokeLife: 3.2 };

const NOISE_GLSL = /* glsl */ `
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }`;

/**
 * One shader for both kinds of particle. Per particle: aP = (start angle, start radius 0..1, phase,
 * speed). Uniforms: uSpace (world size of a space), uLife (seconds a particle lives), uSmoke (0 flame,
 * 1 smoke), uScale (pixels per world unit at distance 1).
 */
function particleMaterial(smoke: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: fireTime, uScale: fireScale, uSpace: { value: 1 }, uLife: { value: smoke ? FIRE_LOOK.smokeLife : FIRE_LOOK.flameLife } },
    vertexShader: /* glsl */ `
      uniform float uTime, uScale, uSpace, uLife;
      attribute vec4 aP;
      varying float vLife;
      varying float vSeed;
      void main() {
        float speed = 0.75 + aP.w * 0.5;
        float life = fract(uTime / uLife * speed + aP.z);
        vLife = life;
        vSeed = aP.z;
        float r = aP.y * uSpace * ${smoke ? '0.18' : '0.3'};
        vec3 p;
        ${smoke
          ? `p = vec3(cos(aP.x) * r + sin(life * 4.0 + aP.z * 30.0) * 0.15 * uSpace * life,
                     uSpace * (0.55 + life * 2.0),
                     sin(aP.x) * r + cos(life * 3.0 + aP.z * 20.0) * 0.12 * uSpace * life);`
          : `// Flames gather toward the middle as they rise (a cone), and lick sideways.
             float conv = 1.0 - life * 0.75;
             float sway = sin(life * 9.0 + aP.z * 40.0 + uTime * 3.0) * 0.07 * uSpace * life;
             p = vec3(cos(aP.x) * r * conv + sway, life * life * 0.4 * uSpace + life * ${FIRE_LOOK.rise.toFixed(2)} * uSpace * 0.6 * speed,
                      sin(aP.x) * r * conv + cos(life * 7.0 + aP.z * 25.0) * 0.05 * uSpace * life);`}
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = ${smoke ? 'uSpace * (0.35 + life * 0.9)' : 'uSpace * (0.34 - life * 0.24) * (0.7 + aP.w * 0.6)'};
        gl_PointSize = uScale * size / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      varying float vLife;
      varying float vSeed;
      ${NOISE_GLSL}
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        // A wispy soft blob, not a disc: the edge is broken by noise.
        float d = length(c) * 2.0 + (vn(gl_PointCoord * 4.0 + vSeed * 37.0) - 0.5) * 0.5;
        float soft = 1.0 - smoothstep(0.2, 1.0, d);
        if (soft <= 0.0) discard;
        ${smoke
          ? `float a = soft * smoothstep(0.0, 0.2, vLife) * (1.0 - vLife) * 0.32;
             gl_FragColor = vec4(vec3(0.12, 0.11, 0.1) * (1.0 - vLife * 0.3), a);`
          : `// Cooling: white-yellow at birth, orange, deep red, gone.
             vec3 col = mix(vec3(1.0, 0.86, 0.5), vec3(1.0, 0.42, 0.06), smoothstep(0.05, 0.4, vLife));
             col = mix(col, vec3(0.55, 0.06, 0.02), smoothstep(0.4, 0.85, vLife));
             float a = soft * smoothstep(0.0, 0.06, vLife) * pow(1.0 - vLife, 1.4);
             gl_FragColor = vec4(col * a * 0.42, a);`}
      }`,
    transparent: true,
    depthWrite: false,
    blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending,
    toneMapped: false,
  });
}
const fireTime = { value: 0 };
const fireScale = { value: 600 };
/** Materials by space size (the uniform differs, the shader is the same). */
const fireMats = new Map<number, { flame: THREE.ShaderMaterial; smoke: THREE.ShaderMaterial }>();
function fireMaterials(space: number): { flame: THREE.ShaderMaterial; smoke: THREE.ShaderMaterial } {
  const k = Math.round(space * 1000);
  let m = fireMats.get(k);
  if (!m) {
    m = { flame: particleMaterial(false), smoke: particleMaterial(true) };
    m.flame.uniforms.uSpace.value = m.smoke.uniforms.uSpace.value = space;
    fireMats.set(k, m);
  }
  return m;
}

/**
 * Animates every fire (particles and the flickering glow). Call once per frame with the time in
 * seconds, the camera and the drawing buffer's height in pixels.
 */
export function tickFlames(seconds: number, camera?: THREE.Camera, viewHeight = 800): void {
  fireTime.value = seconds;
  const fov = (camera as THREE.PerspectiveCamera | undefined)?.fov ?? 30;
  fireScale.value = viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  if (glow) glow.opacity = 0.7 + 0.18 * Math.sin(seconds * 13) + 0.12 * Math.sin(seconds * 23.7);
}

/** The glow a fire casts on the ground: an orange disc that flickers; made on first use (it needs a canvas). */
let glow: THREE.MeshBasicMaterial | null = null;
const glowMaterial = (): THREE.MeshBasicMaterial => (glow ??= (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,140,40,.9)'); gr.addColorStop(0.45, 'rgba(255,70,10,.4)'); gr.addColorStop(1, 'rgba(255,50,10,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
})());

/** `n` particles with start angle, start radius, phase and speed. */
function particles(n: number, r: () => number, material: THREE.ShaderMaterial, space: number, top: number): THREE.Points {
  const g = new THREE.BufferGeometry();
  const data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) data.set([r() * Math.PI * 2, Math.sqrt(r()), r(), r()], i * 4);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aP', new THREE.BufferAttribute(data, 4));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, top / 2, 0), top);
  const p = new THREE.Points(g, material);
  p.renderOrder = material.blending === THREE.AdditiveBlending ? 8 : 7;
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
export interface CarnagePieceOptions {
  width: number; depth: number;
  /** World height of the ground at a frame pixel (the tile's relief); pieces stand on it. */
  ground?: (px: number, py: number) => number;
}

/** Centres (tile frame, world units, centred like the tile) of the spaces of terrain `code`. */
function cellsOf(tile: TileData, code: string, o: CarnagePieceOptions): { x: number; z: number; y: number; r: number; c: number }[] {
  const kx = o.width / GRID.frameW, kz = o.depth / GRID.frameH;
  const out: { x: number; z: number; y: number; r: number; c: number }[] = [];
  tile.terrain.forEach((row, r) => [...row].forEach((k, c) => {
    if (k !== code) return;
    const [px, py] = spaceCenterPx(r, c);
    const cx = px + GRID.tip / 2;
    // The lowest ground under the piece (its centre and both ends along the road): it rests on it, never floats.
    const y = o.ground ? Math.min(...[-0.3, 0, 0.3].map(f => o.ground!(cx + f * GRID.pitch, py))) : 0;
    out.push({ x: (cx - GRID.frameW / 2) * kx, z: (py - GRID.frameH / 2) * kz, y, r, c });
  }));
  return out;
}

/**
 * A fire over a space `space` world units wide, standing on y = 0: flame particles, smoke above
 * them and an orange glow on the ground.
 */
export function flameCluster(space: number, seed: number): THREE.Group {
  const r = rng(seed);
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(space * 0.8, 24), glowMaterial());
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.01;
  g.add(disc);
  const m = fireMaterials(space);
  g.add(particles(FIRE_LOOK.smoke, r, m.smoke, space, space * 3));
  g.add(particles(FIRE_LOOK.flames, r, m.flame, space, space * 1.5));
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
    cl.position.set(c.x, c.y, c.z);
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
 * The ramp model (assets/models/Ramp.glb, "Barricade Ramp" made with Meshy from
 * design/art/carnage-ramp-prompts.md): one object, rising toward -z; it is turned to rise toward +x,
 * the lead tile. `keepBelowX` can cut a file that holds more than one object (Infinity: keep all).
 */
const RAMP_MODEL = { keepBelowX: Infinity, yaw: -Math.PI / 2, length: 0.86 };
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
  const cut = src.clone();
  cut.setIndex(keep);
  // Only the kept vertices: the bounds (used to centre and scale the ramp) must not include the other ramp.
  const g = cut.toNonIndexed();
  // Centre on the bulk of the ramp, not its bounding box: stray bits at the edges of the file would
  // pull the box (and the ramp) off its space. The 3rd and 97th percentiles of x and z mark the ramp.
  const p = g.getAttribute('position');
  const span = (axis: 0 | 2): [number, number] => {
    const v = Array.from({ length: p.count }, (_, i) => p.getComponent(i, axis)).sort((a, b) => a - b);
    return [v[Math.floor(v.length * 0.03)], v[Math.floor(v.length * 0.97)]];
  };
  const [x0, x1] = span(0), [z0, z1] = span(2);
  let yMin = Infinity;
  for (let i = 0; i < p.count; i++) yMin = Math.min(yMin, p.getY(i));
  g.translate(-(x0 + x1) / 2, -yMin, -(z0 + z1) / 2);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  const out = new THREE.Mesh(g, m.material);
  out.rotation.y = RAMP_MODEL.yaw;
  const holder = new THREE.Group();
  holder.add(out);
  // Length along the road (model z, after the turn) taken from the same percentiles: 1 unit.
  holder.scale.setScalar(1 / Math.max(1e-6, z1 - z0));
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
    ramp.position.set(c.x, c.y, c.z);
    g.add(ramp);
  }
  return g;
}
