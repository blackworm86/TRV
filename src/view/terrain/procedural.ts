// Procedural terrain of a road tile face, made only from its grid in data/trv/game_base.json (no
// licensed art): asphalt with cracks and tyre marks, sand dunes with ripples and desert plants, mud
// pools, red rock on impassable spaces inside a hazard-tape frame, the printed grid lines and the
// hazard triangles. The result is the same set of maps the official-art relief uses (colour, height,
// roughness, outline; normals from the height), so board3d draws both the same way.
//
// Everything is deterministic: the same face, player count and seed give the same maps. Pure
// TypeScript on typed arrays, no DOM and no three.js, so it runs in unit tests and in a worker.

import { GRID, spaceCenterPx, type TileData } from '../tile-grid';
import { fnv1a } from '../../core/hash';

type Rgb = [number, number, number];
/**
 * R road, o off-road, M mud, X impassable; Carnage at Devil's Run: G toxic goo, D desert glass, P ramp,
 * F fire, S salt flats; O: an oil slick on asphalt (a revealed Oil Slick hazard, drawn on the space).
 */
type Kind = 'R' | 'o' | 'M' | 'X' | 'G' | 'D' | 'P' | 'F' | 'S' | 'O';

/** Look of the procedural terrain. Heights in height units: -1 is the tile's cardboard top. */
export interface TerrainStyle {
  height: Record<Kind, number>;
  /** How far (frame px) the border between two terrains wanders from the space outline. */
  warp: number;
  asphalt: [Rgb, Rgb]; crack: Rgb;
  sand: [Rgb, Rgb];
  mud: [Rgb, Rgb]; mudGlint: Rgb;
  rock: [Rgb, Rgb, Rgb];
  /** Carnage at Devil's Run: toxic goo (two greens and its bubbles), desert glass (two blues, glint), salt crust and its cracks, scorched ground and embers. */
  goo: [Rgb, Rgb]; gooBubble: Rgb;
  glass: [Rgb, Rgb]; glassGlint: Rgb;
  salt: [Rgb, Rgb]; saltCrack: Rgb;
  scorch: [Rgb, Rgb]; ash: Rgb; ember: Rgb;
  /** Oil slick: the dark oil and the rainbow sheen on it. */
  oil: Rgb; sheen: [Rgb, Rgb, Rgb];
  plant: [Rgb, Rgb];
  line: Rgb; tape: [Rgb, Rgb]; hazard: Rgb;
  rough: Record<Kind, number>;
  /** Desert plants per off-road space (average). */
  plants: number;
}

/** Default look, sampled from the colours of the printed tiles. */
export const TERRAIN_STYLE: TerrainStyle = {
  height: { R: 0, o: 1, M: -0.85, X: 0.45, G: -0.6, D: 0.15, P: 0.7, F: 0.25, S: 0.2, O: 0 },
  warp: 22,
  asphalt: [[84, 85, 88], [124, 121, 120]], crack: [44, 43, 45],
  sand: [[251, 198, 138], [228, 166, 106]],
  mud: [[58, 40, 27], [104, 74, 46]], mudGlint: [146, 130, 108],
  rock: [[160, 86, 80], [190, 120, 96], [92, 55, 52]],
  goo: [[134, 214, 58], [74, 160, 40]], gooBubble: [206, 246, 140],
  glass: [[176, 222, 232], [118, 182, 206]], glassGlint: [244, 252, 255],
  salt: [[244, 240, 230], [226, 220, 206]], saltCrack: [176, 164, 146],
  scorch: [[18, 15, 14], [46, 36, 31]], ash: [128, 122, 116], ember: [255, 104, 24],
  oil: [16, 15, 18], sheen: [[90, 40, 140], [30, 120, 150], [150, 130, 40]],
  plant: [[112, 138, 118], [62, 84, 70]],
  line: [246, 196, 62], tape: [[246, 196, 62], [28, 24, 22]], hazard: [214, 22, 28],
  rough: { R: 0.86, o: 0.97, M: 0.55, X: 0.82, G: 0.18, D: 0.08, P: 0.95, F: 0.9, S: 0.93, O: 0.86 },
  plants: 0.6,
};

/** Range of the height maps (height units): the cardboard top up to the highest rock. */
export const H_MIN = -1, H_MAX = 4;

/** Maps of one face, `w` x `h` pixels covering the 2000 x 1522 tile frame, row 0 at frame y = 0. */
export interface ProceduralMaps {
  w: number; h: number;
  /** Ground height per pixel, in height units (H_MIN .. H_MAX). */
  height: Float32Array;
  /** Colour, RGBA. */
  albedo: Uint8ClampedArray;
  /** Roughness, 0..255 per pixel. */
  rough: Uint8ClampedArray;
  /** 255 on the tile's spaces, 0 outside its cut edge. */
  mask: Uint8ClampedArray;
  /** Light given off (embers in burnt ground), 0..255 per pixel; only on faces with fire. */
  glow?: Uint8ClampedArray;
  /**
   * The information layer, apart from the terrain: grid lines, the tape around impassable spaces and
   * the hazard triangles, RGBA on a transparent ground, at its own (finer) size.
   */
  info: { w: number; h: number; data: Uint8ClampedArray };
}

export interface ProceduralOptions {
  /** Width of the information layer in pixels. Default: twice the map width. */
  infoWidth?: number;
  /** Hazard spaces not used at this player count are printed faint. */
  players?: number;
  /** Variation seed; default: from the face's name, so every face has its own look. */
  seed?: number;
  /** Map width in pixels (height follows the frame's aspect). Default 1000. */
  width?: number;
  style?: TerrainStyle;
}

// ------------------------------------------------------------------------------- noise

function hash(i: number, j: number, s: number): number {
  let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) & 0xffff) / 32767.5 - 1;
}

/** Smooth value noise, -1..1. */
function vnoise(x: number, y: number, s: number): number {
  const i = Math.floor(x), j = Math.floor(y);
  let u = x - i, v = y - j;
  u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
  const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a + (d - c - b + a) * u) * v;
}

/** Fractal noise, about -1..1. */
function fbm(x: number, y: number, s: number, oct = 3): number {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let k = 0; k < oct; k++) {
    sum += amp * vnoise(x * f, y * f, s + k * 101);
    norm += amp; amp *= 0.5; f *= 2.03;
  }
  return sum / norm;
}

