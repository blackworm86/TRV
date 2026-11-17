// The camera director's reckoning (design/gdd/camera-director.md): where the screen is free, how to
// stand so that what matters fills that free part, what stands in the way, and which of several
// shots shows the action best. Pure geometry on three.js vectors: no DOM, no scene, no game state,
// so every rule here is unit-tested (tests/unit/view/camera-framing.test.ts).

import * as THREE from 'three';

/** A rectangle of the window, in CSS pixels. */
export interface Rect { left: number; top: number; right: number; bottom: number }
/** A rectangle of the picture in normalised device coordinates: x and y from -1 to 1, y upward. */
export interface SafeFrame { x0: number; x1: number; y0: number; y1: number }
/** Something the shot must show: a ball of radius `r` around `at`. A heavier subject matters more. */
export interface Subject { at: THREE.Vector3; r: number; weight?: number }
/** The camera's lens: vertical field of view in degrees and the picture's width over its height. */
export interface Lens { fov: number; aspect: number }
/** Where the camera stands and the point it looks at. */
export interface Pose { pos: THREE.Vector3; look: THREE.Vector3 }
/**
 * Something that can hide a subject: an upright cylinder of radius `r` around (x, z), from height
 * `y0` (default the table) to `h`. `id` tells the caller what it is (to fade it, for instance).
 */
export interface Blocker { x: number; z: number; r: number; h: number; y0?: number; id?: string }
/**
 * A way of filming an event. The camera stands behind the start of the action's axis, turned by
 * `yaw` around the subjects (radians; 90 degrees is side on) and raised by `elev` (radians above the
 * table); the subjects fill the share `fill` of the free part of the screen, but the camera comes
 * no nearer than `near` (world units). `orbit` turns it slowly around them (radians per second).
 */
export interface ShotSpec { id: string; yaw: number; elev: number; fill: number; near?: number; orbit?: number }
/** What the shots are judged against. */
export interface ScoreCtx {
  blockers: Blocker[];
  /** The lowest the camera may stand (the table's top, plus a little). */
  floor: number;
  /** The direction the previous shot looked along, to keep a cut from turning the scene around. */
  prev?: THREE.Vector3;
  /** Things that hide nothing but must not loom in the foreground (dice lying by the road). */
  clutter?: Subject[];
}
export interface Scored { spec: ShotSpec; yaw: number; pose: Pose; score: number; blocked: Blocker[] }

/** Points along the line of sight tested against each blocker. */
const SIGHT_STEPS = 32;
/** What each fault of a shot costs (and what a large subject earns), out of a clean shot's 100. */
export const SCORE = { hidden: 60, outside: 50, underground: 100, farSide: 25, backward: 15, turnedAround: 10, size: 30, order: 2, clutter: 20 };
/** A piece of clutter starts to cost when it is this tall in the picture (a share of its half height), and costs in full at `full`. */
export const LOOM = { from: 0.08, full: 0.25 };

/**
 * The largest rectangle of a `w` by `h` window that none of `blocks` covers (the bars, the boards,
 * a panel in the middle...). Its sides lie on the window's edges or on the blocks' edges.
 */
export function freeRect(w: number, h: number, blocks: Rect[]): Rect {
  const bs = blocks.map(b => ({ left: Math.max(0, b.left), top: Math.max(0, b.top), right: Math.min(w, b.right), bottom: Math.min(h, b.bottom) }))
    .filter(b => b.right > b.left && b.bottom > b.top);
  const xs = [...new Set([0, w, ...bs.flatMap(b => [b.left, b.right])])].sort((a, b) => a - b);
  const ys = [...new Set([0, h, ...bs.flatMap(b => [b.top, b.bottom])])].sort((a, b) => a - b);
  let best: Rect = { left: 0, top: 0, right: w, bottom: h }, area = -1;
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) {
    for (let k = 0; k < ys.length; k++) for (let l = k + 1; l < ys.length; l++) {
      const r = { left: xs[i], right: xs[j], top: ys[k], bottom: ys[l] };
      const a = (r.right - r.left) * (r.bottom - r.top);
      if (a <= area) continue;
      if (bs.some(b => b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top)) continue;
      best = r; area = a;
    }
  }
  return best;
}

/** A rectangle of the window as a rectangle of the picture. */
export function toFrame(r: Rect, w: number, h: number): SafeFrame {
  return { x0: (r.left / w) * 2 - 1, x1: (r.right / w) * 2 - 1, y0: 1 - (r.bottom / h) * 2, y1: 1 - (r.top / h) * 2 };
}

