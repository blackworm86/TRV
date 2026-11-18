// The pit trap of Carnage at Devil's Run, once revealed: a real hole dug into the board, with a
// rim of broken asphalt and rocks, spikes and fallen planks at the bottom, and roadworks junk around
// it (sawhorses, traffic cones, a tyre, a barrel, rubbish bags). Generated from code, no model file.
//
// How the hole shows through the board: the board and the token are solid, so the hole is drawn in
// three steps after everything opaque (renderOrder): (1) the opening, invisible, marks the stencil
// where nothing nearer covers it; (2) the same opening sets the depth there to "far"; (3) the
// inside (walls, floor, spikes) is drawn normally and so shows only through the opening. The
// renderer needs `stencil: true`. Deterministic: same seed, same pit.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, lump, paint, rock, place } from './obstacles';

type Rgb = [number, number, number];
const hex = (n: number): Rgb => new THREE.Color(n).toArray() as Rgb;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dim = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];

/** Look of the pit; sizes are fractions of a space. */
export const PIT_LOOK = {
  /** Radius of the opening and how deep the hole goes. */
  radius: 0.31, depth: 0.85,
  /** How much narrower the bottom is than the opening. */
  taper: 0.3,
  spikes: 11, rimRocks: 13,
};

const C = {
  dirtTop: hex(0x7a5232), dirtMid: hex(0x5a3a22), dirtLow: hex(0x22160d), floor: hex(0x120c08),
  asphalt: hex(0x4a4a4c), asphaltTop: hex(0x67676a), sand: hex(0xc79a62),
  wood: hex(0x8a6038), woodDark: hex(0x5a3e24), iron: hex(0x3a3330), rust: hex(0x8a4a24),
  orange: hex(0xf06a18), white: hex(0xf2efe6), tyre: hex(0x1a1a1a), bag: hex(0x1e2a1c), bag2: hex(0x111111), paper: hex(0xd8d0bc),
};

/** A geometry in one colour per face, shaded a little at random. */
function tinted(g: THREE.BufferGeometry, c: Rgb | ((p: THREE.Vector3) => Rgb), r: () => number): THREE.BufferGeometry {
  const out = paint(g, () => [1, 1, 1]);
  // Colour by each face's centre, so bands (the cone's white stripe) have straight edges.
  const pos = out.getAttribute('position'), col = out.getAttribute('color') as THREE.BufferAttribute;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), m = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    m.fromBufferAttribute(pos, i).add(a.fromBufferAttribute(pos, i + 1)).add(b.fromBufferAttribute(pos, i + 2)).multiplyScalar(1 / 3);
    const k = dim(typeof c === 'function' ? c(m) : c, 0.85 + 0.25 * r());
    for (let j = 0; j < 3; j++) col.setXYZ(i + j, k[0], k[1], k[2]);
  }
  return out;
}

/** The opening's radius at angle a (world units). */
function rimRadius(s: number, seed: number): (a: number) => number {
  return a => s * PIT_LOOK.radius * (1 + 0.13 * lump(Math.cos(a) * 1.6, 0.4, Math.sin(a) * 1.6, seed)) * (Math.abs(Math.cos(a)) * 0.12 + 1);
}

/** Walls and floor of the hole, seen from inside. */
function well(s: number, seed: number, R: (a: number) => number): THREE.BufferGeometry {
  const N = 30, K = 7, depth = s * PIT_LOOK.depth;
  const ring = (j: number): THREE.Vector3[] => Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2, t = j / K;
    const r = R(a) * (1 - PIT_LOOK.taper * t) * (1 + 0.07 * lump(Math.cos(a) * 3, t * 4, Math.sin(a) * 3, seed + 3));
    return new THREE.Vector3(Math.cos(a) * r, -depth * Math.pow(t, 0.85) - 0.002, Math.sin(a) * r);
  });
  const rings = Array.from({ length: K + 1 }, (_, j) => ring(j));
  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): void => { pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); };
  for (let j = 0; j < K; j++) for (let i = 0; i < N; i++) {
    const a = rings[j][i], b = rings[j][(i + 1) % N], c = rings[j + 1][(i + 1) % N], d = rings[j + 1][i];
    tri(a, c, b); tri(a, d, c);
  }
  const mid = new THREE.Vector3(0, -depth - 0.002, 0);
  for (let i = 0; i < N; i++) tri(rings[K][i], mid, rings[K][(i + 1) % N]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return paint(g, p => {
    const t = Math.min(1, -p.y / depth);
    const band = 0.5 + 0.5 * Math.sin(p.y / s * 40 + lump(p.x / s * 6, 0, p.z / s * 6, seed) * 1.5);
    const c = t < 0.35 ? mix(C.dirtTop, C.dirtMid, t / 0.35) : mix(C.dirtMid, C.dirtLow, (t - 0.35) / 0.65);
    return dim(t > 0.97 ? C.floor : c, (0.75 + 0.3 * band) * (0.85 - 0.7 * t));
  });
}