/** Ridged noise, 0..1, sharp crests: rock. */
function ridged(x: number, y: number, s: number, oct = 3): number {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let k = 0; k < oct; k++) {
    const n = 1 - Math.abs(vnoise(x * f, y * f, s + k * 131));
    sum += amp * n * n;
    norm += amp; amp *= 0.5; f *= 2.1;
  }
  return sum / norm;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

// ------------------------------------------------------------------------------- space lookup

/** The space under a frame point, with the point's place in it. */
export interface Cell {
  r: number; c: number; cx: number; cy: number;
  /** 0 at the space centre, 1 on its outline (the chevron scale the point lies on). */
  s: number;
  /** Rough distance to the outline, frame px. */
  edge: number;
}

/** Space (row, column) of the tile under frame point (x, y), or null outside the tile's spaces. */
export function cellAt(x: number, y: number): Cell | null {
  const { rowPitch, pitch, tip: t } = GRID;
  const hh = rowPitch / 2, hw = pitch / 2;
  const r = Math.floor((y - (GRID.y0 - hh)) / rowPitch);
  if (r < 0 || r >= GRID.rows) return null;
  const cy = GRID.y0 + rowPitch * r, dy = Math.abs(y - cy);
  const x0 = r % 2 ? GRID.x0Odd : GRID.x0Even;
  const c = Math.floor((x - (x0 - hw) - t * (1 - dy / hh)) / pitch);
  if (c < 0 || c >= GRID.cols) return null;
  const cx = x0 + pitch * c;
  const u = x - cx + t * dy / hh;
  const s = Math.max(dy / hh, u >= 0 ? u / (hw + t) : -u / (hw - t));
  const edge = Math.min(hh - dy, (u >= 0 ? hw + t - u : u + hw - t) * 0.95);
  return { r, c, cx, cy, s, edge };
}

/** Kind of the space just beyond the outline of `c`, seen from its centre through frame point (fx, fy). */
function beyondOutline(c: Cell, fx: number, fy: number, kindAt: (r: number, c: number) => Kind): Kind {
  const k = 1.08 / Math.max(c.s, 0.01);
  const out = cellAt(c.cx + (fx - c.cx) * k, c.cy + (fy - c.cy) * k);
  return out ? kindAt(out.r, out.c) : 'o';
}

// ------------------------------------------------------------------------------- image helpers

/** Separable box blur, `passes` times (about a Gaussian). */
function blur(a: Float32Array, w: number, h: number, r: number, passes = 2): Float32Array {
  let src = a;
  const tmp = new Float32Array(a.length);
  const k = 1 / (2 * r + 1);
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(a.length);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc * k;
        acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc * k;
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    src = out;
  }
  return src;
}

/** Distance (pixels, city-block) from each tile pixel to the outside. */
function distanceInside(mask: Uint8ClampedArray, w: number, h: number): Float32Array {
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 1e6 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (d[i]) d[i] = Math.min(d[i], x ? d[i - 1] + 1 : 1, y ? d[i - w] + 1 : 1);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (d[i]) d[i] = Math.min(d[i], x < w - 1 ? d[i + 1] + 1 : 1, y < h - 1 ? d[i + w] + 1 : 1);
  }
  return d;
}


const seedOf = (text: string): number => fnv1a(text) % 100000;

// ------------------------------------------------------------------------------- generator

const KINDS: Kind[] = ['R', 'o', 'M', 'X', 'G', 'D', 'P', 'F', 'S', 'O'];

/**
 * Builds the procedural maps of one tile face.
 * Example: `const m = proceduralTerrain(rules.tiles[0], { players: 3 })`.
 */
