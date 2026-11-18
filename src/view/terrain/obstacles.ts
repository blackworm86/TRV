// 3D obstacles standing on a face's impassable spaces, generated from the grid alone (no licensed
// art, no model files). The impassable spaces that touch are one formation (formations.ts,
// design/gdd/terrain-generation.md): one body modelled over the whole group (a ridge of rock, a
// mesa, a bunker complex), or walls around it (a ruin), never one piece repeated per space. Each
// face has one kind (data/trv/terrain_look.json), after what its printed art shows. Deterministic:
// same face and seed, same shapes.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GRID, type TileData } from '../tile-grid';
import LOOK from '../../../data/trv/terrain_look.json';
import { depthAt, footprintHalf, formationsOf, heightAt, type FormKnobs, type FormProfile, type Formation } from './formations';

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
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap smooth 3D noise, about -1.5..1.5, for lumpy rock. */
export function lump(x: number, y: number, z: number, s: number): number {
  return Math.sin(x * 2.1 + s) * Math.cos(y * 1.7 + s * 1.3) * Math.sin(z * 2.3 + s * 0.7)
    + 0.5 * Math.sin(x * 4.7 + z * 3.9 + s * 2.1) * Math.cos(y * 5.3 + s);
}

/** Gives a geometry flat faces and one colour per face from `colour(first corner)`. */
export function paint(geo: THREE.BufferGeometry, colour: (p: THREE.Vector3) => Rgb): THREE.BufferGeometry {
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
export function rock(seed: number, flatTop?: number): THREE.BufferGeometry {
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
export function place(g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, s: number | [number, number, number] = 1, rx = 0, rz = 0): THREE.BufferGeometry {
  const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
  return g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), sc));
}

function seedOf(text: string): number {
  let n = 2166136261;
  for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
  return n >>> 0;
}

/** Sizes of every formation, from the data (data/trv/terrain_look.json, `formation`). */
export const FORM_KNOBS: FormKnobs = { baseH: LOOK.formation.base_h, grow: LOOK.formation.grow, maxH: LOOK.formation.max_h, inset: LOOK.formation.inset };
const PROFILE = LOOK.kinds as Record<ObstacleKind, FormProfile>;

/** What one impassable space hides, for the camera: a cylinder in the tile's own frame (world units). */
export interface ObstacleBlocker { x: number; z: number; r: number; h: number }

/** Colours a body face by face: `colour(middle of the face, how level it is: 1 flat, 0 a wall)`. */
function tint(geo: THREE.BufferGeometry, colour: (p: THREE.Vector3, level: number) => Rgb): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    const rgb = colour(a.clone().add(b).add(c).divideScalar(3), Math.abs(n.y));
    for (let k = 0; k < 3; k++) col.set(rgb, (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/** A steady 0..1 value for a point, so neighbouring faces differ a little in tone. */
function jitter(p: THREE.Vector3, seed: number): number {
  const n = Math.sin(p.x * 91.7 + p.y * 37.3 + p.z * 57.1 + seed) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * The body of a formation: its height (formations.ts) sampled on a grid over the whole group and
 * turned into flat faces, in the tile's frame (x along the road, z across, y up, world units).
 * `rough` shakes the grid so rock has no straight lines; built things keep it square.
 */
function body(f: Formation, p: FormProfile, seed: number, kx: number, kz: number, S: number, rough: number): THREE.BufferGeometry | null {
  const step = GRID.pitch / 10;
  const { hw, hh } = footprintHalf(FORM_KNOBS);
  const x0 = Math.min(...f.cells.map(c => c.x)) - hw - step * 1.5, x1 = Math.max(...f.cells.map(c => c.x)) + hw + step * 1.5;
  const y0 = Math.min(...f.cells.map(c => c.y)) - hh - step * 1.5, y1 = Math.max(...f.cells.map(c => c.y)) + hh + step * 1.5;
  const nx = Math.ceil((x1 - x0) / step) + 1, ny = Math.ceil((y1 - y0) / step) + 1;
  const jit = rng(seed ^ 0x51ed);
  const P = new Float32Array(nx * ny * 3);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + (jit() - 0.5) * rough) * step, y = y0 + (j + (jit() - 0.5) * rough) * step;
    P.set([(x - GRID.frameW / 2) * kx, heightAt(f, x, y, FORM_KNOBS, p, seed) * S, (y - GRID.frameH / 2) * kz], (j * nx + i) * 3);
  }
  const out: number[] = [];
  const tri = (a: number, b: number, c: number): void => {
    if (P[a * 3 + 1] <= 0 && P[b * 3 + 1] <= 0 && P[c * 3 + 1] <= 0) return; // outside the footprint
    for (const v of [a, b, c]) out.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
  };
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    if ((i + j) & 1) { tri(a, c, b); tri(b, c, d); } else { tri(a, c, d); tri(a, d, b); }
  }
  if (!out.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(out), 3));
  return g;
}

