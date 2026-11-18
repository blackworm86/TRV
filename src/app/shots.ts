// The camera director (design/gdd/camera-director.md): for each big event it works out what must
// be seen, where the screen is free, what stands in the way, and takes the shot that shows it best.
// The reckoning is src/view/camera/framing.ts (pure, unit-tested); this module feeds it the game:
// the subjects of each beat, the interface's rectangles, the pieces that can hide the action.
// director.ts still moves the camera along the shot and hands the view back.

import * as THREE from 'three';
import { COLS, ROWS, key, terrainAt, type Frame } from '../game/trv/engine';
import { chooseShot, frame, freeRect, shotDir, toFrame, type Blocker, type Pose, type Rect, type SafeFrame, type ShotSpec, type Subject } from '../view/camera/framing';
import { DIE_W, TRAY_SCALE, carObjs, chopperObjs, fxSupply } from './board';
import { chase } from './chase';
import { ACTION_BEATS, actionDone, directing, setShotFor, startShot } from './director';
import { g } from './game';
import { P } from './presentation';
import { settings } from './settings';
import type { ObstacleBlocker } from '../view/terrain/obstacles';
import { TILE_T, TILE_W, camera, renderer, tileSlots, world } from './stage';
import { S } from './state';
import { $, cssPx } from './util';

/**
 * The director's values (data/trv/presentation_base.json, `director`): `hold` seconds during which
 * a new event joins the shot being taken instead of cutting; `refresh` seconds between two looks at
 * the interface; `floor` the camera's lowest height; `subject` and `blocker` sizes; `shots` the ways
 * of filming each event, the first being the one meant for it. Lengths in road spaces, angles in degrees.
 */
const D = P.director;
const SP = TILE_W / 8;
const DEG = Math.PI / 180;
const ROAD = new THREE.Vector3(1, 0, 0);
/** The shots of an event, as the reckoning wants them (radians, world units). */
function specsOf(kind: string): ShotSpec[] {
  return (D.shots[kind] ?? D.shots.default).map(s => ({ id: s.id, yaw: s.yaw * DEG, elev: s.elev * DEG, fill: s.fill, near: (s.near ?? 2) * SP, ...(s.orbit ? { orbit: s.orbit * DEG } : {}) }));
}

/** A subject that may move while it is filmed (a car driving, tumbling, flying). */
interface Live { key: string; get: () => Subject }
/** The shot being taken: what it shows, how, and the choppers hidden because they were in the way. */
interface Take { kind: string; subjects: Live[]; axis: THREE.Vector3; spec: ShotSpec; yaw: number; t0: number; hide: number[] }
let take: Take | null = null;
/** For checks: the shot being taken (its kind, the spec chosen, the choppers it hides). */
export const takeNow = (): { kind: string; spec: string; hide: number[] } | null => take && { kind: take.kind, spec: take.spec.id, hide: take.hide };

let safeAt = -Infinity, safeNow: SafeFrame = { x0: -1, x1: 1, y0: -1, y1: 1 };
/**
 * The free part of the screen, as a rectangle of the picture: under the bar (the players' bubbles
 * fade out during a shot, so their band is free: director.ts, veil), over the player's strip, the drawer and the cards in hand, beside the panel of the
 * damage and the dice when it is up. Looked at again every `refresh` seconds.
 */
export function safeFrame(now: number, fresh = false): SafeFrame {
  if (!fresh && now - safeAt < D.refresh) return safeNow;
  safeAt = now;
  const W = innerWidth, H = innerHeight;
  const rect = (id: string): DOMRect | null => { const r = document.getElementById(id)?.getBoundingClientRect(); return r && r.width > 0 && r.height > 0 ? r : null; };
  const strip = rect('strip');
  const fixed: Rect[] = [
    { left: 0, top: 0, right: W, bottom: cssPx('--top') },
    { left: 0, top: strip ? strip.top : H - cssPx('--bottom'), right: W, bottom: H },
  ];
  const loose: Rect[] = [];
  const dock = $('cmddock'), rolls = $('rolls');
  if (dock.classList.contains('ask')) { const r = rect('cmddock'); if (r) loose.push(r); }
  if (rolls.classList.contains('show')) { const r = rect('rolls'); if (r) loose.push(r); }
  const hand = rect('hand'); if (hand) loose.push(hand);
  let free = freeRect(W, H, [...fixed, ...loose]);
  // Too little left (a huge panel on a small window): the band alone, the panels over the picture.
  if (free.right - free.left < W * 0.25 || free.bottom - free.top < H * 0.15) free = freeRect(W, H, fixed);
  safeNow = toFrame(free, W, H);
  return safeNow;
}