export function proceduralTerrain(tile: TileData, opt: ProceduralOptions = {}): ProceduralMaps {
  const st = opt.style ?? TERRAIN_STYLE;
  const seed = opt.seed ?? seedOf(`${tile.tile ?? ''}${tile.side ?? ''}${tile.name}`);
  const w = opt.width ?? 1000;
  const h = Math.round(w * GRID.frameH / GRID.frameW);
  const n = w * h;
  const px = GRID.frameW / w; // frame px per map px
  // An unknown terrain code is drawn as road.
  const kindAt = (r: number, c: number): Kind => { const k = tile.terrain[r]?.[c] ?? 'o'; return (KINDS.includes(k as Kind) ? k : 'R') as Kind; };

  // 1. Terrain kind per pixel: the space's kind, with borders between terrains wandering a little
  //    (warped lookup). Impassable spaces keep their exact outline; outside their tape frame the
  //    ground is the neighbouring terrain.
  const kind = new Uint8Array(n); // 0 outside, 1 + index in KINDS
  const mask = new Uint8ClampedArray(n);
  for (let j = 0; j < h; j++) {
    const fy = (j + 0.5) * px;
    for (let i = 0; i < w; i++) {
      const fx = (i + 0.5) * px;
      const c0 = cellAt(fx, fy);
      if (!c0) continue;
      const p = j * w + i;
      mask[p] = 255;
      const k0 = kindAt(c0.r, c0.c);
      let k: Kind;
      if (k0 === 'X') {
        // Next to another impassable space the rock runs on; elsewhere the tape frame and, outside
        // it, the neighbouring ground.
        const kn = c0.s < 0.78 ? 'X' : beyondOutline(c0, fx, fy, kindAt);
        k = kn === 'X' || c0.s < 0.78 ? 'X' : kn;
      } else {
        const wx = fx + st.warp * fbm(fx / 110, fy / 110, seed + 1, 3);
        const wy = fy + st.warp * fbm(fx / 110, fy / 110, seed + 2, 3);
        const c1 = cellAt(wx, wy);
        const k1 = c1 ? kindAt(c1.r, c1.c) : k0;
        k = k1 === 'X' ? k0 : k1;
      }
      kind[p] = 1 + KINDS.indexOf(k);
    }
  }

  // 2. Soft weights of each terrain (for blending colour and relief).
  const ind = KINDS.map((_, q) => {
    const a = new Float32Array(n);
    for (let p = 0; p < n; p++) a[p] = kind[p] === q + 1 ? 1 : 0;
    return a;
  });
  // A terrain the face does not have keeps its all-zero weights (no blur: most faces use few kinds).
  const present = ind.map(a => a.some(v => v > 0));
  const wSoft = ind.map((a, q) => (present[q] ? blur(a, w, h, q === 3 ? 1 : 2, 2) : a)); // colour blend
  const wWide = ind.map((a, q) => (present[q] ? blur(a, w, h, q === 3 ? 2 : 6, 2) : a)); // relief blend

  // 3. Height: ground (sand, asphalt, mud) blends softly; rock rises steeply over it.
  const height = new Float32Array(n);
  const [wR0, wO, wM, wX, wG, wD, wP, wF, wS, wOil] = wWide;
  // Oil lies on asphalt: for the relief an oil space is road.
  const wR = wR0.map((v, i) => v + wOil[i]);
  // Rock rises from its edge to a rough top: distance (map px) into the impassable area.
  const isX = new Uint8ClampedArray(n);
  for (let p = 0; p < n; p++) isX[p] = kind[p] === 4 ? 255 : 0;
  const dX = distanceInside(isX, w, h);
  const rim = 14 / px; // rock reaches full height 14 frame px inside its edge
  for (let j = 0; j < h; j++) {
    const fy = (j + 0.5) * px;
    for (let i = 0; i < w; i++) {
      const p = j * w + i;
      if (!mask[p]) continue;
      const fx = (i + 0.5) * px;
      const g = wR[p] + wO[p] + wM[p] + wG[p] + wD[p] + wP[p] + wF[p] + wS[p] || 1;
      let hg = (wR[p] * st.height.R + wO[p] * st.height.o + wM[p] * st.height.M + wG[p] * st.height.G + wD[p] * st.height.D
        + wP[p] * st.height.P + wF[p] * st.height.F + wS[p] * st.height.S) / g;
      // Ramp ground: packed sand. Goo: a few bubbles. Salt: the crust's raised polygon rims. Fire: scorched, cracked.
      hg += wP[p] / g * 0.12 * fbm(fx / 60, fy / 60, seed + 3);
      if (wG[p] > 0) hg += wG[p] / g * (0.14 * bubble(fx, fy, seed) + 0.05 * gooSkin(fx, fy, seed));
      if (wS[p] > 0) { plates(fx, fy, 64, seed + 90); hg += wS[p] / g * (0.1 * PL.rim - 0.06 * saltBrine(fx, fy, seed) - 0.05 * sandRut(fx, fy, seed + 5)); }
      if (wF[p] > 0) { plates(fx, fy, 46, seed + 71); hg += wF[p] / g * (0.1 * fbm(fx / 30, fy / 30, seed + 70) - 0.1 * PL.rim + 0.14 * pebble(fx, fy, seed + 200)); }
      // Glass: each shard lies tilted its own way, with a groove where two meet.
      if (wD[p] > 0) { plates(fx, fy, 58, seed + 85); const turn = PL.id * 6.283; hg += wD[p] / g * (0.24 * (PL.dx * Math.cos(turn) + PL.dy * Math.sin(turn)) + 0.1 * (PL.id - 0.5) - 0.14 * PL.rim); }
      if (wO[p] > 0) {
        // Sand: dunes and ripples, flatter where the ground is dry and hard; stones stand on it, ruts cut it.
        const hard = hardpan(fx, fy, seed);
        hg += wO[p] / g * ((1 - 0.65 * hard) * (0.38 * fbm(fx / 150, fy / 150, seed + 3) + 0.14 * fbm(fx / 45, fy / 45, seed + 4)
          + 0.025 * Math.sin((fx * 0.35 + fy * 0.94) / 5 + 5 * fbm(fx / 60, fy / 60, seed + 5)))
          + 0.16 * pebble(fx, fy, seed) - 0.09 * sandRut(fx, fy, seed) - 0.05 * hard * saltRim(fx * 0.8, fy * 0.8, seed + 7));
      }
      if (wM[p] > 0) {
        // Mud: churned in furrows along the road, with clods; the puddles lie flat and lower.
        const wet = puddle(fx, fy, seed);
        hg += wM[p] / g * ((1 - wet) * (0.09 * fbm(fx / 40, fy / 40, seed + 6) + 0.07 * mudFurrow(fx, fy, seed)) - 0.12 * wet);
      }
      if (wR[p] > 0) {
        hg += wR[p] / g * (0.012 * fbm(fx / 9, fy / 9, seed + 7, 2) - 0.07 * crack(fx, fy, seed)
          - 0.035 * wheelTracks(fx, fy, seed) - 0.22 * pothole(fx, fy, seed) + 0.02 * tarPatch(fx, fy, seed));
      }
      let hx = 0;
      if (wX[p] > 0) {
        // Rocky ground only: the obstacle itself is a 3D model standing on it (src/view/terrain/obstacles.ts).
        const up = smooth(0, rim, dX[p]);
        hx = st.height.X * up + up * (0.6 * ridged(fx / 60, fy / 60, seed + 8) + 0.25 * ridged(fx / 20, fy / 20, seed + 9) - 0.4);
      }
      height[p] = mix(hg, hx, smooth(0.05, 0.6, wX[p]));
    }
  }
  // Down to the cardboard top at the tile's cut edge.
  const dist = distanceInside(mask, w, h);
  const FADE = 7;
  for (let p = 0; p < n; p++) {
    const v = mask[p] ? -1 + (height[p] + 1) * Math.min(1, dist[p] / FADE) : -1;
    height[p] = Math.min(H_MAX, Math.max(H_MIN, v));
  }

  // 4. Colour and roughness.
  const albedo = new Uint8ClampedArray(n * 4);
  const rough = new Uint8ClampedArray(n);
  // Embers in burnt ground give off light of their own (emissive): only faces with fire have the map.
  const glow = present[7] ? new Uint8ClampedArray(n) : undefined;
  const [sR, sO, sM, sX, sG, sD, sP, sF, sS, sOil] = wSoft;
  const col: Rgb = [0, 0, 0];
  const add = (c: Rgb, k: number): void => { col[0] += c[0] * k; col[1] += c[1] * k; col[2] += c[2] * k; };
  for (let j = 0; j < h; j++) {
    const fy = (j + 0.5) * px;
    for (let i = 0; i < w; i++) {
      const p = j * w + i;
      if (!mask[p]) continue;
      const fx = (i + 0.5) * px;
      const tot = sR[p] + sO[p] + sM[p] + sX[p] + sG[p] + sD[p] + sP[p] + sF[p] + sS[p] + sOil[p] || 1;
      col[0] = col[1] = col[2] = 0;
      if (sR[p] > 0) add(asphaltColor(fx, fy, seed, st), sR[p] / tot);
      if (sO[p] > 0) add(sandColor(fx, fy, i, j, seed, st), sO[p] / tot);
      if (sM[p] > 0) add(mudColor(fx, fy, seed, st), sM[p] / tot);
      if (sX[p] > 0) add(rockColor(fx, fy, height[p], seed, st), sX[p] / tot);
      if (sG[p] > 0) add(gooColor(fx, fy, seed, st), sG[p] / tot);
      if (sD[p] > 0) add(glassColor(fx, fy, seed, st), sD[p] / tot);
      if (sP[p] > 0) { const worn = 0.92 * (1 - 0.24 * wheelTracks(fx, fy, seed)); add(sandColor(fx, fy, i, j, seed, st).map(v => v * worn) as Rgb, sP[p] / tot); }
      if (sF[p] > 0) {
        add(scorchColor(fx, fy, seed, st), sF[p] / tot);
        glow![p] = 255 * emberGlow(fx, fy, seed) * sF[p] / tot;
      }
      if (sS[p] > 0) add(saltColor(fx, fy, seed, st), sS[p] / tot);
      let slick = 0;
      if (sOil[p] > 0) {
        slick = oilSlick(fx, fy, seed) * sOil[p] / tot;
        add(asphaltColor(fx, fy, seed, st), sOil[p] / tot);
        const oc = oilColor(fx, fy, seed, st);
        for (let q = 0; q < 3; q++) col[q] = mix(col[q], oc[q], slick);
      }
      // Goo stains its shore dark and leaves a yellow foam line; fire blackens the ground around it with soot.
      if (sG[p] > 0.04 && sG[p] / tot < 0.8) {
        const edge = Math.sin(Math.PI * clamp01(sG[p] / tot / 0.8));
        const foam = edge * smooth(0.45, 0.6, vnoise(fx / 6, fy / 6, seed + 64));
        for (let q = 0; q < 3; q++) col[q] = mix(mix(col[q], st.goo[1][q] * 0.35, edge * 0.5), [214, 224, 120][q], foam * 0.6);
      }
      if (wF[p] > 0.01 && sF[p] / tot < 0.6) {
        const soot = smooth(0.01, 0.35, wF[p]) * (0.4 + 0.35 * fbm(fx / 30, fy / 30, seed + 65, 2));
        for (let q = 0; q < 3; q++) col[q] *= 1 - 0.6 * soot;
      }
      // Mud dries pale and cracks along its edge, and spatters the ground around it.
      if (sM[p] > 0.04 && sM[p] / tot < 0.8) {
        const edge = Math.sin(Math.PI * clamp01(sM[p] / tot / 0.8));
        const dry = edge * (0.55 - 0.35 * saltRim(fx * 1.3, fy * 1.3, seed + 59));
        for (let q = 0; q < 3; q++) col[q] = mix(col[q], st.mud[1][q] * 1.22, dry);
      }
      if (wM[p] > 0.015 && sM[p] / tot < 0.5) {
        const spot = smooth(0.5, 0.62, vnoise(fx / 8, fy / 8, seed + 54)) * smooth(0.015, 0.3, wM[p]);
        for (let q = 0; q < 3; q++) col[q] = mix(col[q], st.mud[0][q], spot * 0.75);
      }
      // Sand blown over the edge of the asphalt.
      if (sR[p] > 0.05 && sO[p] > 0.05) {
        const dust = smooth(0.2, 0.7, sO[p] / tot + 0.35 * fbm(fx / 14, fy / 14, seed + 10, 2));
        const sc = sandColor(fx, fy, i, j, seed, st);
        for (let q = 0; q < 3; q++) col[q] = mix(col[q], sc[q], dust * 0.6);
      }
      const q4 = p * 4;
      albedo[q4] = col[0]; albedo[q4 + 1] = col[1]; albedo[q4 + 2] = col[2]; albedo[q4 + 3] = 255;
      rough[p] = 255 * (sR[p] * st.rough.R + sO[p] * st.rough.o + sM[p] * st.rough.M + sX[p] * st.rough.X + sG[p] * st.rough.G
        + sD[p] * st.rough.D + sP[p] * st.rough.P + sF[p] * st.rough.F + sS[p] * st.rough.S + sOil[p] * st.rough.O) / tot;
      if (slick > 0) rough[p] = mix(rough[p], 18, slick); // the oil is glossy
      if (sS[p] > 0.3) rough[p] = mix(rough[p], 20, saltBrine(fx, fy, seed) * smooth(0.3, 0.8, sS[p] / tot)); // brine
      if (sG[p] > 0.3) rough[p] = mix(rough[p], 190, gooSkin(fx, fy, seed) * 0.7); // the scum is dull
      if (sM[p] > 0.3) rough[p] = mix(rough[p], 14, puddle(fx, fy, seed) * smooth(0.3, 0.8, sM[p] / tot)); // standing water
      if (sR[p] > 0.5) rough[p] = mix(rough[p], 150, 0.5 * wheelTracks(fx, fy, seed)); // tyres polish the asphalt
    }
  }

  plants(tile, kind, albedo, w, h, px, seed, st);
  const info = infoLayer(tile, opt.players, st, opt.infoWidth ?? w * 2);
  return { w, h, height, albedo, rough, mask, info, ...(glow ? { glow } : {}) };
}