/** The camera's own axes for a pose: forward, right and up. */
function axes(p: Pose): { f: THREE.Vector3; r: THREE.Vector3; u: THREE.Vector3 } {
  const f = p.look.clone().sub(p.pos).normalize();
  const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0));
  if (r.lengthSq() < 1e-8) r.set(1, 0, 0); // looking straight down
  r.normalize();
  return { f, r, u: new THREE.Vector3().crossVectors(r, f) };
}

/** Where a point falls in the picture (x, y) and how far ahead of the camera it is. */
export function project(p: Pose, lens: Lens, at: THREE.Vector3): { x: number; y: number; depth: number } {
  const { f, r, u } = axes(p), d = at.clone().sub(p.pos), depth = d.dot(f);
  const t = Math.tan(THREE.MathUtils.degToRad(lens.fov / 2));
  return { x: d.dot(r) / (depth * t * lens.aspect), y: d.dot(u) / (depth * t), depth };
}

/** The part of the picture the subjects take up; `behind` when one is not in front of the camera. */
export function screenBox(p: Pose, lens: Lens, subjects: Subject[]): SafeFrame & { behind: boolean } {
  const t = Math.tan(THREE.MathUtils.degToRad(lens.fov / 2));
  const out = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, behind: false };
  for (const s of subjects) {
    const q = project(p, lens, s.at);
    if (q.depth <= s.r + 0.05) { out.behind = true; continue; }
    const ry = s.r / (q.depth * t), rx = ry / lens.aspect;
    out.x0 = Math.min(out.x0, q.x - rx); out.x1 = Math.max(out.x1, q.x + rx);
    out.y0 = Math.min(out.y0, q.y - ry); out.y1 = Math.max(out.y1, q.y + ry);
  }
  return out;
}

/** True when every subject is wholly inside `safe`. */
export function fits(p: Pose, lens: Lens, subjects: Subject[], safe: SafeFrame): boolean {
  const b = screenBox(p, lens, subjects);
  return !b.behind && b.x0 >= safe.x0 && b.x1 <= safe.x1 && b.y0 >= safe.y0 && b.y1 <= safe.y1;
}

/**
 * The direction from the subjects to the camera for a shot: behind the start of `axis` (the way
 * the action goes, level), turned by `yaw` around the vertical and raised by `elev`.
 */
export function shotDir(axis: THREE.Vector3, yaw: number, elev: number): THREE.Vector3 {
  const a = axis.clone().setY(0);
  if (a.lengthSq() < 1e-8) a.set(1, 0, 0);
  a.normalize().negate();
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const flat = new THREE.Vector3(a.x * c + a.z * s, 0, -a.x * s + a.z * c);
  return flat.multiplyScalar(Math.cos(elev)).setY(Math.sin(elev)).normalize();
}

/**
 * Stands the camera along `dir` (from the subjects toward the camera) as near as it can be with
 * every subject inside the share `fill` of `safe`, the subjects centred in `safe`. Never nearer
 * than `near`, never lower than `floor`.
 */
export function frame(dir: THREE.Vector3, subjects: Subject[], safe: SafeFrame, lens: Lens, fill: number, near = 0.5, floor = -Infinity): Pose {
  const total = subjects.reduce((n, s) => n + (s.weight ?? 1), 0) || 1;
  const look = subjects.reduce((v, s) => v.addScaledVector(s.at, (s.weight ?? 1) / total), new THREE.Vector3());
  const d = dir.clone().normalize();
  const maxW = (safe.x1 - safe.x0) * fill, maxH = (safe.y1 - safe.y0) * fill;
  const cx = (safe.x0 + safe.x1) / 2, cy = (safe.y0 + safe.y1) / 2;
  const t = Math.tan(THREE.MathUtils.degToRad(lens.fov / 2));
  const at = (dist: number): Pose => ({ pos: look.clone().addScaledVector(d, dist), look: look.clone() });
  let dist = near;
  for (let pass = 0; pass < 6; pass++) {
    let lo = near, hi = 400;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2, b = screenBox(at(mid), lens, subjects);
      if (b.behind || b.x1 - b.x0 > maxW || b.y1 - b.y0 > maxH) lo = mid; else hi = mid;
    }
    dist = hi;
    // Centre the subjects in the free part: sliding the camera sideways and up slides the picture.
    const p = at(dist), b = screenBox(p, lens, subjects), { r, u } = axes(p);
    look.addScaledVector(r, ((b.x0 + b.x1) / 2 - cx) * dist * t * lens.aspect).addScaledVector(u, ((b.y0 + b.y1) / 2 - cy) * dist * t);
  }
  const p = at(dist);
  if (p.pos.y < floor) p.pos.y = floor;
  return p;
}