/**
 * Rocks and mesas: on each impassable space a rock with smaller ones around it (a tall flat-topped
 * one for a mesa), and one more between each two spaces that touch, so the pile runs on.
 */
function rockPiles(forms: Formation[], kind: ObstacleKind, r: () => number, S: number, D: number, wx: (px: number) => number, wz: (py: number) => number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const cells = forms.flatMap(f => f.cells).sort((a, b) => a.r - b.r || a.c - b.c).map(c => ({ x: wx(c.x), z: wz(c.y) }));
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
    } else {
      parts.push(place(rock(s1, 0.75 + r() * 0.35), c.x, 0, c.z, r() * 6, [S * 0.42, S * (0.62 + r() * 0.3), D * 0.44]));
      for (let k = 0; k < 2; k++) {
        const a = r() * 6.28;
        parts.push(place(rock(s1 + k + 1), c.x + Math.cos(a) * S * 0.36, 0, c.z + Math.sin(a) * D * 0.36, r() * 6, S * (0.09 + r() * 0.07)));
      }
    }
  }
  for (const m of links) {
    const s1 = Math.floor(r() * 1000);
    if (kind === 'rocks') parts.push(place(rock(s1), m.x, 0, m.z, r() * 6, [S * 0.26, S * (0.22 + r() * 0.12), D * 0.26]));
    else parts.push(place(rock(s1, 0.7 + r() * 0.25), m.x, 0, m.z, m.a, [S * 0.5, S * (0.6 + r() * 0.25), D * 0.36]));
  }
  return parts;
}

/**
 * Builds the obstacles of a face: one mesh (flat-shaded, vertex colours) in the tile's own frame,
 * centred like the tile, standing on y = 0. Returns null when the face has no impassable space.
 * `mesh.userData.blockers` lists what each impassable space hides (`ObstacleBlocker`), for the camera.
 * Example: `const m = buildObstacles(tile, 'bunker', { width: W, depth: D }); if (m) group.add(m)`.
 */