/** Crack strength 0..1 at a frame point (thin wandering lines). */
function crack(fx: number, fy: number, seed: number): number {
  const a = Math.abs(fbm(fx / 80, fy / 80, seed + 20, 3));
  const b = Math.abs(fbm(fx / 32, fy / 32, seed + 21, 2));
  return Math.max(1 - smooth(0.002, 0.012, a),
    0.6 * (1 - smooth(0.002, 0.009, b)) * smooth(0.1, 0.4, fbm(fx / 200, fy / 200, seed + 22)));
}

/** Offset of a frame point from the middle of its lane (a row of spaces), px, and the lane. */
const laneOf = (fy: number): number => Math.round((fy - GRID.y0) / GRID.rowPitch);
const laneOff = (fy: number): number => fy - (GRID.y0 + laneOf(fy) * GRID.rowPitch);
/** A hash as 0..1. */
const h01 = (i: number, j: number, s: number): number => (hash(i, j, s) + 1) / 2;

/** The two wheel tracks of a lane, 0..1: where tyres run, the asphalt is rubbered and a little sunk. */
function wheelTracks(fx: number, fy: number, seed: number): number {
  const d = Math.abs(laneOff(fy)) - 46;
  return Math.exp(-(d * d) / 320) * (0.4 + 0.6 * clamp01(0.5 + fbm(fx / 220, laneOf(fy) * 3.7, seed + 33, 2)));
}

