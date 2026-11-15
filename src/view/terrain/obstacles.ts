// 3D obstacles standing on a face's impassable spaces, generated from the grid alone (no licensed
// art, no model files): rock piles, mesas (canyon walls), ruined buildings, bunkers and barricades.
// Each face has one kind (data/trv/terrain_look.json), after what its printed art shows. Neighbouring
// impassable spaces are joined into one formation. Deterministic: same face and seed, same shapes.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GRID, spaceCenterPx, type TileData } from '../tile-grid';

export type ObstacleKind = 'rocks' | 'mesa' | 'ruin' | 'bunker' | 'barricade';

export interface ObstacleOptions {
  /** World size of the tile frame along the road and across it. */
  width: number;
  depth: number;
  /** Variation seed; default: from the face's name. */
  seed?: number;
}

type Rgb = [number, number, number];
/** An sRGB hex colour as linear RGB, the space vertex colours are in. */
const hex = (n: number): Rgb => new THREE.Color(n).toArray() as Rgb;

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

/** Cheap smooth 3D noise, about -1.5..1.5, for lumpy rock. */
function lump(x: number, y: number, z: number, s: number): number {
  return Math.sin(x * 2.1 + s) * Math.cos(y * 1.7 + s * 1.3) * Math.sin(z * 2.3 + s * 0.7)
    + 0.5 * Math.sin(x * 4.7 + z * 3.9 + s * 2.1) * Math.cos(y * 5.3 + s);
}

/** Gives a geometry flat faces and one colour per face from `colour(first corner)`. */
function paint(geo: THREE.BufferGeometry, colour: (p: THREE.Vector3) => Rgb): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    const c = colour(v.fromBufferAttribute(pos, i));
    for (let k = 0; k < 3; k++) col.set(c, (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

const shade = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];
const blend = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const ROCK: Rgb[] = [hex(0xa3564f), hex(0xc27a5e), hex(0x6b3f3a), hex(0xd89a72)];
const CONCRETE: Rgb[] = [hex(0x8d8a82), hex(0x6f6d68), hex(0x4a4947)];
const BRICK: Rgb[] = [hex(0x9a4a3c), hex(0x7a3a32), hex(0xb9634a)];
const METAL: Rgb[] = [hex(0x3a3d42), hex(0x6a4a2e), hex(0x1f2023)];
const SANDBAG = hex(0xa89a72);

/**
 * A rock of radius about 1 standing on y = 0. `flatTop` cuts it level at that height (a mesa)
 * and paints strata.
 */
function rock(seed: number, flatTop?: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const pos = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.multiplyScalar(1 + 0.28 * lump(v.x, v.y, v.z, seed));
    v.y = Math.max(-0.05, v.y * 0.9 + 0.35);
    if (flatTop !== undefined) v.y = Math.min(flatTop + 0.04 * lump(v.x * 3, 0, v.z * 3, seed + 5), v.y * 1.6);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  return paint(g, p => {
    const band = flatTop !== undefined
      ? 0.5 + 0.5 * Math.sin(p.y * 16 + lump(p.x, 0, p.z, seed) * 0.8)
      : 0.5 + 0.33 * lump(p.x * 2, p.y * 2, p.z * 2, seed + 9);
    const base = blend(ROCK[0], ROCK[1], band);
    const top = flatTop !== undefined && p.y > flatTop - 0.08 ? blend(base, ROCK[3], 0.55) : base;
    return shade(blend(ROCK[2], top, Math.min(1, 0.45 + p.y * 0.8)), 0.9 + 0.2 * Math.sin(p.x * 7 + p.z * 5 + seed));
  });
}

/** A box with its base on y = 0, in one tone of a palette, each face a little lighter or darker. */
function box(w: number, h: number, d: number, pal: Rgb[], r: () => number, top?: Rgb): THREE.BufferGeometry {
  const tone = pal[Math.floor(r() * pal.length)];
  return paint(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), p => (top && p.y > h * 0.99 ? top : shade(tone, 0.82 + 0.3 * r())));
}

/** Moves a geometry: position, turn about y (then x, z), scale. */
function place(g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, s: number | [number, number, number] = 1, rx = 0, rz = 0): THREE.BufferGeometry {
  const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
  return g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), sc));
}

function seedOf(text: string): number {
  let n = 2166136261;
  for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
  return n >>> 0;
}

/**
 * Builds the obstacles of a face: one mesh (flat-shaded, vertex colours) in the tile's own frame,
 * centred like the tile, standing on y = 0. Returns null when the face has no impassable space.
 * Example: `const m = buildObstacles(tile, 'bunker', { width: W, depth: D }); if (m) group.add(m)`.
 */
