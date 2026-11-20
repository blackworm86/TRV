// Cars on the move: driving along the road and onto ramps, and the ramp jump with its stunts.

import * as THREE from 'three';
import { rampSurfaceAt } from '../view/terrain/carnage3d';
import { BIKE, CarRig } from '../view/models-config';
import { carObjs } from './board';
import { directing } from './director';
import { impact } from './effects';
import { held } from './keys';
import { applyGlow, driveGun } from './pieces';
import { P } from './presentation';
import { TILE_T, TILE_W, scene } from './stage';
import { S } from './state';
import type { Route } from './route';
import { stepDrive } from './motion/drive';
import { JUMP, STUNT_SLOWMO, stepJump, type Jump } from './motion/jump';
import { MotionTrack } from './motion/plan';
import { stepMove, type Move } from './motion/moves';
import type { PartsRig } from './motion/rig';

/** A trailer turns to its heading this much slower than a car steers: it follows, it is not driven. */
const TRAILER_TURN = 0.4;
/** Farther than this from its hitch (world units), a trailer coming in from the starting area slides onto it. */
const HITCH_SNAP = 0.4;
/** Rate at which a trailer slides onto its hitch from farther than HITCH_SNAP (per second). */
const HITCH_RATE = 12;

/**
 * Keeps each Big Rig trailer on the rear hitch of the section ahead (pieces.ts sets `userData.hitch`
 * when both are on the road): its front hitch goes where the one ahead has its rear hitch, at its own
 * heading. Front to back, after every car has driven this frame.
 */
export function hitchTrains(objs: Iterable<THREE.Object3D>, dt: number): void {
  type Hitch = { ahead: THREE.Object3D; half: number; order: number };
  const list = [...objs].filter(o => o.userData.hitch).sort((a, b) => (a.userData.hitch as Hitch).order - (b.userData.hitch as Hitch).order);
  for (const o of list) {
    const h = o.userData.hitch as Hitch, a = h.ahead;
    const ya = (a.userData.yaw ?? 0) as number, yo = (o.userData.yaw ?? 0) as number;
    const x = a.position.x - h.half * (Math.cos(ya) + Math.cos(yo)), z = a.position.z + h.half * (Math.sin(ya) + Math.sin(yo));
    const far = Math.hypot(x - o.position.x, z - o.position.z);
    const k = far > HITCH_SNAP ? 1 - Math.exp(-dt * HITCH_RATE) : 1;
    const mx = (x - o.position.x) * k, mz = (z - o.position.z) * k;
    o.position.x += mx;
    o.position.z += mz;
    // How fast it was pulled: the next frame's drive turns it and spins its wheels with it.
    o.userData.hitchSpeed = Math.hypot(mx, mz) / Math.max(dt, 1e-4);
  }
}

/** The time factor now for the cars: slower while a stunt is in its slow-motion part. */
export function carTimeScale(): number {
  if (!directing()) return 1;
  for (const o of carObjs.values()) {
    const j = o.userData.jump as Jump | undefined;
    if (!j || (j.stunt !== 'barrel' && j.stunt !== 'backflip')) continue;
    const u = (j.t - JUMP.climb) / j.flight;
    if (u > STUNT_SLOWMO.from && u < STUNT_SLOWMO.to) return STUNT_SLOWMO.speed;
  }
  return 1;
}
/** A vehicle's motion state (motion/plan.ts): the command it runs and whether it is over. */
export function track(o: THREE.Object3D): MotionTrack {
  return (o.userData.motion ??= new MotionTrack()) as MotionTrack;
}

/** The ramps in the scene, looked up again at most once a second (the board is rebuilt as tiles change). */
export let rampCache: { at: number; list: THREE.Object3D[]; spots: THREE.Vector3[] } = { at: -1, list: [], spots: [] };
export function ramps(now: number): THREE.Object3D[] {
  if (now - rampCache.at > 1) {
    const list: THREE.Object3D[] = [];
    scene.traverse(o => { if (o.userData.ramp) list.push(o); });
    rampCache = { at: now, list, spots: list.map(o => o.getWorldPosition(new THREE.Vector3())) };
  }
  return rampCache.list;
}
/** Whether a ramp stands within about a space of world point `p` (a car needs its surface only there). */
export function nearRamp(p: THREE.Vector3, now: number): boolean {
  const space = TILE_W / 8;
  ramps(now);
  return rampCache.spots.some(r => Math.abs(r.x - p.x) < space * 1.1 && Math.abs(r.z - p.z) < space * 0.7);
}

/**
 * Turns a model's turret toward the car's target (`userData.aim`, a world heading, null at rest),
 * at the turret's own speed (its `speed` extra, radians per second), within its arc. A turret mounted
 * facing another way (its `facing` extra, radians from the nose: the Big Rig's rear gun faces
 * backward) has its zero and its arc there.
 */