export function buildObstacles(tile: TileData, kind: ObstacleKind, o: ObstacleOptions): THREE.Mesh | null {
  const forms = formationsOf(tile, FORM_KNOBS);
  if (!forms.length) return null;
  const kx = o.width / GRID.frameW, kz = o.depth / GRID.frameH;
  const S = GRID.pitch * kx, D = GRID.rowPitch * kz; // world size of a space
  const seed = o.seed ?? seedOf(`${tile.tile ?? ''}${tile.side ?? ''}${tile.name}`);
  const r = rng(seed);
  const prof = PROFILE[kind] ?? PROFILE.rocks;
  const half = footprintHalf(FORM_KNOBS);
  const HW = half.hw * kx, HD = half.hh * kz; // world half-sizes of the part of a space a formation stands on
  const wx = (px: number): number => (px - GRID.frameW / 2) * kx, wz = (py: number): number => (py - GRID.frameH / 2) * kz;
  const natural = kind === 'rocks' || kind === 'mesa';
  const parts: THREE.BufferGeometry[] = natural ? rockPiles(forms, kind, rng(seed), S, D, wx, wz) : [];
  const blockers: ObstacleBlocker[] = [];

  forms.forEach((f, fi) => {
    const fseed = (seed + fi * 7919) >>> 0;
    const top = FORM_KNOBS.maxH * prof.h * S;
    /** Top of the body over a frame point, world units. */
    const topAt = (px: number, py: number): number => heightAt(f, px, py, FORM_KNOBS, prof, fseed) * S;
    /** True when a point this far (world) from a space centre is off the formation: an outer side. */
    const open = (c: { x: number; y: number }, dx: number, dz: number): boolean => depthAt(f, c.x + dx / kx, c.y + dz / kz, FORM_KNOBS) <= 0;

    // Rocks and mesas are piles of single rocks (rockPiles, below); built things are one body.
    const g = natural ? null : body(f, prof, fseed, kx, kz, S, 0);
    if (g) {
      parts.push(tint(g, (p, level) => {
        const hn = Math.min(1, p.y / top);
        if (kind === 'mesa') {
          // Strata on the walls, a pale cap on what is level and high.
          const band = 0.5 + 0.5 * Math.sin(p.y / S * 34 + lump(p.x / S, 0, p.z / S, fseed) * 0.9);
          const wall = blend(ROCK[2], blend(ROCK[0], ROCK[1], band), Math.min(1, 0.5 + hn * 0.7));
          return level > 0.82 && hn > 0.45 ? shade(blend(wall, ROCK[3], 0.6), 0.92 + 0.14 * jitter(p, fseed)) : shade(wall, 0.85 + 0.25 * (1 - level));
        }
        if (kind === 'rocks') {
          const band = 0.5 + 0.33 * lump(p.x / S * 5, p.y / S * 5, p.z / S * 5, fseed + 9);
          return shade(blend(ROCK[2], blend(ROCK[0], ROCK[1], band), Math.min(1, 0.4 + hn * 0.9)), 0.82 + 0.3 * level + 0.1 * jitter(p, fseed));
        }
        if (kind === 'bunker') return shade(CONCRETE[level > 0.82 ? 0 : 1], 0.86 + 0.22 * jitter(p, fseed));
        return shade(CONCRETE[2], 0.8 + 0.4 * jitter(p, fseed)); // the ground of a ruin or a barricade
      }));
    }

    const heart = f.cells.reduce((m, x, i) => (x.n > f.cells[m].n ? i : m), 0);
    f.cells.forEach((c, ci) => {
      const cx = wx(c.x), cz = wz(c.y);
      const hc = topAt(c.x, c.y);
      const s1 = Math.floor(r() * 1000);
      blockers.push({ x: cx, z: cz, r: Math.max(HW, HD), h: kind === 'rocks' ? S * 0.55 : kind === 'mesa' ? S * 1.0 : kind === 'bunker' ? hc * 1.1 : f.height * S });
      if (natural) return;
      if (kind === 'bunker') {
        // Firing slits and sandbags on the outer sides; one hatch and one antenna for the whole complex.
        for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
          if (!open(c, sx * (HW + S * 0.12), sz * (HD + S * 0.12))) continue;
          const along = sx ? HD : HW;
          parts.push(place(box(along * 0.9, S * 0.05, S * 0.03, [METAL[2]], r), cx + sx * HW * 0.9, hc * 0.5, cz + sz * HD * 0.9, sx ? Math.PI / 2 : 0));
          for (let k = 0; k < 2; k++) {
            if (r() < 0.35) continue;
            const t = (k - 0.5) * along * 1.1;
            const bag = paint(new THREE.SphereGeometry(0.5, 6, 4).translate(0, 0.5, 0), () => shade(SANDBAG, 0.8 + 0.3 * r()));
            parts.push(place(bag, cx + sx * (HW + S * 0.03) + (sx ? 0 : t), 0, cz + sz * (HD + S * 0.02) + (sx ? t : 0), sx ? Math.PI / 2 : 0, [S * 0.15, S * 0.07, S * 0.08]));
          }
        }
        if (ci === heart) {
          parts.push(place(box(HW * 1.2, S * 0.04, HD * 1.2, [CONCRETE[0]], r), cx, hc, cz));
          parts.push(place(paint(new THREE.CylinderGeometry(0.5, 0.5, 1, 10).translate(0, 0.5, 0), () => METAL[0]), cx + S * 0.08, hc + S * 0.04, cz, 0, [S * 0.2, S * 0.04, S * 0.2]));
          parts.push(place(box(S * 0.012, S * 0.45, S * 0.012, [METAL[0]], r), cx - S * 0.16, hc + S * 0.04, cz - D * 0.14));
        } else if (r() < 0.4) parts.push(place(box(S * 0.16, S * 0.07, S * 0.12, [METAL[1]], r), cx + (r() - 0.5) * HW, hc, cz + (r() - 0.5) * HD, r() * 3)); // a vent
      } else if (kind === 'ruin') {
        // Broken walls along the outer sides of the group, blocks of uneven height; rubble inside.
        const wallH = f.height * S;
        for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
          const along = sx ? HD : HW, n = sx ? 4 : 5;
          for (let k = 0; k < n; k++) {
            const t = ((k + 0.5) / n * 2 - 1) * along;
            const px = sx ? sx * HW * 0.94 : t, pz = sx ? t : sz * HD * 0.94;
            const gap = r(), hgt = wallH * (0.35 + 0.65 * r());
            if (gap < 0.2 || !open(c, px + sx * S * 0.14, pz + sz * S * 0.14)) continue;
            parts.push(place(box(along * 2 / n * 1.03, hgt, S * 0.09, BRICK, r, CONCRETE[0]), cx + px, 0, cz + pz, sx ? Math.PI / 2 : 0));
          }
        }
        for (let k = 0; k < 8; k++) {
          const b = box(S * (0.05 + r() * 0.09), S * (0.04 + r() * 0.07), S * (0.05 + r() * 0.08), r() < 0.6 ? BRICK : CONCRETE, r);
          parts.push(place(b, cx + (r() - 0.5) * HW * 1.6, 0, cz + (r() - 0.5) * HD * 1.6, r() * 6, 1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5));
        }
        parts.push(place(box(HW * 1.3, S * 0.035, S * 0.05, METAL, r), cx, S * 0.12, cz, r() * 6, 1, 0, 0.4)); // fallen beam
      } else if (kind === 'barricade') {
        // Concrete barriers, steel hedgehogs and a stack of tyres.
        for (let k = 0; k < 2; k++) {
          const shape = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0.2, 1), new THREE.Vector2(-0.2, 1)]);
          const b = paint(new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5), () => shade(CONCRETE[0], 0.8 + 0.3 * r()));
          parts.push(place(b, cx + (k - 0.5) * S * 0.2, 0, cz + (k - 0.5) * D * 0.42, (r() - 0.5) * 0.5 + Math.PI / 2, [S * 0.16, S * 0.3, S * 0.6]));
        }
        for (let k = 0; k < 2; k++) {
          const x = cx + (r() - 0.5) * S * 0.6, z = cz + (r() - 0.5) * D * 0.3, ry = r() * 6;
          for (const [rx, rz] of [[0.9, 0], [-0.9, 0], [0, 0.9]] as [number, number][]) {
            parts.push(place(box(S * 0.035, S * 0.44, S * 0.035, METAL, r).translate(0, -S * 0.22, 0), x, S * 0.16, z, ry, 1, rx, rz));
          }
        }
        for (let k = 0; k < 3; k++) {
          const tyre = paint(new THREE.TorusGeometry(0.5, 0.2, 6, 12).rotateX(Math.PI / 2), () => shade(METAL[2], 0.8 + 0.5 * r()));
          parts.push(place(tyre, cx - S * 0.3, S * (0.03 + k * 0.055), cz + D * 0.3, 0, S * 0.15));
        }
      }
    });
    // A barricade runs on between its spaces with one more barrier.
    if (kind === 'barricade') for (const l of f.links) {
      const a = f.cells[l.a], b = f.cells[l.b];
      parts.push(place(box(S * 0.5, S * 0.16, S * 0.08, [CONCRETE[0]], r), wx((a.x + b.x) / 2), 0, wz((a.y + b.y) / 2), Math.atan2(-(b.y - a.y) * kz, (b.x - a.x) * kx)));
    }
  });

  // Every part as plain triangles with a position, a normal and a colour, so they merge into one mesh.
  const plain = parts.map(p => {
    const q = p.index ? p.toNonIndexed() : p;
    q.deleteAttribute('uv');
    if (!q.getAttribute('normal')) q.computeVertexNormals();
    return q;
  });
  const geo = mergeGeometries(plain);
  for (const p of new Set([...parts, ...plain])) p.dispose();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'obstacles';
  mesh.userData.blockers = blockers;
  return mesh;
}
