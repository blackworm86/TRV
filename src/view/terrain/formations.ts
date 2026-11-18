// Formations of obstacles (design/gdd/terrain-generation.md, "Formazioni di ostacoli"): the
// impassable spaces of a face that touch are one group, and a group is one formation with a shape
// (a single space, a pair, a line, a corner, a mass), a height that grows with its size, and a
// footprint that stays inside its own spaces. Pure reckoning in the tile's 2000 x 1522 frame: no
// three.js and no DOM, so it is unit-tested; obstacles.ts turns it into geometry.

import { GRID, spaceCenterPx, type TileData } from '../tile-grid';

/** How a group of impassable spaces lies: it chooses the formation standing on it. */
export type FormShape = 'single' | 'pair' | 'line' | 'corner' | 'mass';

/**
 * Sizes of every formation (data/trv/terrain_look.json, `formation`). Heights in spaces (1 = the
 * width of a space): `baseH` one space alone, `grow` more for each further space, `maxH` the cap,
 * so a formation never hides the cars behind it. `inset`: the margin kept from the outline of the
 * formation's own spaces, as a share of a space's width.
 */
export interface FormKnobs { baseH: number; grow: number; maxH: number; inset: number }

/**
 * The profile of one kind of formation (data/trv/terrain_look.json, `kinds`): `h` scales the
 * heights; `edge` is how far in from the footprint's rim the side climbs (share of a space's
 * width: small = a cliff and a flat top, large = a peak); `power` bends the side (below 1 steep
 * at the foot); `noise` and `crest` add lumps and a sharp ridge, as shares of the height.
 */
export interface FormProfile { h: number; edge: number; power: number; noise: number; crest: number }

/** One space of a formation: its centre in frame px, how many spaces of the group touch it, its top. */
export interface FormCell { r: number; c: number; x: number; y: number; n: number; h: number }

/** A formation: its spaces, the joints between touching ones, its shape, top height and long axis. */
export interface Formation {
  cells: FormCell[];
  /** Joints between touching spaces: a band of half-width `rad` px from cell `a` to cell `b`. */
  links: { a: number; b: number; rad: number }[];
  shape: FormShape;
  /** Top height in spaces, before the kind's own scale. */
  height: number;
  /** Direction of the group's long side, radians in the frame (0 = along the road). */
  axis: number;
}

/** Top height of a group of `n` spaces: `min(maxH, baseH + grow * (n - 1))`. Example: 3 spaces, 0.45 + 0.24 = 0.69. */
export function formationHeight(n: number, k: FormKnobs): number {
  return Math.min(k.maxH, k.baseH + k.grow * (Math.max(1, n) - 1));
}

/** Centre of a space as the formations use it: the middle of its chevron. */
function centre(r: number, c: number): [number, number] {
  const [x, y] = spaceCenterPx(r, c);
  return [x + GRID.tip / 2, y];
}

/** Two spaces touch when their centres are closer than this (the six spaces around one). */
const TOUCH = GRID.pitch * 1.2;

/**
 * The formations of a face: its impassable spaces ('X') grouped by touch, in reading order.
 * Example: `formationsOf(tile, knobs).map(f => f.shape)` gives `['single', 'pair', 'pair']` for Route Sixty Styx.
 */
export function formationsOf(tile: TileData, k: FormKnobs): Formation[] {
  const all: { r: number; c: number; x: number; y: number }[] = [];
  tile.terrain.forEach((row, r) => [...row].forEach((kind, c) => {
    if (kind !== 'X') return;
    const [x, y] = centre(r, c);
    all.push({ r, c, x, y });
  }));
  const touch = (a: number, b: number): boolean => a !== b && Math.hypot(all[a].x - all[b].x, all[a].y - all[b].y) < TOUCH;
  const group = new Array<number>(all.length).fill(-1);
  const out: Formation[] = [];
  for (let s = 0; s < all.length; s++) {
    if (group[s] >= 0) continue;
    const ids = [s];
    group[s] = out.length;
    for (let q = 0; q < ids.length; q++) {
      for (let j = 0; j < all.length; j++) if (group[j] < 0 && touch(ids[q], j)) { group[j] = out.length; ids.push(j); }
    }
    ids.sort((a, b) => a - b);
    const height = formationHeight(ids.length, k);
    const inset = k.inset * GRID.pitch;
    const links: Formation['links'] = [];
    const near = ids.map(() => [] as number[]);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      if (!touch(ids[i], ids[j])) continue;
      near[i].push(j); near[j].push(i);
      const a = all[ids[i]], b = all[ids[j]];
      // Half the side the two spaces share, less the margin: the joint never leaves the two spaces.
      const shared = a.r === b.r ? GRID.rowPitch : GRID.pitch - Math.abs(a.x - b.x);
      links.push({ a: i, b: j, rad: Math.max(4, shared / 2 - inset - GRID.tip / 2) });
    }
    // The ends of a formation stand a little lower than its middle, never below one space alone.
    const cells = ids.map((id, i) => ({ ...all[id], n: near[i].length, h: Math.max(Math.min(k.baseH, height), height * (near[i].length >= 2 ? 1 : 0.86)) }));
    out.push({ cells, links, height, ...lie(cells, near) });
  }
  return out;
}