/** What can hide the action: the rocks of the impassable spaces, the vehicles, the choppers. */
function blockers(): Blocker[] {
  const out: Blocker[] = [], B = D.blocker;
  // The formations on the tiles say how much each of their spaces hides (terrain/obstacles.ts).
  const formed: Blocker[] = [];
  for (const grp of tileSlots) {
    for (const b of (grp?.userData.blockers as ObstacleBlocker[] | undefined) ?? []) {
      const w = grp!.localToWorld(new THREE.Vector3(b.x, b.h, b.z));
      formed.push({ x: w.x, z: w.z, r: b.r, h: w.y });
    }
  }
  if (g) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (terrainAt(g, { r, c }) !== 'X' || g.hazards.get(key({ r, c }))?.type === 'pit_trap') continue;
      const w = world({ r, c });
      // An impassable space with no formation on it (the flat look) hides as much as a rock of the data.
      const own = formed.find(b => Math.hypot(b.x - w.x, b.z - w.z) < SP * 0.5);
      out.push(own ? { ...own, id: `rock:${r},${c}` } : { x: w.x, z: w.z, r: B.rockR * SP, h: TILE_T + B.rockH * SP, id: `rock:${r},${c}` });
    }
  }
  for (const [id, o] of carObjs) if (o.visible) out.push({ x: o.position.x, z: o.position.z, r: B.carR * SP, h: o.position.y + B.carH * SP, id: `car:${id}` });
  for (const [k, o] of chopperObjs) out.push({ x: o.position.x, z: o.position.z, r: B.chopperR * SP, y0: o.position.y - 0.3 * SP, h: o.position.y + 0.6 * SP, id: `chopper:${k}` });
  return out;
}

/** The effect dice lying by the road: they hide nothing, but a low camera behind them fills the picture with them. */
function clutter(): Subject[] {
  return [...fxSupply.values()].map(t => ({ at: t.d.mesh.position.clone(), r: DIE_W * TRAY_SCALE * 0.75 }));
}

/** A still subject: a space of the road, or a point above it. */
function point(at: THREE.Vector3, r: number, weight = 1, lift = 0): Live {
  const p = at.clone().add(new THREE.Vector3(0, (lift + r * 0.4) * SP, 0));
  return { key: `at:${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`, get: () => ({ at: p, r: r * SP, weight }) };
}
/** A vehicle, followed wherever it goes (kept when it is destroyed and leaves the table). */
function car(id: string, fallback: THREE.Vector3, r: number, weight = 1): Live {
  const o = carObjs.get(id);
  return { key: `car:${id}`, get: () => ({ at: (o ? o.position.clone() : fallback.clone()).add(new THREE.Vector3(0, r * 0.4 * SP, 0)), r: r * SP, weight }) };
}

/** What a beat must show, and the way its action goes. */
function subjectsOf(f: Frame): { subjects: Live[]; axis: THREE.Vector3 } | null {
  const R = D.subject;
  const at = f.at ? world(f.at) : f.vehicleId ? carObjs.get(f.vehicleId)?.position.clone() : undefined;
  if (!at) return null;
  const who = (r: number, w = 1): Live => (f.vehicleId ? car(f.vehicleId, at, r, w) : point(at, r, w));
  switch (f.kind) {
    case 'shot': {
      const from = f.from ? world(f.from) : at;
      return { subjects: [point(from, R.car), f.vehicleId ? car(f.vehicleId, at, R.car, 2) : point(at, R.car, 2)], axis: at.clone().sub(from) };
    }
    case 'slam': return { subjects: [point(at, R.slam, 2)], axis: ROAD };
    case 'jump': {
      const from = f.from ? world(f.from) : at;
      return { subjects: [point(from, R.car), point(at, R.car), who(R.car, 2)], axis: at.clone().sub(from) };
    }
    // The sand worm: the whole show, the worm out of the ground and the car thrown over its mouth (2026-11-18).
    case 'elim': if (f.by === 'sand_worm') return { subjects: [point(at, R.worm, 2, R.wormUp)], axis: ROAD };
      return { subjects: [who(R.close, 2), ...(f.into ? [point(world(f.into), R.car * 0.7)] : [])], axis: ROAD };
    case 'chopper': return { subjects: [point(at, R.chopper, 2), point(at, R.car, 1, R.chopperUp)], axis: ROAD };
    case 'damage': case 'fire': return { subjects: [who(R.close)], axis: ROAD };
    default: return null;
  }
}