/** Patches of newer tar, 0..1: rectangles laid along the road, a few per face. */
function tarPatch(fx: number, fy: number, seed: number): number {
  const i = Math.floor(fx / 190), j = Math.floor(fy / 72);
  if (h01(i, j, seed + 34) < 0.93) return 0;
  const u = fx / 190 - i, v = fy / 72 - j, mu = 0.06 + 0.2 * h01(i, j, seed + 35), mv = 0.08 + 0.15 * h01(j, i, seed + 35);
  return smooth(mu, mu + 0.02, u) * smooth(mu, mu + 0.02, 1 - u) * smooth(mv, mv + 0.05, v) * smooth(mv, mv + 0.05, 1 - v);
}

/** Potholes, 0..1: rare, and only on the worn stretches of a face. */
function pothole(fx: number, fy: number, seed: number): number {
  return smooth(0.7, 0.8, vnoise(fx / 30, fy / 30, seed + 36)) * smooth(0, 0.3, fbm(fx / 320, fy / 320, seed + 37, 2));
}

/** Skid marks, 0..1: two dark streaks that start in a lane and swerve. */
function skid(fx: number, fy: number, seed: number): number {
  const lane = laneOf(fy), seg = Math.floor(fx / 560);
  if (h01(seg, lane, seed + 38) < 0.62) return 0;
  const u = fx / 560 - seg, start = 0.08 + 0.3 * h01(seg, lane, seed + 39), t = (u - start) / 0.45;
  if (t < 0 || t > 1) return 0;
  const off = laneOff(fy) - 22 * hash(seg, lane, seed + 40) - 55 * hash(seg, lane, seed + 41) * t * t;
  const line = Math.max(Math.exp(-((off - 21) ** 2) / 14), Math.exp(-((off + 21) ** 2) / 14));
  return line * smooth(0, 0.12, t) * (1 - smooth(0.7, 1, t)) * (0.6 + 0.4 * vnoise(fx / 6, fy / 6, seed + 42));
}

function asphaltColor(fx: number, fy: number, seed: number, st: TerrainStyle): Rgb {
  const t = clamp01(0.5 + 0.5 * fbm(fx / 50, fy / 50, seed + 30, 3));
  const grain = 7 * vnoise(fx / 1.7, fy / 1.7, seed + 31);
  const streak = 1 - smooth(0.25, 0.55, fbm(fx / 700, fy / 6, seed + 32, 2)) * 0.14; // fine marks along the road
  // Sun-bleached and darker stretches, the rubber of the wheel tracks, drips of oil in the middle of the lane.
  const bleach = 1 + 0.1 * fbm(fx / 520, fy / 260, seed + 45, 2);
  const tracks = wheelTracks(fx, fy, seed), patch = tarPatch(fx, fy, seed);
  const off = laneOff(fy);
  const drip = smooth(0.25, 0.6, fbm(fx / 42, fy / 42, seed + 43, 2)) * Math.exp(-(off * off) / 420) * 0.22;
  const k = streak * bleach * (1 - 0.2 * tracks) * (1 - drip);
  // Cracks, cracks sealed with tar, skid marks and the rubble of a pothole all go dark.
  const seal = (1 - smooth(0.004, 0.028, Math.abs(fbm(fx / 150, fy / 150, seed + 44, 2)))) * smooth(0.15, 0.4, fbm(fx / 400, fy / 400, seed + 46));
  const dark = Math.max(crack(fx, fy, seed), 0.6 * seal, 0.75 * skid(fx, fy, seed), pothole(fx, fy, seed));
  return [0, 1, 2].map(q => {
    const base = (mix(st.asphalt[0][q], st.asphalt[1][q], t) + grain) * k;
    return mix(mix(base, st.asphalt[0][q] * 0.6, patch * (0.4 + 0.25 * vnoise(fx / 14, fy / 14, seed + 47))), st.crack[q], dark);
  }) as Rgb;
}

/** Dry, hard ground among the sand, 0..1: flat and cracked. */
function hardpan(fx: number, fy: number, seed: number): number {
  return smooth(0.12, 0.38, fbm(fx / 340, fy / 340, seed + 56, 2));
}

/** A stone lying on the sand: 0 off it, up to 1 at its top. */
function pebble(fx: number, fy: number, seed: number): number {
  const S = 27, i = Math.floor(fx / S), j = Math.floor(fy / S);
  if (h01(i, j, seed + 46) < 0.74) return 0;
  const cx = (i + 0.5 + 0.3 * hash(i, j, seed + 47)) * S, cy = (j + 0.5 + 0.3 * hash(i, j, seed + 48)) * S;
  const d = Math.hypot(fx - cx, (fy - cy) * 1.25) / (2.5 + 4.5 * h01(i, j, seed + 49));
  return d < 1 ? 1 - d * d : 0;
}

/** Tyre ruts across the sand, 0..1: a pair of tracks wandering along some lanes. */
function sandRut(fx: number, fy: number, seed: number): number {
  const lane = laneOf(fy);
  const here = smooth(0.05, 0.3, fbm(fx / 650, lane * 9.1, seed + 58, 2));
  if (here <= 0) return 0;
  const off = laneOff(fy) - 38 * fbm(fx / 380, lane * 5.3, seed + 57, 2);
  return here * Math.max(Math.exp(-((off - 20) ** 2) / 22), Math.exp(-((off + 20) ** 2) / 22));
}