/** Shape and long axis of a group, from where its spaces lie. */
function lie(cells: FormCell[], near: number[][]): { shape: FormShape; axis: number } {
  const n = cells.length;
  let mx = 0, my = 0;
  for (const c of cells) { mx += c.x / n; my += c.y / n; }
  let xx = 0, yy = 0, xy = 0;
  for (const c of cells) { xx += (c.x - mx) ** 2 / n; yy += (c.y - my) ** 2 / n; xy += (c.x - mx) * (c.y - my) / n; }
  const axis = n > 1 ? 0.5 * Math.atan2(2 * xy, xx - yy) : 0;
  if (n === 1) return { shape: 'single', axis };
  if (n === 2) return { shape: 'pair', axis };
  // Spread across the long axis: a line keeps every space near it.
  const across = Math.sqrt(Math.max(0, (xx + yy) / 2 - Math.hypot((xx - yy) / 2, xy)));
  if (across < GRID.rowPitch * 0.3) return { shape: 'line', axis };
  // A mass has a space held by three others, or three spaces all touching one another.
  const packed = near.some((m, i) => m.length >= 3 || m.some(a => m.some(b => a < b && near[a].includes(b) && i !== a)));
  return { shape: packed ? 'mass' : 'corner', axis };
}

/** Half-sizes of the part of a space a formation may stand on, in frame px. */
export function footprintHalf(k: FormKnobs): { hw: number; hh: number } {
  const inset = k.inset * GRID.pitch;
  return { hw: GRID.pitch / 2 - GRID.tip / 2 - inset, hh: GRID.rowPitch / 2 - inset };
}

/**
 * How far inside the formation's footprint a frame point is, in px: positive inside, zero or less
 * outside. The footprint is the whole of the group's spaces taken together, less the margin from
 * every space that is not of the group (and from the edge of the tile): a group is one solid
 * ground, with no gap between its spaces.
 */
export function depthAt(f: Formation, x: number, y: number, k: FormKnobs): number {
  const { pitch, rowPitch, tip } = GRID;
  const x0 = (r: number): number => (Math.abs(r % 2) === 1 ? GRID.x0Odd : GRID.x0Even) + tip / 2;
  const own = (r: number, c: number): boolean => f.cells.some(q => q.r === r && q.c === c);
  const r = Math.round((y - GRID.y0) / rowPitch), c = Math.round((x - x0(r)) / pitch);
  if (!own(r, c)) return -1;
  let d = Infinity;
  for (let rr = r - 1; rr <= r + 1; rr++) {
    const c0 = Math.round((x - x0(rr)) / pitch);
    for (let cc = c0 - 2; cc <= c0 + 2; cc++) {
      if (rr >= 0 && rr < GRID.rows && cc >= 0 && cc < GRID.cols && own(rr, cc)) continue;
      // Along the road a space ends in a point: half its depth more is kept clear.
      const dx = Math.max(0, Math.abs(x - (x0(rr) + cc * pitch)) - pitch / 2 - tip / 2);
      const dy = Math.max(0, Math.abs(y - (GRID.y0 + rr * rowPitch)) - rowPitch / 2);
      d = Math.min(d, Math.hypot(dx, dy));
    }
  }
  return d - k.inset * pitch;
}

function hash(i: number, j: number, s: number): number {
  let n = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 2147483647);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
/** Smooth value noise, 0..1. */
function vnoise(x: number, y: number, s: number): number {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j;
  const a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  const top = hash(i, j, s) + (hash(i + 1, j, s) - hash(i, j, s)) * a;
  const bot = hash(i, j + 1, s) + (hash(i + 1, j + 1, s) - hash(i, j + 1, s)) * a;
  return top + (bot - top) * b;
}

/**
 * Height of a formation of one kind at a frame point, in spaces (0 outside its footprint). The
 * side climbs from the rim over `edge`, the top follows the tops of the spaces around the point,
 * lumps and a ridge only ever add, and nothing passes `maxH` scaled by the kind.
 */
export function heightAt(f: Formation, x: number, y: number, k: FormKnobs, p: FormProfile, seed: number): number {
  const d = depthAt(f, x, y, k);
  if (d <= 0) return 0;
  const t = Math.min(1, d / (p.edge * GRID.pitch));
  // The top follows the tops of the spaces around the point; a built thing (no lumps) steps from one to the next.
  let w = 0, top = 0;
  for (const c of f.cells) {
    const q = 1 / ((x - c.x) ** 2 + (y - c.y) ** 2 + 400) ** (p.noise > 0 ? 1 : 8);
    w += q; top += q * c.h;
  }
  const lumps = 0.6 * vnoise(x / 95, y / 95, seed) + 0.4 * vnoise(x / 41, y / 41, seed + 7);
  const ridge = 1 - Math.abs(2 * vnoise(x / 130, y / 130, seed + 13) - 1);
  const h = top / w * t ** p.power * (1 + t * (p.noise * lumps + p.crest * ridge * ridge));
  return Math.min(k.maxH, h) * p.h;
}
