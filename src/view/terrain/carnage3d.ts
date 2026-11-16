// 3D pieces of Carnage at Devil's Run on the road tiles, from the grid alone (no licensed art):
// animated cartoon flames on fire spaces (and anywhere else something burns: a revealed fire hazard,
// a car ON FIRE!), and a placeholder launch ramp on ramp spaces until its model exists
// (assets/models/Ramp.glb, made from the prompts in design/art/carnage-ramp-prompts.md).
//
// The flames share one material: one call to tickFlames per frame animates every flame on the table.

import * as THREE from 'three';
import { GRID, spaceCenterPx, type TileData } from '../tile-grid';

/** Look of the flames: colour bands as in the tile art (yellow core, orange body, red rim), speed. */
export const FLAME_LOOK = {
  core: new THREE.Color('#fff2a0'), body: new THREE.Color('#ff9a1e'), rim: new THREE.Color('#e3341a'),
  /** Rising speed of the flame's noise, per second. */
  speed: 1.6,
  /** Flame height over its width. */
  aspect: 1.6,
};

const flameMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uCore: { value: FLAME_LOOK.core }, uBody: { value: FLAME_LOOK.body }, uRim: { value: FLAME_LOOK.rim },
  },
  vertexShader: /* glsl */ `
    attribute float aSeed;
    varying vec2 vUv;
    varying float vSeed;
    void main() {
      vUv = uv;
      vSeed = aSeed;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uCore, uBody, uRim;
    varying vec2 vUv;
    varying float vSeed;
    float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
    }
    void main() {
      float t = uTime * ${FLAME_LOOK.speed.toFixed(2)} + vSeed * 7.0;
      vec2 uv = vUv;
      // The flame sways and licks upward: noise rising through it bends and tears its outline.
      float sway = (n(vec2(uv.y * 3.0 - t, vSeed)) - 0.5) * 0.35 * uv.y;
      float x = (uv.x - 0.5 - sway) * 2.0;
      float width = (1.0 - uv.y) * (0.75 + 0.25 * sin(uv.y * 3.14));
      float shape = width - abs(x);
      float lick = n(vec2(uv.x * 4.0, uv.y * 3.0 - t * 1.4)) * 0.55 + n(vec2(uv.x * 9.0, uv.y * 7.0 - t * 2.2)) * 0.25;
      float v = shape + 0.35 - lick * (0.25 + uv.y);
      if (v < 0.12) discard;
      // Flat cartoon bands, no gradient: as printed.
      vec3 c = v > 0.62 ? uCore : v > 0.34 ? uBody : uRim;
      gl_FragColor = vec4(c, 1.0);
    }`,
  side: THREE.DoubleSide,
  transparent: false,
  toneMapped: false,
});

/** Every flame made, so each frame can turn them toward the camera. */
const flames = new Set<THREE.Mesh>();
const qParent = new THREE.Quaternion();

/**
 * Animates every flame and turns each one to face `camera` (a flat flame seen edge-on from above
 * would vanish). Call once per frame with the time in seconds.
 */
export function tickFlames(seconds: number, camera?: THREE.Camera): void {
  flameMaterial.uniforms.uTime.value = seconds;
  if (!camera) return;
  for (const f of flames) {
    if (!f.parent) { flames.delete(f); continue; }
    f.parent.getWorldQuaternion(qParent);
    f.quaternion.copy(qParent.invert().multiply(camera.quaternion));
  }
}

/**
 * One flame `size` world units wide, its base on the origin, facing the camera once tickFlames
 * runs. `seed` gives each flame its own flicker.
 */
export function makeFlame(size: number, seed = Math.random()): THREE.Mesh {
  const g = new THREE.PlaneGeometry(size, size * FLAME_LOOK.aspect).translate(0, size * FLAME_LOOK.aspect / 2, 0);
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Array(g.getAttribute('position').count).fill(seed), 1));
  const m = new THREE.Mesh(g, flameMaterial);
  m.renderOrder = 5;
  flames.add(m);
  return m;
}

/** The orange glow a fire casts on the ground; made on first use (it needs a canvas, so no DOM in tests until then). */
let glow: THREE.MeshBasicMaterial | null = null;
const glowMaterial = (): THREE.MeshBasicMaterial => (glow ??= (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,170,60,1)'); gr.addColorStop(0.5, 'rgba(255,90,20,.55)'); gr.addColorStop(1, 'rgba(255,60,10,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
})());

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
  const disc = new THREE.Mesh(new THREE.CircleGeometry(space * 0.75, 24), glowMaterial());
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.01;
  g.add(disc);
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const s = space * (0.45 + r() * 0.35) * (i === 0 ? 1.3 : 1);
    const f = makeFlame(s, r());
    f.position.set((r() - 0.5) * space * 0.45, 0, (r() - 0.5) * space * 0.35);
    g.add(f);
  }
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

/** The ramps standing on a face's ramp spaces, or null when it has none. */
export function buildRamps(tile: TileData, o: CarnagePieceOptions): THREE.Group | null {
  const cells = cellsOf(tile, 'P', o);
  if (!cells.length) return null;
  const space = GRID.pitch * o.width / GRID.frameW;
  const g = new THREE.Group();
  for (const c of cells) {
    const ramp = makeRamp(space);
    ramp.position.set(c.x, 0, c.z);
    g.add(ramp);
  }
  return g;
}