function aimTurret(o: THREE.Object3D, carYaw: number, dt: number): void {
  const t = (o.userData.model as THREE.Object3D | undefined)?.getObjectByName('turret');
  if (!t) return;
  const aim = o.userData.aim as number | null | undefined;
  let want = aim === null || aim === undefined ? 0 : aim - carYaw - ((t.userData.facing as number | undefined) ?? 0);
  const arc = t.userData.arc as [number, number] | undefined;
  want = Math.atan2(Math.sin(want), Math.cos(want));
  if (arc) want = Math.max(arc[0], Math.min(arc[1], want));
  const d = Math.atan2(Math.sin(want - t.rotation.y), Math.cos(want - t.rotation.y));
  const speed = (t.userData.speed as number | undefined) ?? 2.5;
  t.rotation.y += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
}

/** Car speed on the table (world units per second) and how fast it turns to face its way. */
export const DRIVE = P.drive;
/**
 * One frame of a car: it drives to its target at a steady speed, facing the way it goes
 * (backwards when pushed back), turns back along the road once parked; wheels and body follow.
 */
export function drive(o: THREE.Object3D, dt: number, k: number, now: number): void {
  // A ramp jump (Carnage at Devil's Run), in three phases; the nose always follows the path.
  const jp = o.userData.jump as Jump | undefined;
  if (jp) {
    const space = TILE_W / 8;
    const before = o.position.clone();
    const list = ramps(now);
    const { done } = stepJump(o, jp, dt, {
      space, surfaceAt: (x, z) => rampSurfaceAt(list, x, z),
      onTouch: at => { impact(at, 0xd9b48a, 1.0); S.shakeUntil = now + 0.25; },
    });
    if (done) delete o.userData.jump;
    track(o).advance(dt, done);
    // Wheels spin with the distance covered.
    const rig = o.userData.rig as CarRig | undefined;
    if (rig) rig.update(dt, now, Math.hypot(o.position.x - before.x, o.position.z - before.z), 0, 0, 0, jp.landed || jp.t < JUMP.climb);
    (o.userData.parts as PartsRig | undefined)?.update(dt, Math.hypot(o.position.x - before.x, o.position.z - before.z), 0, 0, 0);
    applyGlow(o, now);
    return;
  }
  // A move it did not drive (a push, a spin, a quake...: beats.ts shoveOf), its root posed by the move.
  const mv = o.userData.shove as Move | undefined;
  if (mv && !S.playing) delete o.userData.shove;
  else if (mv) {
    const before = o.position.clone();
    const { jolt, done } = stepMove(o, mv, dt);
    // The heading it is left with, the short way round, for driving on from there.
    o.userData.yaw = Math.atan2(Math.sin(o.rotation.y), Math.cos(o.rotation.y));
    const dist = Math.hypot(o.position.x - before.x, o.position.z - before.z);
    const rig = o.userData.rig as CarRig | undefined, parts = o.userData.parts as PartsRig | undefined;
    if (jolt) { rig?.jolt(jolt.pitch, jolt.roll); parts?.jolt(jolt.pitch, jolt.roll); }
    rig?.update(dt, now, dist, 0, 0, 0, !o.userData.wreck);
    if (parts) { o.updateMatrixWorld(true); parts.update(dt, dist, 0, 0, 0); }
    if (done) { delete o.userData.shove; o.userData.lastV = 0; }
    applyGlow(o, now);
    return;
  }
  const tg = o.userData.target as THREE.Vector3 | undefined;
  const before = o.position.clone();
  // A Big Rig trailer on its hitch does not drive itself: the section ahead pulls it (hitchTrains).
  const hitched = !!o.userData.hitch;
  // Driving forward on a route (route.ts): at the speed the route sets there, the nose along the way,
  // the front wheels steered to where the route goes next. Skipped beats (no playback) leave it, and
  // the car goes to its target.
  const rt = o.userData.route as Route | undefined;
  if (rt && !S.playing) { delete o.userData.route; track(o).finish(); }
  let routeYaw: number | null = null, routeSteer = 0;
  if (rt && S.playing) {
    const at = stepDrive(rt, dt, TILE_W / 8);
    o.position.x = at.pos.x; o.position.z = at.pos.z;
    o.userData.ground = rt.ground[at.seg];
    routeYaw = at.yaw;
    routeSteer = at.steer;
    if (at.done) delete o.userData.route;
    track(o).advance(dt, at.done);
  } else if (tg && !hitched) {
    const dx = tg.x - o.position.x, dz = tg.z - o.position.z;
    const dist = Math.hypot(dx, dz);
    const step = Math.min(dist, DRIVE.speed * dt * Math.min(1, 0.35 + dist * 1.5));
    if (dist > 1e-4) { o.position.x += dx / dist * step; o.position.z += dz / dist * step; }
  }
  const vx = (o.position.x - before.x) / Math.max(dt, 1e-4), vz = (o.position.z - before.z) / Math.max(dt, 1e-4);
  const speed = hitched ? (o.userData.hitchSpeed ?? 0) as number : Math.hypot(vx, vz);
  const yaw = (o.userData.yaw ?? 0) as number;
  // Heading: +x is along the road; yaw turns toward -z (three.js convention).
  // At rest a car stands along the road; a Big Rig section keeps the heading it came in with (pieces.ts).
  let want = (o.userData.restYaw ?? 0) as number, reverse = false;
  // A trailer turns to the heading its hitches give it as it is pulled along.
  if (!hitched && speed > 0.4) {
    want = Math.atan2(-vz, vx);
    if (Math.abs(want) > Math.PI * 0.6) { want = want > 0 ? want - Math.PI : want + Math.PI; reverse = true; }
    // A lane change is a diagonal step: the car steers into it, it does not turn sideways.
    // (A Big Rig section only goes forward or into the next lane: it follows its step as it is.)
    // A motorcycle swings its rear out further than its path: it drifts into the lane (BIKE.drift).
    const drift = o.userData.bike;
    const reach = DRIVE.maxYaw * (drift ? BIKE.drift : 1);
    if (drift) want *= BIKE.drift;
    if (o.userData.restYaw === undefined) want = Math.max(-reach, Math.min(reach, want));
  }
  const rate = speed > 0.4 ? DRIVE.turnRate * (hitched ? TRAILER_TURN : 1) : DRIVE.parkTurnRate;
  // On a route the nose is the route's; the wheels look ahead along it.
  const turn = routeYaw !== null ? routeSteer : want - yaw;
  const newYaw = routeYaw ?? yaw + turn * Math.min(1, dt * rate);
  o.userData.yaw = newYaw;
  driveGun(o, newYaw, dt);
  // Tip over the long axis onto one side; while tipping it hops.
  const f = (o.userData.flipNow ?? 0) + (((o.userData.flip ?? 0) - (o.userData.flipNow ?? 0)) * k * 0.7);
  o.userData.flipNow = f;
  // On a ramp (Carnage at Devil's Run) the car rests on its surface, nose tilted up with it.
  const list = ramps(now);
  let rampY: number | null = null, rampPitch = 0;
  if (list.length && nearRamp(o.position, now)) {
    const half = ((o.userData.modelSize as THREE.Vector3 | undefined)?.x ?? TILE_W / 8 * 0.6) / 2;
    const front = rampSurfaceAt(list, o.position.x + half, o.position.z), back = rampSurfaceAt(list, o.position.x - half, o.position.z);
    const mid = rampSurfaceAt(list, o.position.x, o.position.z);
    // Only its tail still over the ramp: the car has left it (a long car landed one space on) and stands flat.
    if (front !== null || mid !== null) {
      const base = tg?.y ?? TILE_T;
      const fy = Math.max(front ?? base, base), by = Math.max(back ?? base, base);
      rampY = Math.max(mid ?? base, (fy + by) / 2);
      rampPitch = Math.atan2(fy - by, 2 * half);
    }
  }
  const pitchNow = (o.userData.pitch ?? 0) + (rampPitch - (o.userData.pitch ?? 0)) * Math.min(1, dt * 12);
  o.userData.pitch = pitchNow;
  // A motorcycle leans into its turns, more the faster it goes (asked by the user, 2026-11-18).
  let lean = 0;
  if (o.userData.bike && f < 0.3) {
    const yawRate = (newYaw - yaw) / Math.max(dt, 1e-4);
    // Turning right (yaw falling, toward +z) tips its top toward +z: a positive roll about the nose.
    const to = Math.max(-BIKE.maxLean, Math.min(BIKE.maxLean, -yawRate * Math.min(speed, BIKE.speedCap) * BIKE.lean));
    lean = (o.userData.lean ?? 0) + (to - (o.userData.lean ?? 0)) * Math.min(1, dt * BIKE.leanRate);
    o.userData.lean = lean;
  }
  o.rotation.order = 'YXZ';
  o.rotation.set(f * (o.userData.flipSide ?? 1) * Math.PI / 2 + lean, newYaw, pitchNow);
  const h = o.userData.height ?? 0.5;
  // On its side it rests on half its width; while tipping it hops.
  const halfW = ((o.userData.modelSize as THREE.Vector3 | undefined)?.z ?? h) / 2;
  o.position.y = Math.max(tg?.y ?? TILE_T, rampY ?? -Infinity) + f * halfW + Math.sin(f * Math.PI) * h * 0.8;
  const rig = o.userData.rig as CarRig | undefined;
  if (rig) {
    const fwd = speed * dt * (reverse ? -1 : 1);
    const v = fwd / Math.max(dt, 1e-4);
    const accel = (v - (o.userData.lastV ?? 0)) / Math.max(dt, 1e-4);
    o.userData.lastV = v;
    rig.update(dt, now, fwd, accel, turn, (newYaw - yaw) / Math.max(dt, 1e-4), !o.userData.wreck && !o.userData.trailer && f < 0.3);
  }
  // A model in parts (the test car): its own rig, and its turret turning to its target.
  const parts = o.userData.parts as PartsRig | undefined;
  if (parts) {
    const fwd = speed * dt * (reverse ? -1 : 1);
    const v = fwd / Math.max(dt, 1e-4);
    const accel = (v - (o.userData.lastV ?? 0)) / Math.max(dt, 1e-4);
    o.userData.lastV = v;
    o.updateMatrixWorld(true);
    parts.update(dt, fwd, accel, turn, (newYaw - yaw) / Math.max(dt, 1e-4));
    aimTurret(o, newYaw, dt);
  }
  applyGlow(o, now);
}