function sandColor(fx: number, fy: number, i: number, j: number, seed: number, st: TerrainStyle): Rgb {
  const t = clamp01(0.5 + 0.6 * fbm(fx / 70, fy / 70, seed + 40, 3));
  const hard = hardpan(fx, fy, seed);
  const rip = 6 * (1 - 0.7 * hard) * Math.sin((fx * 0.35 + fy * 0.94) / 5 + 5 * fbm(fx / 60, fy / 60, seed + 5));
  const speck = hash(i, j, seed + 41) > 0.94 ? -28 : 0;
  // Stretches of redder and of paler sand; hard ground is pale, with dark cracks; ruts are darker; stones are grey.
  const red = fbm(fx / 430, fy / 430, seed + 42, 2);
  const cracks = hard * saltRim(fx * 0.8, fy * 0.8, seed + 7);
  const shade = (1 - 0.3 * cracks) * (1 - 0.16 * sandRut(fx, fy, seed));
  const stone = pebble(fx, fy, seed);
  const tone: Rgb = [4 * red, -12 * red, -22 * red];
  return [0, 1, 2].map(q => {
    const sand = (mix(st.sand[0][q], st.sand[1][q], t) + tone[q] + rip + speck) * shade;
    const ground = mix(sand, st.sand[0][q] * 0.93 + 14, hard * 0.55 * (1 - cracks));
    return stone > 0 ? mix(ground * 0.6, [168, 150, 132][q], Math.sqrt(stone)) : ground;
  }) as Rgb;
}

/** Standing water on the mud, 0..1: puddles in its hollows. */
function puddle(fx: number, fy: number, seed: number): number {
  return smooth(0.06, 0.2, fbm(fx / 85, fy / 85, seed + 52, 2));
}

/** Furrows the wheels leave in mud, -1..1: along the road, wavering. */
function mudFurrow(fx: number, fy: number, seed: number): number {
  // Deep where the wheels went, faint elsewhere, never ruler-straight.
  const deep = smooth(-0.25, 0.35, fbm(fx / 140, fy / 60, seed + 60, 2));
  return (0.25 + 0.75 * deep) * Math.sin(laneOff(fy) / 6.5 + 5 * fbm(fx / 95, fy / 95, seed + 53, 2) + 1.5 * vnoise(fx / 23, fy / 23, seed + 61));
}

function mudColor(fx: number, fy: number, seed: number, st: TerrainStyle): Rgb {
  const t = clamp01(0.5 + 0.6 * fbm(fx / 38, fy / 38, seed + 50, 3));
  const wet = puddle(fx, fy, seed);
  // Churned mud: lit crests and dark troughs of the furrows, wet clods; puddles: brown water, paler where the sky shows.
  const furrow = 1 + 0.16 * mudFurrow(fx, fy, seed);
  const clod = smooth(0.42, 0.62, fbm(fx / 11, fy / 11, seed + 51, 2)) * 0.3;
  const sky = 0.55 + 0.35 * fbm(fx / 60, fy / 60, seed + 55, 2);
  return [0, 1, 2].map(q => {
    const churned = mix(mix(st.mud[0][q], st.mud[1][q], t) * furrow, st.mudGlint[q], clod);
    return mix(churned, mix(st.mud[0][q] * 0.75, st.mudGlint[q] * 0.8, sky * 0.55), wet);
  }) as Rgb;
}

/** Salt crust: 1 on the raised rims between the polygons of the crust (a cellular pattern). */
function saltRim(fx: number, fy: number, seed: number): number {
  // Distance to the nearest and second nearest jittered cell centre: the rim is where they tie.
  const S = 34, cx = Math.floor(fx / S), cy = Math.floor(fy / S);
  let d1 = 1e9, d2 = 1e9;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const px = (cx + i + hash(cx + i, cy + j, seed + 90)) * S, py = (cy + j + hash(cx + i, cy + j, seed + 91)) * S;
      const d = Math.hypot(fx - px, fy - py);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
  }
  return 1 - smooth(0.5, 3.5, d2 - d1);
}

/** Scratch result of plates(): the crack between plates (1 on it), the plate's own 0..1 number, the offset from its middle in plates. */
const PL = { rim: 0, id: 0, dx: 0, dy: 0 };
/** A surface broken in plates of about `S` px (salt crust, glass shards, baked earth): fills PL for a frame point. */
function plates(fx: number, fy: number, S: number, seed: number): void {
  const cx = Math.floor(fx / S), cy = Math.floor(fy / S);
  let d1 = 1e9, d2 = 1e9, id = 0, ox = 0, oy = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const px = (cx + i + 0.5 + 0.42 * hash(cx + i, cy + j, seed)) * S, py = (cy + j + 0.5 + 0.42 * hash(cx + i, cy + j, seed + 1)) * S;
      const d = Math.hypot(fx - px, fy - py);
      if (d < d1) { d2 = d1; d1 = d; id = h01(cx + i, cy + j, seed + 2); ox = fx - px; oy = fy - py; } else if (d < d2) d2 = d;
    }
  }
  PL.rim = 1 - smooth(0.4, S * 0.09, d2 - d1); PL.id = id; PL.dx = ox / S; PL.dy = oy / S;
}

/** Bubbles on toxic goo: 0..1 domes, big slow ones and a fizz of small ones. */
function bubble(fx: number, fy: number, seed: number): number {
  const a = smooth(0.62, 0.72, vnoise(fx / 9, fy / 9, seed + 80));
  const b = smooth(0.7, 0.78, vnoise(fx / 4, fy / 4, seed + 81));
  const c = smooth(0.7, 0.8, vnoise(fx / 22, fy / 22, seed + 79));
  return Math.max(a, b * 0.6, c);
}

/** Dark scum floating on the goo, 0..1: rafts drawn out by its slow flow. */
function gooSkin(fx: number, fy: number, seed: number): number {
  return smooth(0.2, 0.34, fbm(fx / 75 + 1.5 * fbm(fx / 160, fy / 160, seed + 76, 2), fy / 75, seed + 77, 3));
}

function gooColor(fx: number, fy: number, seed: number, st: TerrainStyle): Rgb {
  // Streaks of two greens pulled along by the flow, rafts of dark scum, bubbles with a bright rim.
  const flow = fbm(fx / 60 + 2.2 * fbm(fx / 120, fy / 120, seed + 83, 2), fy / 34, seed + 84, 3);
  const t = clamp01(0.5 + 0.8 * flow);
  const skin = gooSkin(fx, fy, seed), b = bubble(fx, fy, seed);
  const lit = Math.max(4 * b * (1 - b) * 0.85, b * 0.35) * (1 - 0.5 * skin);
  const spark = hash(Math.floor(fx / 3), Math.floor(fy / 3), seed + 78) > 0.97 ? 0.5 * (1 - skin) : 0;
  return [0, 1, 2].map(q => mix(mix(mix(st.goo[0][q], st.goo[1][q], t), st.goo[1][q] * 0.42, skin * 0.8), st.gooBubble[q], Math.max(lit, spark))) as Rgb;
}