/**
 * The blockers standing between the camera and a subject. A blocker around the subject itself (the
 * car's own body, the rock it stands by) does not count: only what is clearly nearer the camera.
 */
export function blockedBy(pos: THREE.Vector3, s: Subject, blockers: Blocker[]): Blocker[] {
  const out: Blocker[] = [];
  for (const b of blockers) {
    if (Math.hypot(b.x - s.at.x, b.z - s.at.z) <= b.r + s.r) continue;
    for (let i = 1; i < SIGHT_STEPS; i++) {
      const k = i / SIGHT_STEPS;
      const x = pos.x + (s.at.x - pos.x) * k, y = pos.y + (s.at.y - pos.y) * k, z = pos.z + (s.at.z - pos.z) * k;
      if (y <= b.h && y >= (b.y0 ?? -Infinity) && Math.hypot(x - b.x, z - b.z) <= b.r) { out.push(b); break; }
    }
  }
  return out;
}

/**
 * How well a pose shows the subjects, out of 100: it loses for each subject hidden or outside the
 * free part of the screen, for standing under the table, for filming from the far side of the table
 * or against the way the road runs (+x: left to right on the screen), for turning the scene around
 * after the previous shot, for clutter looming in the foreground; it gains for showing its main
 * subject large.
 */
export function scoreShot(p: Pose, subjects: Subject[], safe: SafeFrame, lens: Lens, ctx: ScoreCtx): { score: number; blocked: Blocker[] } {
  const total = subjects.reduce((n, s) => n + (s.weight ?? 1), 0) || 1;
  const blocked = new Set<Blocker>();
  let score = 100;
  for (const s of subjects) {
    const hit = blockedBy(p.pos, s, ctx.blockers);
    if (hit.length) score -= SCORE.hidden * (s.weight ?? 1) / total;
    for (const b of hit) blocked.add(b);
  }
  if (!fits(p, lens, subjects, safe)) score -= SCORE.outside;
  if (p.pos.y < ctx.floor - 1e-6) score -= SCORE.underground;
  const f = p.look.clone().sub(p.pos).setY(0);
  if (f.lengthSq() > 1e-8) {
    f.normalize();
    if (f.z > 0) score -= SCORE.farSide * f.z;     // looking toward the player: the table is seen from behind
    if (f.x < 0) score -= SCORE.backward * -f.x;   // the road would run right to left
    if (ctx.prev) {
      const q = ctx.prev.clone().setY(0);
      if (q.lengthSq() > 1e-8 && q.normalize().dot(f) < -0.5) score -= SCORE.turnedAround;
    }
  }
  // Clutter in the picture, close to the camera: it fills the foreground and steals the eye.
  for (const c of ctx.clutter ?? []) {
    const q = project(p, lens, c.at);
    if (q.depth <= 0) continue;
    const ry = c.r / (q.depth * Math.tan(THREE.MathUtils.degToRad(lens.fov / 2))), rx = ry / lens.aspect;
    if (q.x + rx < -1 || q.x - rx > 1 || q.y + ry < -1 || q.y - ry > 1 || ry <= LOOM.from) continue;
    score -= SCORE.clutter * Math.min(1, (ry - LOOM.from) / (LOOM.full - LOOM.from));
  }
  const main = subjects.reduce((a, s) => ((s.weight ?? 1) > (a.weight ?? 1) ? s : a), subjects[0]);
  if (main) {
    const q = project(p, lens, main.at);
    const share = q.depth > 0 ? (2 * main.r / (q.depth * Math.tan(THREE.MathUtils.degToRad(lens.fov / 2)))) / (safe.y1 - safe.y0) : 0;
    score += SCORE.size * Math.min(1, share / 0.5);
  }
  return { score, blocked: [...blocked] };
}

/**
 * Tries every way of filming the event, from both sides, and keeps the one that shows it best.
 * Earlier specs are the ones meant for the event: they win unless something is wrong with them.
 */
export function chooseShot(specs: ShotSpec[], axis: THREE.Vector3, subjects: Subject[], safe: SafeFrame, lens: Lens, ctx: ScoreCtx): Scored | null {
  let best: Scored | null = null;
  specs.forEach((spec, i) => {
    for (const yaw of spec.yaw === 0 ? [0] : [spec.yaw, -spec.yaw]) {
      const pose = frame(shotDir(axis, yaw, spec.elev), subjects, safe, lens, spec.fill, spec.near, ctx.floor);
      const s = scoreShot(pose, subjects, safe, lens, ctx);
      const score = s.score + SCORE.order * (specs.length - i);
      if (!best || score > best.score + 1e-9) best = { spec, yaw, pose, score, blocked: s.blocked };
    }
  });
  return best;
}