/** Takes the best shot of `subjects` among those meant for `kind`. */
function begin(kind: string, subjects: Live[], axis: THREE.Vector3, now: number): void {
  const lens = (): { fov: number; aspect: number } => ({ fov: camera.fov, aspect: camera.aspect });
  const floor = TILE_T + D.floor * SP;
  // A cut from another shot should not turn the scene around; from the map any side is fine.
  const prev = S.shot ? camera.getWorldDirection(new THREE.Vector3()) : undefined;
  if (!chase) camera.clearViewOffset(); // the subjects are centred in the free part by the framing itself
  const best = chooseShot(specsOf(kind), axis, subjects.map(s => s.get()), safeFrame(now, true), lens(), { blockers: blockers(), floor, ...(kind === 'dice' ? {} : { clutter: clutter() }), ...(prev ? { prev } : {}) });
  if (!best) return;
  const tk: Take = {
    kind, subjects, axis: axis.clone(), spec: best.spec, yaw: best.yaw, t0: now,
    hide: best.blocked.filter(b => b.id?.startsWith('chopper:')).map(b => Number(b.id!.slice(8))),
  };
  take = tk;
  let memo: { t: number; p: Pose } | null = null;
  const pose = (t: number): Pose => {
    if (memo?.t === t) return memo.p;
    const yaw = tk.yaw + Math.sign(tk.yaw || 1) * (tk.spec.orbit ?? 0) * (t - tk.t0);
    const p = frame(shotDir(tk.axis, yaw, tk.spec.elev), tk.subjects.map(s => s.get()), safeFrame(t), lens(), tk.spec.fill, tk.spec.near, floor);
    memo = { t, p };
    return p;
  };
  startShot(t => pose(t).pos, t => pose(t).look, false);
}

/** Films a beat of the game, if it is one the director films. */
export function filmBeat(f: Frame): void {
  if (!directing() || !ACTION_BEATS.has(f.kind)) return;
  const made = subjectsOf(f);
  if (!made) return;
  setShotFor(f.kind);
  const now = performance.now() / 1000;
  // The sand worm has a shot of its own, never merged into another.
  if (f.kind === 'elim' && f.by === 'sand_worm') { begin('worm', made.subjects, made.axis, now); return; }
  // Events one right after the other stay in one shot, which widens to hold them: no flurry of cuts.
  if (take && S.shot && now - take.t0 < D.hold) {
    for (const s of made.subjects) if (!take.subjects.some(x => x.key === s.key)) take.subjects.push(s);
    return;
  }
  begin(f.kind, made.subjects, made.axis, now);
}

/** A shot on dice lying on the table (a question about them). */
export function filmDice(at: THREE.Vector3[]): void {
  if (!directing() || !at.length) return;
  begin('dice', at.map(p => point(p, D.subject.die)), ROAD, performance.now() / 1000);
}

/** Each frame: a chopper that would hide the shot's subjects stays out of the picture. */
export function shotsTick(): void {
  if (!S.shot) { take = null; return; }
  if (take) for (const k of take.hide) { const o = chopperObjs.get(k); if (o) o.visible = false; }
}

// The player's hand comes first: touching the table during a shot gives the view back at once.
for (const ev of ['pointerdown', 'wheel'] as const) {
  renderer.domElement.addEventListener(ev, () => { if (S.shot && settings.director2) actionDone(); }, { passive: true });
}