/** Sharpened stakes and broken cover planks at the bottom, and a slab of road fallen in. */
function bottom(s: number, r: () => number, R: (a: number) => number): THREE.BufferGeometry[] {
  const depth = s * PIT_LOOK.depth, rb = s * PIT_LOOK.radius * (1 - PIT_LOOK.taper) * 0.75;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < PIT_LOOK.spikes; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rb, h = s * (0.14 + r() * 0.1);
    const g = new THREE.ConeGeometry(s * 0.02, h, 5).translate(0, h / 2, 0);
    parts.push(place(tinted(g, p => mix(C.wood, C.woodDark, p.y > h * 0.7 ? 0.9 : 0.2), r), Math.cos(a) * d, -depth, Math.sin(a) * d, r() * 6, 1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5));
  }
  // Planks of the cover the car broke through: one leaning on the wall, two on the bottom.
  const a0 = r() * Math.PI * 2;
  const lean = R(a0) * 0.7;
  parts.push(place(tinted(new THREE.BoxGeometry(s * 0.5, s * 0.016, s * 0.06), C.wood, r), Math.cos(a0) * lean * 0.55, -depth * 0.45, Math.sin(a0) * lean * 0.55, -a0, 1, 0, 0.75));
  for (let k = 0; k < 2; k++) {
    parts.push(place(tinted(new THREE.BoxGeometry(s * (0.2 + r() * 0.12), s * 0.016, s * 0.055), C.woodDark, r), (r() - 0.5) * rb, -depth + s * 0.02, (r() - 0.5) * rb, r() * 6, 1, 0, 0.15));
  }
  // A slab of asphalt broken off the rim, tipping into the hole.
  const a1 = a0 + 2.4;
  const slab = tinted(new THREE.BoxGeometry(s * 0.14, s * 0.025, s * 0.1), p => (p.y > 0 ? C.asphaltTop : C.asphalt), r);
  parts.push(place(slab, Math.cos(a1) * R(a1) * 0.82, -s * 0.05, Math.sin(a1) * R(a1) * 0.82, -a1, 1, 0, -0.65));
  return parts;
}

/** A roadworks sawhorse, length l, along x, standing on y = 0. */
function sawhorse(l: number, r: () => number): THREE.BufferGeometry[] {
  const h = l * 0.36, parts: THREE.BufferGeometry[] = [];
  const seg = 6;
  for (let i = 0; i < seg; i++) {
    const g = new THREE.BoxGeometry(l / seg, h * 0.22, l * 0.03);
    parts.push(place(tinted(g, i % 2 ? C.white : C.orange, r), -l / 2 + l / seg * (i + 0.5), h, 0, 0, 1, 0, 0));
  }
  for (const x of [-l * 0.38, l * 0.38]) for (const side of [-1, 1]) {
    const leg = new THREE.BoxGeometry(l * 0.035, h * 1.1, l * 0.035).translate(0, h * 0.55, 0);
    parts.push(place(tinted(leg, C.wood, r), x, 0, side * h * 0.22, 0, 1, side * 0.38, 0));
  }
  return parts;
}

/** A traffic cone, height h, with its square foot and white band. */
function cone(h: number, r: () => number): THREE.BufferGeometry[] {
  const body = new THREE.ConeGeometry(h * 0.32, h, 12, 9).translate(0, h / 2 + h * 0.06, 0);
  return [
    tinted(body, p => (p.y > h * (0.06 + 4 / 9) && p.y < h * (0.06 + 6 / 9) ? C.white : C.orange), r),
    tinted(new THREE.BoxGeometry(h * 0.78, h * 0.06, h * 0.78).translate(0, h * 0.03, 0), C.orange, r),
  ];
}

/** Rubbish: a tyre, a barrel on its side, bags, scraps of paper. */
function junk(s: number, r: () => number, seed: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(place(tinted(new THREE.TorusGeometry(s * 0.045, s * 0.02, 6, 14), C.tyre, r), -s * 0.36, s * 0.02, s * 0.29, 0, 1, Math.PI / 2 - 0.15));
  const barrel = new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.1, 10);
  parts.push(place(tinted(barrel, p => (Math.abs(p.y) > s * 0.03 && Math.abs(p.y) < s * 0.04 ? C.iron : C.rust), r), s * 0.38, s * 0.04, -s * 0.28, 0.6, 1, 0, Math.PI / 2));
  for (let k = 0; k < 4; k++) {
    const b = rock(seed + 40 + k);
    const at: [number, number] = [[-s * 0.42, -s * 0.06], [s * 0.3, s * 0.32], [-s * 0.18, -s * 0.38], [s * 0.44, s * 0.08]][k] as [number, number];
    parts.push(place(paint(b, () => dim(k % 2 ? C.bag : C.bag2, 0.8 + 0.4 * r())), at[0], 0, at[1], r() * 6, [s * 0.045, s * 0.035, s * 0.04]));
  }
  for (let k = 0; k < 3; k++) {
    const a = r() * Math.PI * 2, d = s * (0.36 + r() * 0.1);
    parts.push(place(tinted(new THREE.BoxGeometry(s * 0.04, s * 0.003, s * 0.03), C.paper, r), Math.cos(a) * d, s * 0.002, Math.sin(a) * d, r() * 6, 1, (r() - 0.5) * 0.3));
  }
  return parts;
}