/** Desert glass: sand fused into shards. Each shard has its own tint and catches the light on one side; sand lies in the cracks. */
function glassColor(fx: number, fy: number, seed: number, st: TerrainStyle): Rgb {
  plates(fx, fy, 58, seed + 85);
  const turn = PL.id * 6.283, facet = clamp01(0.5 + 1.1 * (PL.dx * Math.cos(turn) + PL.dy * Math.sin(turn)));
  const tone = clamp01(0.2 + 0.55 * PL.id + 0.25 * fbm(fx / 45, fy / 45, seed + 85, 2));
  const streak = smooth(0.55, 0.75, fbm(fx / 140 + fy / 60, fy / 18, seed + 86, 2));
  const glint = clamp01(smooth(0.62, 0.95, facet) * 0.75 + streak * 0.35);
  const dust = PL.rim * smooth(-0.2, 0.3, fbm(fx / 90, fy / 90, seed + 87, 2));
  return [0, 1, 2].map(q => {
    const shard = mix(mix(st.glass[0][q], st.glass[1][q], tone) * (0.86 + 0.14 * facet), st.glassGlint[q], glint);
    return mix(mix(shard, st.glass[1][q] * 0.5, PL.rim * 0.8), st.sand[1][q], dust * 0.7);
  }) as Rgb;
}

/** Shallow brine standing on the salt, 0..1. */
function saltBrine(fx: number, fy: number, seed: number): number {
  return smooth(0.3, 0.42, fbm(fx / 120, fy / 120, seed + 92, 2));
}

/** Salt flats: a crust of white polygons with raised rims, dust blown over it, pools of pale brine, old tyre tracks. */
function saltColor(fx: number, fy: number, seed: number, st: TerrainStyle): Rgb {
  plates(fx, fy, 64, seed + 90);
  const t = clamp01(0.3 * PL.id + 0.5 + 0.4 * fbm(fx / 60, fy / 60, seed + 88, 3));
  const dirt = smooth(0.05, 0.5, fbm(fx / 260, fy / 260, seed + 93, 2)) * 0.3;
  const brine = saltBrine(fx, fy, seed), rut = sandRut(fx, fy, seed + 5);
  const water: Rgb = [150, 200, 204];
  return [0, 1, 2].map(q => {
    const crust = mix(mix(st.salt[0][q], st.salt[1][q], t), st.saltCrack[q], Math.max(PL.rim * 0.75, rut * 0.45));
    return mix(mix(crust, st.sand[1][q], dirt), water[q], brine * 0.7 * (1 - 0.6 * PL.rim));
  }) as Rgb;
}

/**
 * An oil slick on a space, 0..1: one big blot with a wobbly edge and a few drips around it,
 * centred on the space (the slick's frame-pixel coordinates wrap per space via the grid cell).
 */
function oilSlick(fx: number, fy: number, seed: number): number {
  const c = cellAt(fx, fy);
  if (!c) return 0;
  const [cx, cy] = spaceCenterPx(c.r, c.c);
  const dx = (fx - cx) / 150, dy = (fy - cy) / 105; // the blot covers most of the space
  const d = Math.hypot(dx, dy) + 0.45 * (fbm(fx / 40, fy / 40, seed + 95, 3));
  const blot = 1 - smooth(0.75, 0.9, d);
  const drips = smooth(0.72, 0.8, vnoise(fx / 14, fy / 14, seed + 96)) * (1 - smooth(1.0, 1.5, d));
  return Math.max(blot, drips);
}

/** Oil: near black, with a thin-film rainbow sheen swirling over it. */
function oilColor(fx: number, fy: number, seed: number, st: TerrainStyle): Rgb {
  const t = fbm(fx / 25 + 2 * fbm(fx / 80, fy / 80, seed + 97), fy / 25, seed + 98, 3);
  const band = (t * 3 + 3) % 3, i = Math.floor(band), f = band - i;
  const a = st.sheen[i % 3], b = st.sheen[(i + 1) % 3];
  const sheen = smooth(0.35, 0.65, fbm(fx / 30, fy / 30, seed + 99, 2)) * 0.4;
  return [0, 1, 2].map(q => mix(st.oil[q], mix(a[q], b[q], f), sheen)) as Rgb;
}

/** Embers in burnt ground, 0..1: the cracks of the baked earth glowing where it is still hot, and a few hot spots. */
function emberGlow(fx: number, fy: number, seed: number): number {
  plates(fx, fy, 46, seed + 71);
  const hot = smooth(-0.05, 0.4, fbm(fx / 70, fy / 70, seed + 74, 2));
  const spots = smooth(0.66, 0.82, fbm(fx / 9, fy / 9, seed + 73, 2)) * 0.8;
  return Math.max(PL.rim * hot, spots * hot);
}

/** Burnt ground: charcoal black earth baked in plates, drifts of grey ash, charred lumps, embers in the cracks (white-hot at the heart). */
function scorchColor(fx: number, fy: number, seed: number, st: TerrainStyle): Rgb {
  const t = clamp01(0.5 + 0.6 * fbm(fx / 25, fy / 25, seed + 72, 3));
  const ash = smooth(0.5, 0.75, fbm(fx / 55 + fy / 140, fy / 30, seed + 75, 3)) * 0.8;
  const lump = pebble(fx, fy, seed + 200);
  const glow = emberGlow(fx, fy, seed);
  const core: Rgb = [255, 222, 130];
  return [0, 1, 2].map(q => {
    const ground = mix(mix(st.scorch[0][q], st.scorch[1][q], t) * (0.8 + 0.4 * PL.id), st.ash[q], ash);
    const burnt = lump > 0 ? mix(st.scorch[0][q] * 0.6, st.ash[q] * 0.7, lump * lump) : ground;
    return mix(mix(burnt, st.ember[q], glow), core[q], smooth(0.75, 1, glow) * 0.7);
  }) as Rgb;
}