export function buildObstacles(tile: TileData, kind: ObstacleKind, o: ObstacleOptions): THREE.Mesh | null {
  const kx = o.width / GRID.frameW, kz = o.depth / GRID.frameH;
  const S = GRID.pitch * kx, D = GRID.rowPitch * kz; // world size of a space
  const cells: { x: number; z: number }[] = [];
  tile.terrain.forEach((row, r) => [...row].forEach((k, c) => {
    if (k !== 'X') return;
    const [px, py] = spaceCenterPx(r, c);
    cells.push({ x: (px + GRID.tip / 2 - GRID.frameW / 2) * kx, z: (py - GRID.frameH / 2) * kz });
  }));
  if (!cells.length) return null;
  const r = rng(o.seed ?? seedOf(`${tile.tile ?? ''}${tile.side ?? ''}${tile.name}`));
  const parts: THREE.BufferGeometry[] = [];
  // Pairs of neighbouring impassable spaces: the formation runs on between them.
  const links: { x: number; z: number; a: number }[] = [];
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
    const a = cells[i], b = cells[j];
    if (Math.hypot(a.x - b.x, a.z - b.z) < S * 1.2) links.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, a: Math.atan2(-(b.z - a.z), b.x - a.x) });
  }

  for (const c of cells) {
    const s1 = Math.floor(r() * 1000);
    if (kind === 'rocks') {
      parts.push(place(rock(s1), c.x + (r() - 0.5) * S * 0.12, 0, c.z + (r() - 0.5) * D * 0.1, r() * 6, [S * 0.34, S * (0.3 + r() * 0.16), D * 0.36]));
      for (let k = 0; k < 4; k++) {
        const a = r() * 6.28, d = 0.26 + r() * 0.12;
        parts.push(place(rock(s1 + k + 1), c.x + Math.cos(a) * S * d, 0, c.z + Math.sin(a) * D * d, r() * 6, S * (0.1 + r() * 0.09)));
      }
    } else if (kind === 'mesa') {
      parts.push(place(rock(s1, 0.75 + r() * 0.35), c.x, 0, c.z, r() * 6, [S * 0.42, S * (0.62 + r() * 0.3), D * 0.44]));
      for (let k = 0; k < 2; k++) {
        const a = r() * 6.28;
        parts.push(place(rock(s1 + k + 1), c.x + Math.cos(a) * S * 0.36, 0, c.z + Math.sin(a) * D * 0.36, r() * 6, S * (0.09 + r() * 0.07)));
      }
    } else if (kind === 'ruin') {
      // Broken walls on three sides, each a row of blocks of uneven height; rubble in and around.
      const turn = Math.floor(r() * 4) * Math.PI / 2;
      const wall = (x0: number, z0: number, x1: number, z1: number): void => {
        const n = 5;
        for (let k = 0; k < n; k++) {
          if (r() < 0.18) continue; // a gap
          const t = (k + 0.5) / n;
          const g = box(Math.hypot(x1 - x0, z1 - z0) / n * 1.02, S * (0.16 + r() * 0.3), S * 0.1, BRICK, r, CONCRETE[0]);
          const p = new THREE.Vector3(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
          parts.push(place(g, c.x + p.x, 0, c.z + p.z, Math.atan2(-(z1 - z0), x1 - x0) + turn));
        }
      };
      const a = S * 0.36, b = D * 0.34;
      wall(-a, -b, a, -b); wall(-a, -b, -a, b); wall(a, -b, a, b * 0.2);
      for (let k = 0; k < 9; k++) {
        const g = box(S * (0.05 + r() * 0.09), S * (0.04 + r() * 0.07), S * (0.05 + r() * 0.08), r() < 0.6 ? BRICK : CONCRETE, r);
        parts.push(place(g, c.x + (r() - 0.5) * S * 0.8, 0, c.z + (r() - 0.5) * D * 0.8, r() * 6, 1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5));
      }
      parts.push(place(box(S * 0.6, S * 0.035, S * 0.05, METAL, r), c.x, S * 0.12, c.z, r() * 6, 1, 0, 0.45)); // fallen beam
    } else if (kind === 'bunker') {
      // A squat concrete block with sloped sides, firing slits, a roof slab, a hatch and sandbags.
      const hgt = S * 0.34;
      const body = paint(new THREE.CylinderGeometry(0.5, 0.64, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0), p => shade(CONCRETE[p.y > 0.99 ? 0 : 1], 0.85 + 0.25 * r()));
      parts.push(place(body, c.x, 0, c.z, 0, [S * 0.98, hgt, D * 0.98]));
      parts.push(place(box(S * 0.62, S * 0.05, D * 0.62, [CONCRETE[0]], r), c.x, hgt, c.z));
      parts.push(place(paint(new THREE.CylinderGeometry(0.5, 0.5, 1, 10).translate(0, 0.5, 0), () => METAL[0]), c.x + S * 0.1, hgt + S * 0.05, c.z, 0, [S * 0.2, S * 0.04, S * 0.2]));
      parts.push(place(box(S * 0.34, S * 0.06, S * 0.03, [METAL[2]], r), c.x + S * 0.33, hgt * 0.55, c.z, Math.PI / 2)); // slit, front
      parts.push(place(box(S * 0.34, S * 0.06, S * 0.03, [METAL[2]], r), c.x, hgt * 0.55, c.z + D * 0.33)); // slit, side
      parts.push(place(box(S * 0.012, S * 0.5, S * 0.012, [METAL[0]], r), c.x - S * 0.2, hgt, c.z - D * 0.18)); // antenna
      for (let k = 0; k < 5; k++) {
        const a = r() * 6.28;
        const bag = paint(new THREE.SphereGeometry(0.5, 6, 4).translate(0, 0.5, 0), () => shade(SANDBAG, 0.8 + 0.3 * r()));
        parts.push(place(bag, c.x + Math.cos(a) * S * 0.44, 0, c.z + Math.sin(a) * D * 0.44, a, [S * 0.16, S * 0.07, S * 0.09]));
      }
    } else {
      // Barricade: concrete barriers, steel hedgehogs and a stack of tyres.
      for (let k = 0; k < 2; k++) {
        const shape = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0.2, 1), new THREE.Vector2(-0.2, 1)]);
        const g = paint(new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5), () => shade(CONCRETE[0], 0.8 + 0.3 * r()));
        parts.push(place(g, c.x + (k - 0.5) * S * 0.2, 0, c.z + (k - 0.5) * D * 0.42, (r() - 0.5) * 0.5 + Math.PI / 2, [S * 0.16, S * 0.3, S * 0.6]));
      }
      for (let k = 0; k < 2; k++) {
        const x = c.x + (r() - 0.5) * S * 0.6, z = c.z + (r() - 0.5) * D * 0.3, ry = r() * 6;
        for (const [rx, rz] of [[0.9, 0], [-0.9, 0], [0, 0.9]] as [number, number][]) {
          parts.push(place(box(S * 0.035, S * 0.44, S * 0.035, METAL, r).translate(0, -S * 0.22, 0), x, S * 0.16, z, ry, 1, rx, rz));
        }
      }
      for (let k = 0; k < 3; k++) {
        const tyre = paint(new THREE.TorusGeometry(0.5, 0.2, 6, 12).rotateX(Math.PI / 2), () => shade(METAL[2], 0.8 + 0.5 * r()));
        parts.push(place(tyre, c.x - S * 0.3, S * (0.03 + k * 0.055), c.z + D * 0.3, 0, S * 0.15));
      }
    }
  }

  // Between neighbours the formation runs on: more rock, a wall, a corridor, another barrier.
  for (const m of links) {
    const s1 = Math.floor(r() * 1000);
    if (kind === 'rocks') parts.push(place(rock(s1), m.x, 0, m.z, r() * 6, [S * 0.26, S * (0.22 + r() * 0.12), D * 0.26]));
    else if (kind === 'mesa') parts.push(place(rock(s1, 0.7 + r() * 0.25), m.x, 0, m.z, m.a, [S * 0.5, S * (0.6 + r() * 0.25), D * 0.36]));
    else if (kind === 'ruin') {
      for (let k = -1; k <= 1; k++) parts.push(place(box(S * 0.2, S * (0.15 + r() * 0.35), S * 0.07, BRICK, r, CONCRETE[0]), m.x + k * Math.cos(m.a) * S * 0.2, 0, m.z - k * Math.sin(m.a) * S * 0.2, m.a));
    } else if (kind === 'bunker') parts.push(place(box(S * 0.5, S * 0.3, D * 0.42, [CONCRETE[1]], r, CONCRETE[0]), m.x, 0, m.z, m.a));
    else parts.push(place(box(S * 0.5, S * 0.16, S * 0.08, [CONCRETE[0]], r), m.x, 0, m.z, m.a));
  }

  const geo = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'obstacles';
  return mesh;
}