/** The rim: chunks of broken road and rocks, a few spilling over the edge. */
function rim(s: number, r: () => number, seed: number, R: (a: number) => number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < PIT_LOOK.rimRocks; k++) {
    const a = (k / PIT_LOOK.rimRocks) * Math.PI * 2 + (r() - 0.5) * 0.3, d = R(a) * (1.04 + r() * 0.2);
    const asphalt = r() < 0.7;
    const g = asphalt
      ? tinted(new THREE.BoxGeometry(s * (0.06 + r() * 0.05), s * 0.022, s * (0.05 + r() * 0.04)), p => (p.y > 0 ? C.asphaltTop : C.asphalt), r)
      : paint(rock(seed + k), p => dim(mix(C.sand, C.dirtTop, 0.5 + 0.5 * Math.sin(p.x * 9 + p.z * 7)), 0.8 + 0.3 * r()));
    parts.push(asphalt
      ? place(g, Math.cos(a) * d, s * 0.008, Math.sin(a) * d, -a + (r() - 0.5), 1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5)
      : place(g, Math.cos(a) * d, 0, Math.sin(a) * d, r() * 6, [s * (0.03 + r() * 0.022), s * (0.016 + r() * 0.016), s * (0.03 + r() * 0.022)]));
  }
  // Loose earth thrown up around the hole.
  for (let k = 0; k < 2; k++) {
    const a = r() * Math.PI * 2, d = R(a) * 1.2;
    parts.push(place(paint(rock(seed + 70 + k), () => dim(C.sand, 0.8 + 0.2 * r())), Math.cos(a) * d, -s * 0.004, Math.sin(a) * d, r() * 6, [s * 0.08, s * 0.012, s * 0.06]));
  }
  return parts;
}

let maskMats: [THREE.Material, THREE.Material] | null = null;
/** The two invisible materials of the opening: stencil mark, then depth reset where marked. */
export function maskMaterials(): [THREE.Material, THREE.Material] {
  if (maskMats) return maskMats;
  // All three steps go in the transparent pass (as the board's information layer, renderOrder 1),
  // after it: otherwise the printed marks of the space (a hazard space's red triangles) would be
  // drawn over the hole.
  const mark = new THREE.MeshBasicMaterial({
    transparent: true,
    colorWrite: false, depthWrite: false, depthTest: true,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  const clear = new THREE.ShaderMaterial({
    vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'void main() { gl_FragColor = vec4(0.0); gl_FragDepth = 1.0; }',
    transparent: true,
    colorWrite: false, depthWrite: true, depthTest: true, depthFunc: THREE.AlwaysDepth,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc, stencilZPass: THREE.ZeroStencilOp,
  });
  return (maskMats = [mark, clear]);
}

const solid = (): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0.02 });

/**
 * A revealed pit trap for a space `space` wide, standing on y = 0 (the top of the token or the
 * board): the opening in the middle, the hole going down `PIT_LOOK.depth` of a space.
 * Example: `token.setGround('pit', pitPiece(spaceWidth, 17))`.
 */
export function pitPiece(space: number, seed = 1): THREE.Group {
  const s = space, r = rng(seed * 7919 + 13), R = rimRadius(s, seed);
  const group = new THREE.Group();
  group.name = 'pit-trap';

  const opening = new THREE.Shape(Array.from({ length: 30 }, (_, i) => {
    const a = (i / 30) * Math.PI * 2;
    return new THREE.Vector2(Math.cos(a) * R(a), -Math.sin(a) * R(a));
  }));
  const hole = new THREE.ShapeGeometry(opening).rotateX(-Math.PI / 2);
  const [mark, clear] = maskMaterials();
  const m1 = new THREE.Mesh(hole, mark), m2 = new THREE.Mesh(hole, clear);
  m1.renderOrder = 10; m2.renderOrder = 11;
  m1.position.y = m2.position.y = 0.0005;

  const inside = new THREE.Mesh(mergeGeometries([well(s, seed, R), ...bottom(s, r, R)]), Object.assign(solid(), { transparent: true }));
  inside.renderOrder = 12;
  inside.receiveShadow = false;

  const round = new THREE.Mesh(mergeGeometries([
    ...rim(s, r, seed, R), ...junk(s, r, seed),
    ...sawhorse(s * 0.42, r).map(g => place(g, 0, 0, -s * 0.37, 0.12)),
    ...sawhorse(s * 0.38, r).map(g => place(g, s * 0.06, 0, s * 0.37, Math.PI + 0.3, 1, Math.PI / 2 * 0.98)),
    ...cone(s * 0.13, r).map(g => place(g, s * 0.42, 0, s * 0.2)),
    ...cone(s * 0.13, r).map(g => place(g, -s * 0.44, 0, -s * 0.24)),
    ...cone(s * 0.12, r).map(g => place(g, -s * 0.34, s * 0.04, s * 0.06, 2.1, 1, 0, Math.PI / 2)),
  ]), solid());
  round.castShadow = true;
  round.receiveShadow = true;

  group.add(m1, m2, inside, round);
  return group;
}