function rockColor(fx: number, fy: number, hgt: number, seed: number, st: TerrainStyle): Rgb {
  const band = 0.5 + 0.5 * Math.sin(hgt * 9 + 2 * fbm(fx / 40, fy / 40, seed + 60));
  const crev = 1 - smooth(0.55, 0.85, ridged(fx / 26, fy / 26, seed + 9));
  const lit = Math.min(1, 0.35 + 0.65 * smooth(1.2, 3.4, hgt)) * (1 - crev * 0.6); // lower rock is darker
  return [0, 1, 2].map(q => mix(st.rock[2][q], mix(st.rock[0][q], st.rock[1][q], band * 0.7), lit)) as Rgb;
}

/** Small desert plants on off-road spaces. */
function plants(tile: TileData, kind: Uint8Array, albedo: Uint8ClampedArray, w: number, h: number, px: number, seed: number, st: TerrainStyle): void {
  const sand = 1 + KINDS.indexOf('o');
  for (let r = 0; r < GRID.rows; r++) {
    for (let c = 0; c < GRID.cols; c++) {
      if (tile.terrain[r]?.[c] !== 'o') continue;
      const count = Math.floor(st.plants + 0.5 + 0.9 * hash(r, c, seed + 70));
      for (let k = 0; k < count; k++) {
        const cx = (r % 2 ? GRID.x0Odd : GRID.x0Even) + GRID.pitch * c + 70 * hash(r, c * 7 + k, seed + 71);
        const cy = GRID.y0 + GRID.rowPitch * r + 60 * hash(r * 5 + k, c, seed + 72);
        const rad = (11 + 5 * hash(r, c + k, seed + 73)) / px;
        const ci = cx / px, cj = cy / px;
        for (let j = Math.floor(cj - rad - 1); j <= cj + rad + 1; j++) {
          for (let i = Math.floor(ci - rad - 1); i <= ci + rad + 1; i++) {
            if (i < 0 || j < 0 || i >= w || j >= h || kind[j * w + i] !== sand) continue;
            const dx = i - ci, dy = j - cj, d = Math.hypot(dx, dy);
            const lim = rad * (0.55 + 0.45 * Math.abs(Math.cos(Math.atan2(dy, dx) * 3.5)));
            if (d > lim) continue;
            const q = (j * w + i) * 4;
            for (let ch = 0; ch < 3; ch++) albedo[q + ch] = mix(st.plant[1][ch], st.plant[0][ch], d / lim);
          }
        }
      }
    }
  }
}

/** Is (x, y) inside the hazard triangle of size s (base at x = -s, point at x = 1.2 s)? */
function inTri(x: number, y: number, s: number): boolean {
  const half = 1.1 * s * (1 - (x + s) / (2.2 * s));
  return x >= -s && Math.abs(y) <= half;
}

/**
 * The information layer of a face, `w` pixels wide: grid lines, tape frames of impassable spaces and
 * hazard triangles (faint when not used at this player count), RGBA on a transparent ground.
 * Example: `const info = infoLayer(tile, 3, TERRAIN_STYLE, 2000)`.
 */
export function infoLayer(tile: TileData, players: number | undefined, st: TerrainStyle, w: number): { w: number; h: number; data: Uint8ClampedArray } {
  const h = Math.round(w * GRID.frameH / GRID.frameW);
  const px = GRID.frameW / w;
  const data = new Uint8ClampedArray(w * h * 4);
  const hazard = new Map<string, number>();
  for (const hz of tile.hazards) {
    const counts = hz[2] as number[] | undefined;
    hazard.set(`${hz[0]},${hz[1]}`, !counts || players === undefined || counts.includes(players) ? 1 : 0.28);
  }
  for (let j = 0; j < h; j++) {
    const fy = (j + 0.5) * px;
    for (let i = 0; i < w; i++) {
      const fx = (i + 0.5) * px;
      const cell = cellAt(fx, fy);
      if (!cell) continue;
      const q = (j * w + i) * 4;
      // Later marks go over earlier ones.
      const paint = (c: Rgb, a: number): void => {
        const a0 = data[q + 3] / 255, out = a + a0 * (1 - a);
        if (out <= 0) return;
        for (let ch = 0; ch < 3; ch++) data[q + ch] = (c[ch] * a + data[q + ch] * a0 * (1 - a)) / out;
        data[q + 3] = out * 255;
      };
      // Grid line along the outline.
      const a = (1 - smooth(1.4, 3.2, cell.edge)) * 0.9;
      if (a > 0) paint(st.line, a);
      // Tape frame of an impassable space (only where the next space is not impassable too).
      if (tile.terrain[cell.r]?.[cell.c] === 'X' && cell.s > 0.8 && cell.s < 0.93
        && beyondOutline(cell, fx, fy, (r, c) => (tile.terrain[r]?.[c] ?? 'o') as Kind) !== 'X') {
        paint(((fx + fy) / 18) % 2 < 1 ? st.tape[0] : st.tape[1], 1);
      }
      // Hazard triangles: two nested outlines.
      const hz = hazard.get(`${cell.r},${cell.c}`);
      if (hz !== undefined) {
        const dx = fx - cell.cx, dy = fy - cell.cy;
        for (const k of [1, 0.55]) {
          const s = 46 * k;
          if (inTri(dx, dy, s) && !inTri(dx, dy, s * 0.7)) paint(st.hazard, hz);
        }
      }
    }
  }
  return { w, h, data };
}

/**
 * Tangent-space normal map (RGBA, row 0 at frame y = 0) of a height map; `slope` = world height of
 * one height unit divided by the world size of one pixel. Green = +dh/dy (texture v runs up).
 */
export function normalMap(m: { w: number; h: number; height: Float32Array }, slope: number): Uint8ClampedArray {
  const { w, h, height } = m;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1), y1 = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - 1), x1 = Math.min(w - 1, x + 1);
      const nx = -(height[y * w + x1] - height[y * w + x0]) / (x1 - x0) * slope;
      const ny = (height[y1 * w + x] - height[y0 * w + x]) / (y1 - y0) * slope;
      const l = Math.hypot(nx, ny, 1);
      const q = (y * w + x) * 4;
      out[q] = (nx / l * 0.5 + 0.5) * 255;
      out[q + 1] = (ny / l * 0.5 + 0.5) * 255;
      out[q + 2] = (1 / l * 0.5 + 0.5) * 255;
      out[q + 3] = 255;
    }
  }
  return out;
}
