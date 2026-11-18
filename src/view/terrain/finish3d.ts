// The finish lines (Thunder_Road_Finishlines.pdf), in 3D: what stands on the strip past the last
// road tile. Four of them, each with its own end of the world: a cliff over a river, a wall with
// a painted target, a grid of lasers, a dome. The strip's ground is generated as a road tile's
// (board3d.ts, buildFinish); here are the things on it. Generated from code, no model file;
// deterministic: same seed, same piece. Presentation only.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import LOOK from '../../../data/trv/finish_lines.json';
import { GRID } from '../tile-grid';
import { lump, paint, place, rng, rock } from './obstacles';
import { maskMaterials } from './pit3d';

export type FinishKind = 'cliff' | 'wall' | 'grid' | 'dome';
/** One finish line of data/trv/finish_lines.json. */
export interface FinishLine { id: string; name: string; kind: FinishKind }
export const FINISH_LINES = LOOK.lines as FinishLine[];
/** The ground of each row of the piece (terrain codes of game_base.json). */
export const FINISH_TERRAIN = LOOK.terrain;

type Rgb = [number, number, number];
const hex = (n: number): Rgb => new THREE.Color(n).toArray() as Rgb;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dim = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];

/** Frame px of the rear edge of the even rows: the piece's lengths are counted from there. */
const REAR = GRID.x0Even - GRID.pitch / 2;
/** Frame px, along the road, of a length in spaces from the piece's rear edge. */
export const finishPx = (spaces: number): number => REAR + spaces * GRID.pitch;
/** Where the piece is cut straight, in frame px. */
export const FINISH_CUT = finishPx(LOOK.length);
/** The rows' span across the road, in frame px. */
const ROWS0 = GRID.y0 - GRID.rowPitch / 2, ROWS1 = ROWS0 + GRID.rows * GRID.rowPitch;
const ROAD_MID = GRID.y0 + 2.5 * GRID.rowPitch;

function seedOf(text: string): number {
  let n = 2166136261;
  for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
  return n >>> 0;
}

/**
 * Where the piece's ground ends along the road at a frame y, in frame px: the straight cut, or
 * the broken edge of the cliff. Example: `finishGroundEnd(line, 700)`.
 */
export function finishGroundEnd(line: FinishLine, py: number): number {
  if (line.kind !== 'cliff') return FINISH_CUT;
  const s = seedOf(line.id);
  return finishPx(LOOK.cliff.at + LOOK.cliff.jag * (0.6 * lump(py / 170, 0.3, 1.1, s) + 0.4 * lump(py / 60, 1.7, 0.2, s + 5)));
}

/** What the builders share: the frame-to-world mapping, a space's width, the ground's height. */
interface Ctx { X: (px: number) => number; Z: (py: number) => number; s: number; seed: number; ground: (px: number, py: number) => number; table: number; line: FinishLine }

const solid = (): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0.02 });
function body(geos: THREE.BufferGeometry[], shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(mergeGeometries(geos), solid());
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}
/** A box standing on y = 0, coloured by `colour` (or one tone, each face a little different). */
function box(w: number, h: number, d: number, colour: Rgb | ((p: THREE.Vector3) => Rgb), r: () => number): THREE.BufferGeometry {
  return paint(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), p => (typeof colour === 'function' ? colour(p) : dim(colour, 0.84 + 0.28 * r())));
}
/** A canvas to paint a sign or a glow on, as a texture. */
function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const el = document.createElement('canvas');
  el.width = w; el.height = h;
  draw(el.getContext('2d')!);
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
/** A standing sheet facing back down the road (toward -x): its left is the first row's side. */
function sheet(length: number, height: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.PlaneGeometry(length, height).rotateY(-Math.PI / 2).translate(0, height / 2, 0), mat);
}
/** A few rocks around a point. */
function rubble(c: Ctx, r: () => number, px: number, py: number, n: number, size: number, spread: number): THREE.BufferGeometry[] {
  return Array.from({ length: n }, () => {
    const x = px + (r() - 0.5) * spread * GRID.pitch, y = py + (r() - 0.5) * spread * GRID.pitch * 1.6;
    return place(rock(Math.floor(r() * 1e6)), c.X(x), c.ground(x, y) - 0.01, c.Z(y), r() * 6, c.s * size * (0.5 + r()));
  });
}

const CONCRETE = [hex(0xa9a59b), hex(0x8b877f), hex(0x6d6a64)];
const WOOD = hex(0x7a5430), WOOD_DARK = hex(0x4c3420);

// ------------------------------------------------------------------------------- the wall

function wall(c: Ctx): THREE.Object3D[] {
  const K = LOOK.wall, r = rng(c.seed), s = c.s, H = K.height * s;
  const x0 = c.X(finishPx(K.at)), x1 = c.X(FINISH_CUT), z0 = c.Z(ROWS0) - 0.35 * s, z1 = c.Z(ROWS1) + 0.35 * s;
  const th = x1 - x0, L = z1 - z0;
  // The slab: poured concrete in lifts, its top broken.
  const slab = new THREE.BoxGeometry(th, H, L, 2, 7, 44).translate(x0 + th / 2, H / 2, (z0 + z1) / 2);
  const pos = slab.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < H * 0.99) continue;
    const z = pos.getZ(i);
    pos.setY(i, H - Math.max(0, lump(z / s * 1.3, 0.4, pos.getX(i) / s, c.seed) - 0.35) * 0.3 * s);
  }
  const parts: THREE.BufferGeometry[] = [paint(slab, p => {
    const lift = 0.5 + 0.5 * Math.sin(p.y / H * 19 + lump(p.z / s, 0, 0, c.seed) * 0.6);
    const stain = Math.max(0, lump(p.z / s * 0.9, p.y / s * 0.5, 2, c.seed + 3));
    return dim(mix(mix(CONCRETE[0], CONCRETE[1], lift * 0.5), CONCRETE[2], stain * 0.45 + (p.y < H * 0.12 ? 0.3 : 0)), 0.9 + 0.2 * r());
  })];
  // Piers against it, rubble at its foot, a ladder left leaning, what is left of a shack.
  for (let z = z0 + 0.6 * s; z < z1; z += 1.55 * s) parts.push(place(box(0.1 * s, H * 0.94, 0.26 * s, CONCRETE[1], r), x0 - 0.03 * s, 0, z));
  parts.push(...rubble(c, r, finishPx(K.at) - 28, ROAD_MID - 150, 9, 0.07, 0.5), ...rubble(c, r, finishPx(K.at) - 30, ROAD_MID + 260, 7, 0.06, 0.4));
  const lz = c.Z(GRID.y0 + 0.2 * GRID.rowPitch), lean = 0.34, len = H * 0.92;
  for (const dz of [-0.12, 0.12]) parts.push(place(box(0.035 * s, len, 0.035 * s, WOOD, r), x0 - Math.sin(lean) * len - 0.02 * s, 0, lz + dz * s, 0, 1, 0, -lean));
  for (let i = 1; i < 7; i++) {
    const t = i / 7;
    parts.push(place(box(0.028 * s, 0.028 * s, 0.26 * s, WOOD_DARK, r), x0 - Math.sin(lean) * len * (1 - t) - 0.02 * s, Math.cos(lean) * len * t, lz));
  }
  const hz = c.Z(GRID.y0 + 4.1 * GRID.rowPitch), hx = x0 - 0.2 * s;
  parts.push(place(box(0.26 * s, 0.2 * s, 0.34 * s, WOOD, r), hx, 0, hz, 0.3), place(box(0.3 * s, 0.025 * s, 0.4 * s, hex(0x6a4a3a), r), hx - 0.02 * s, 0.2 * s, hz, 0.3, 1, 0, 0.22));
  parts.push(place(box(0.03 * s, 0.34 * s, 0.03 * s, WOOD_DARK, r), hx + 0.1 * s, 0, hz + 0.24 * s, 0, 1, 0.3, 0.2));

  // Painted on its face: the target, its drips, cracks, and the warning.
  const W = 2048, Hc = Math.round(W * H / L);
  const paintTex = canvasTexture(W, Hc, g => {
    const u = (z: number): number => (z - z0) / L * W;
    g.strokeStyle = 'rgba(40,36,34,0.55)'; g.lineWidth = 3;
    for (let i = 0; i < 16; i++) {
      let x = r() * W, y = r() * Hc * 0.4;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 90; y += r() * Hc * 0.2; g.lineTo(x, y); }
      g.stroke();
    }
    const cx = u(c.Z(ROAD_MID)), cy = Hc * 0.52, R = K.target * Hc / 2;
    g.strokeStyle = '#c0181c'; g.fillStyle = '#c0181c'; g.lineCap = 'round';
    for (const k of [1, 0.62, 0.26]) {
      g.lineWidth = R * 0.17; g.beginPath(); g.arc(cx, cy, R * k, 0, Math.PI * 2);
      if (k < 0.3) g.fill(); else g.stroke();
      for (let d = 0; d < 7; d++) { const a = 0.25 + r() * 2.6, x = cx + Math.cos(a) * R * k; g.fillRect(x, cy + Math.sin(a) * R * k, 5 + r() * 7, 30 + r() * Hc * 0.3); }
    }
    g.save(); g.translate(u(c.Z(GRID.y0 + 4.9 * GRID.rowPitch)), Hc * 0.42); g.rotate(-0.07);
    g.font = `italic 900 ${Math.round(Hc * 0.17)}px "Arial Narrow", Impact, sans-serif`; g.textAlign = 'center';
    g.fillText('THERE IS NO', 0, 0); g.fillText('ESCAPE!!', 14, Hc * 0.2);
    g.restore();
  });
  const face = sheet(L, H, new THREE.MeshStandardMaterial({ map: paintTex, transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  face.position.set(x0 - 0.002, 0, (z0 + z1) / 2);
  return [body(parts), face];
}

// ------------------------------------------------------------------------------- the cliff

/** A surface of `nu` x `nv` quads through the points `at(u, v)` (u, v from 0 to 1). */
function surface(nu: number, nv: number, at: (u: number, v: number) => [number, number, number]): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.push(...at(i / nu, j / nv));
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, d = a + nu + 1, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

const STRATA = [hex(0xc49258), hex(0x8f5a3c), hex(0x6a3f30), hex(0x3a2420), hex(0x140d0c)];
/** The colour of a canyon wall at depth t (0 the rim, 1 the bottom). */
function strata(t: number, wobble: number, dark: number): Rgb {
  const k = Math.min(3.999, Math.max(0, t * 4 + wobble * 0.35)), i = Math.floor(k);
  const band = 0.82 + 0.18 * Math.sin(t * 46 + wobble * 2);
  return dim(mix(STRATA[i], STRATA[i + 1], k - i), band * dark);
}

function cliff(c: Ctx): THREE.Object3D[] {
  const K = LOOK.cliff, r = rng(c.seed), s = c.s, D = K.depth * s;
  const pad = K.run * GRID.pitch, y0 = ROWS0 - pad, y1 = ROWS1 + pad, wide = K.width * GRID.pitch;
  const N = 110, py = (u: number): number => y0 + (y1 - y0) * u;
  // A fissure: widest by the road, closing to a point past the piece at both ends.
  const open = (y: number): number => Math.min(1, Math.max(0, Math.min(y - y0, y1 - y) / pad)) ** 0.7;
  const mid = FINISH_CUT + wide * 0.3;
  const edge = (y: number): number => { const k = open(y); return mid + (finishGroundEnd(c.line, y) - mid) * k; };
  const farAt = (y: number): number => mid + (FINISH_CUT + wide * (1 + 0.16 * lump(y / 210, 2.3, 0.7, c.seed + 11)) - mid) * open(y);
  // The opening the canyon shows through (as the pit trap's: terrain/pit3d.ts).
  const rim = Array.from({ length: N + 1 }, (_, i) => new THREE.Vector2(c.X(edge(py(i / N))), -c.Z(py(i / N))));
  const hole = new THREE.ShapeGeometry(new THREE.Shape([...rim, ...Array.from({ length: N + 1 }, (_, i) => new THREE.Vector2(c.X(farAt(py(1 - i / N))), -c.Z(py(1 - i / N))))])).rotateX(-Math.PI / 2);
  const [mark, clear] = maskMaterials();
  const m1 = new THREE.Mesh(hole, mark), m2 = new THREE.Mesh(hole, clear);
  m1.renderOrder = 10; m2.renderOrder = 11;
  m1.position.y = m2.position.y = 0.0005;

  // Inside: the wall under the edge, the far wall, the two ends, all in strata going dark.
  const walls = [
    paint(surface(N, 14, (u, v) => {
      const n = lump(u * 9, v * 5, 0.5, c.seed);
      return [c.X(edge(py(u))) + (0.34 * v + 0.07 * n * v) * s, 0.02 - D * v, c.Z(py(u)) + 0.03 * n * s];
    }), p => strata(-p.y / D, lump(p.z / s, p.y / s, 0, c.seed), 1)),
    paint(surface(N, 12, (u, v) => [c.X(farAt(py(u))) - (0.3 * v + 0.06 * lump(u * 9, v * 4, 2, c.seed) * v) * s, 0.02 - D * v, c.Z(py(u))]), p => strata(-p.y / D, lump(p.z / s, p.y / s, 3, c.seed), 0.62)),
  ];
  const inside = new THREE.Mesh(mergeGeometries(walls), Object.assign(solid(), { transparent: true, side: THREE.DoubleSide }));
  inside.renderOrder = 12;
  // The river at the bottom: bright, with white water where it runs against the rock.
  const BLUE = hex(0x1f8fe0), DEEP = hex(0x0b4f9e), FOAM = hex(0xe8f6ff);
  const water = paint(surface(N * 2, 26, (u, v) => {
    const xa = c.X(edge(py(u))) + 0.3 * s, xb = c.X(farAt(py(u))) - 0.26 * s;
    return [xa + (xb - xa) * v, -D + 0.01, c.Z(py(u))];
  }), p => {
    // Streaks of white water running with the stream, more of it against the rock under the edge.
    const flow = lump(p.x / s * 5, 0.4, p.z / s * 0.9 + p.x / s * 0.6, c.seed + 9) + 0.5 * lump(p.x / s * 11, 1.2, p.z / s * 2.3, c.seed + 4);
    const off = (p.x - c.X(FINISH_CUT)) / (K.width * s);
    const foam = Math.max(0, flow - 0.55) * 1.8 + Math.max(0, 0.1 - Math.abs(off + 0.1)) * 5 * (0.5 + 0.5 * lump(p.z / s * 3, 0, 0, c.seed));
    return mix(mix(BLUE, DEEP, Math.min(1, Math.max(0, off * 0.9 + 0.15))), FOAM, Math.min(1, foam));
  });
  const river = new THREE.Mesh(water, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide }));
  river.renderOrder = 12;

  // Around it: the rocks of the far side and of the two ends, standing on the table, and the broken ground at the edge.
  const rocks: THREE.BufferGeometry[] = [];
  for (let i = 0; i <= 40; i++) {
    const y = py((i + r() * 0.7) / 41), k = open(y);
    rocks.push(place(rock(Math.floor(r() * 1e6), r() < 0.4 ? 0.7 : undefined), c.X(farAt(y)) + (0.08 + r() * 0.3) * s, c.table, c.Z(y), r() * 6, s * K.rim * (0.35 + 0.65 * k) * (0.6 + r() * 0.8)));
  }
  // The near side, past the piece: smaller rocks along the lip, on the table.
  for (let i = 0; i < 26; i++) {
    const y = r() < 0.5 ? y0 + r() * pad : y1 - r() * pad;
    rocks.push(place(rock(Math.floor(r() * 1e6)), c.X(edge(y)) - (0.05 + r() * 0.2) * s, c.table, c.Z(y), r() * 6, s * K.rim * (0.25 + r() * 0.5)));
  }
  for (let i = 0; i < 16; i++) {
    const y = ROWS0 + r() * (ROWS1 - ROWS0), x = edge(y) - 6 - r() * 26;
    rocks.push(place(rock(Math.floor(r() * 1e6)), c.X(x), c.ground(x, y) - 0.01, c.Z(y), r() * 6, s * (0.03 + r() * 0.05)));
  }
  return [m1, m2, inside, river, body(rocks)];
}

// ------------------------------------------------------------------------------- the grid

const glowing = (map: THREE.Texture): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });

function grid(c: Ctx): THREE.Object3D[] {
  const K = LOOK.grid, r = rng(c.seed), s = c.s, H = K.height * s;
  const z0 = c.Z(ROWS0) + 0.12 * s, z1 = c.Z(ROWS1) - 0.12 * s, L = z1 - z0;
  // The lattice: beams with a white core and a red halo, brighter where they cross.
  const W = 2048, Hc = Math.round(W * H / L), cell = K.cell * s / L * W;
  const lattice = canvasTexture(W, Hc, g => {
    g.globalCompositeOperation = 'lighter';
    for (const [width, colour] of [[cell * 0.5, 'rgba(255,40,10,0.14)'], [cell * 0.2, 'rgba(255,80,30,0.4)']] as [number, string][]) {
      g.strokeStyle = colour; g.lineWidth = width;
      g.beginPath();
      for (let x = cell / 2; x < W; x += cell) { g.moveTo(x, 0); g.lineTo(x, Hc); }
      for (let y = Hc - cell / 2; y > 0; y -= cell) { g.moveTo(0, y); g.lineTo(W, y); }
      g.stroke();
    }
    for (let x = cell / 2; x < W; x += cell) for (let y = Hc - cell / 2; y > 0; y -= cell) {
      const halo = g.createRadialGradient(x, y, 0, x, y, cell * 0.3);
      halo.addColorStop(0, 'rgba(255,245,225,0.9)'); halo.addColorStop(1, 'rgba(255,90,40,0)');
      g.fillStyle = halo; g.fillRect(x - cell * 0.3, y - cell * 0.3, cell * 0.6, cell * 0.6);
    }
  });
  const out: THREE.Object3D[] = [];
  const xs = Array.from({ length: K.planes }, (_, i) => c.X(finishPx(K.at + i * K.gap)));
  // The beams themselves are bars of light, read from any side; the sheet is their halo.
  const bars: THREE.BufferGeometry[] = [], cellW = K.cell * s, t = K.beam * s;
  for (const x of xs) {
    for (let y = cellW / 2; y < H; y += cellW) bars.push(new THREE.BoxGeometry(t, t, L).translate(x, 0.05 * s + y, (z0 + z1) / 2));
    for (let z = z0 + cellW / 2; z < z1; z += cellW) bars.push(new THREE.BoxGeometry(t, H, t).translate(x, 0.05 * s + H / 2, z));
    const m = sheet(L, H, glowing(lattice));
    m.position.set(x, 0.05 * s, (z0 + z1) / 2);
    m.renderOrder = 3;
    out.push(m);
  }
  out.push(new THREE.Mesh(mergeGeometries(bars), new THREE.MeshBasicMaterial({ color: 0xffd2a8, toneMapped: false })));
  // Their light on the ground.
  const spill = canvasTexture(64, 8, g => {
    const k = g.createLinearGradient(0, 0, 64, 0);
    k.addColorStop(0, 'rgba(255,70,20,0)'); k.addColorStop(0.5, 'rgba(255,110,50,0.5)'); k.addColorStop(1, 'rgba(255,70,20,0)');
    g.fillStyle = k; g.fillRect(0, 0, 64, 8);
  });
  const xa = xs[0] - 0.3 * s, xb = xs[xs.length - 1] + 0.12 * s;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa, L).rotateX(-Math.PI / 2), glowing(spill));
  floor.position.set((xa + xb) / 2, c.ground(finishPx(K.at), ROAD_MID) + 0.012, (z0 + z1) / 2);
  floor.renderOrder = 2;
  out.push(floor);
  // The emitters at the two ends: dark slabs with a strip of light.
  const METAL = hex(0x3b3a40), parts: THREE.BufferGeometry[] = [], strips: THREE.BufferGeometry[] = [];
  for (const [z, side] of [[z0 - 0.13 * s, 1], [z1 + 0.13 * s, -1]] as [number, number][]) {
    const w = xs[xs.length - 1] - xs[0] + 0.22 * s, x = (xs[0] + xs[xs.length - 1]) / 2;
    parts.push(place(box(w, H + 0.2 * s, 0.24 * s, METAL, r), x, 0, z), place(box(w + 0.1 * s, 0.1 * s, 0.34 * s, hex(0x26252a), r), x, 0, z));
    for (const px of xs) strips.push(new THREE.BoxGeometry(0.035 * s, H, 0.02 * s).translate(px, H / 2 + 0.05 * s, z + side * 0.125 * s));
  }
  parts.push(...rubble(c, r, finishPx(K.at) - 40, ROAD_MID + 330, 6, 0.05, 0.4));
  const strip = new THREE.Mesh(mergeGeometries(strips), new THREE.MeshBasicMaterial({ color: 0xff5a2a, toneMapped: false }));
  return [...out, body(parts), strip];
}

// ------------------------------------------------------------------------------- the dome

function dome(c: Ctx): THREE.Object3D[] {
  const K = LOOK.dome, r = rng(c.seed), s = c.s, R = K.radius * s, Hd = K.height * s;
  const x0 = c.X(finishPx(K.at)), za = c.Z(ROWS0) - K.wings * s, zb = c.Z(ROWS1) + K.wings * s;
  // Past the road's rows it turns back, as the round thing it is: straight where the spaces are.
  const turn = (z: number): number => { const d = Math.min(K.wings * s * 0.999, Math.max(0, c.Z(ROWS0) - z, z - c.Z(ROWS1))), q = K.wings * s; return q - Math.sqrt(q * q - d * d); };
  // The shell: a piece of a great sphere leaning back over the road, fading as it climbs.
  const shell = surface(64, 18, (u, v) => {
    const h = Hd * v, z = za + (zb - za) * u;
    return [x0 - R + Math.sqrt(R * R - h * h) - turn(z) * 0.8, h, z];
  });
  const uv: number[] = [];
  for (let j = 0; j <= 18; j++) for (let i = 0; i <= 64; i++) uv.push(i / 64, j / 18);
  shell.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const W = 2048, Hc = 768;
  const glass = canvasTexture(W, Hc, g => {
    const up = g.createLinearGradient(0, Hc, 0, 0);
    up.addColorStop(0, `rgba(96,205,120,${K.opacity})`); up.addColorStop(0.03, `rgba(205,255,215,${Math.min(1, K.opacity * 1.5)})`); up.addColorStop(0.07, `rgba(96,205,120,${K.opacity})`); up.addColorStop(0.6, `rgba(120,220,150,${K.opacity * 0.55})`); up.addColorStop(1, 'rgba(150,235,180,0)');
    g.fillStyle = up; g.fillRect(0, 0, W, Hc);
    // The shimmer of the thing: cells of light, and clouds caught in it.
    g.strokeStyle = 'rgba(225,255,225,0.34)'; g.lineWidth = 2.5;
    const q = 46;
    for (let row = 0; row * q * 0.87 < Hc; row++) for (let col = -1; col * q < W; col++) {
      const x = col * q + (row % 2 ? q / 2 : 0), y = Hc - row * q * 0.87;
      g.globalAlpha = Math.max(0, 1 - row * q * 0.87 / (Hc * 0.8));
      g.beginPath();
      for (let k = 0; k <= 6; k++) g.lineTo(x + Math.cos(k * Math.PI / 3 + Math.PI / 6) * q * 0.56, y + Math.sin(k * Math.PI / 3 + Math.PI / 6) * q * 0.56);
      g.stroke();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 40; i++) {
      const x = r() * W, y = Hc * (0.35 + r() * 0.65), rad = 40 + r() * 120;
      const k = g.createRadialGradient(x, y, 0, x, y, rad);
      k.addColorStop(0, 'rgba(230,255,215,0.16)'); k.addColorStop(1, 'rgba(230,255,215,0)');
      g.fillStyle = k; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // Written on it from inside.
    g.save(); g.translate(W * 0.36, Hc * 0.72); g.rotate(-0.05);
    g.fillStyle = 'rgba(24,84,74,0.85)'; g.font = `italic 900 ${Math.round(Hc * 0.085)}px "Arial Narrow", Impact, sans-serif`; g.textAlign = 'center';
    g.fillText('BEWARE THE', 0, 0); g.fillText('FIRMAMENT', 10, Hc * 0.1);
    g.restore();
    // It fades at its two ends.
    g.globalCompositeOperation = 'destination-out';
    for (const [a, b] of [[0, W * 0.07], [W, W * 0.93]]) {
      const k = g.createLinearGradient(a, 0, b, 0);
      k.addColorStop(0, 'rgba(0,0,0,1)'); k.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = k; g.fillRect(Math.min(a, b), 0, Math.abs(b - a), Hc);
    }
  });
  const shellMesh = new THREE.Mesh(shell, new THREE.MeshBasicMaterial({ map: glass, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  shellMesh.renderOrder = 3;
  // Outside it the land is green: grass and flowers, a hair above the piece's own ground.
  const xb = c.X(FINISH_CUT), ga = c.Z(ROWS0), gb = c.Z(ROWS1);
  const GRASS = [hex(0x4f9a3a), hex(0x6fb648), hex(0x3a7a30)], FLOWER = [hex(0xf4f0d8), hex(0xf2c94a), hex(0xe86a8a)];
  const turf = new THREE.PlaneGeometry(xb - x0, gb - ga, 7, 90).rotateX(-Math.PI / 2).translate((x0 + xb) / 2, 0, (ga + gb) / 2);
  const tp = turf.getAttribute('position'), gy = c.ground(finishPx(K.at) + 20, ROWS0 + 60);
  for (let i = 0; i < tp.count; i++) tp.setY(i, gy + 0.012 + (0.5 + 0.5 * lump(tp.getX(i) / s * 5, 0, tp.getZ(i) / s * 5, c.seed)) * 0.035 * s);
  const parts: THREE.BufferGeometry[] = [paint(turf, () => (r() < 0.012 ? FLOWER[Math.floor(r() * 3)] : dim(mix(GRASS[0], GRASS[r() < 0.5 ? 1 : 2], r() * 0.6), 0.9 + 0.18 * r())))];
  // Where it cuts the road: the asphalt broken against it.
  parts.push(...rubble(c, r, finishPx(K.at) - 16, ROAD_MID - 60, 10, 0.05, 0.3), ...rubble(c, r, finishPx(K.at) - 14, ROAD_MID + 240, 6, 0.045, 0.25));
  // A line of light where it meets the ground.
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.02 * s, 0.012 * s, c.Z(ROWS1) - c.Z(ROWS0)).translate(x0, gy + 0.02, (c.Z(ROWS0) + c.Z(ROWS1)) / 2), new THREE.MeshBasicMaterial({ color: 0xc8ffd0, transparent: true, opacity: 0.7, toneMapped: false }));
  return [body(parts, false), foot, shellMesh];
}

// ------------------------------------------------------------------------------- the piece

export interface FinishFeatureOptions {
  /** World size of a tile's frame, and how thick a tile is (the table lies that far below). */
  width: number; depth: number; thickness: number;
  /** Height of the piece's ground above its cardboard top at a frame pixel. */
  ground: (px: number, py: number) => number;
}

/**
 * What stands on a finish line, in a tile's frame (the piece lies where the next tile would), with
 * y = 0 on the piece's cardboard top.
 * Example: `group.add(buildFinishFeature(FINISH_LINES[1], { width, depth, thickness, ground }))`.
 */
export function buildFinishFeature(line: FinishLine, o: FinishFeatureOptions): THREE.Group {
  const kx = o.width / GRID.frameW, kz = o.depth / GRID.frameH;
  const c: Ctx = {
    X: px => (px - GRID.frameW / 2) * kx, Z: py => (py - GRID.frameH / 2) * kz,
    s: GRID.pitch * kx, seed: seedOf(line.id), ground: o.ground, table: -o.thickness, line,
  };
  const group = new THREE.Group();
  group.name = `finish-${line.kind}`;
  group.add(...{ cliff, wall, grid, dome }[line.kind](c));
  return group;
}
