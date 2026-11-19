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
import { routeAt, type Route } from './route';
import type { JumpStunt } from './stunts';

/**
 * A ramp jump (Carnage at Devil's Run): the run up the ramp to its lip and the landing roll-out
 * last `climb` and `land` seconds at normal speed; the flight is a real parabola under `gravity`
 * (road spaces per second squared), so its length follows from the ramp and the distance. The
 * take-off angle is the ramp's own slope at the lip, kept between the two limits (radians). The
 * car touches down `short` spaces before the landing space's centre, but flies at least
 * `minFlight` spaces; in the air its nose never dips more than `maxDive` radians.
 */
export const JUMP = P.jump;
/**
 * How the car behaves in the air by jump length (the stunt die gives 1 to 4 spaces). `follow`: how
 * much the nose follows the flight path (0 = it keeps the ramp's tilt and drops tail first, as a car
 * too slow off a ramp does; 1 = a clean arc, nose down on the way down). `tail`: extra nose-up tilt
 * reached in the air (radians), so a short jump comes down on its rear wheels.
 */
export const JUMP_BY_SPACES = P.jump.bySpaces;
/** Lean of a one-wheel landing, natural wobble of a plain jump (radians), extra launch angle of a somersault. */
export const JUMP_LEAN = P.jump.lean, JUMP_WOBBLE = P.jump.wobble, JUMP_FLIP_LIFT = P.jump.flipLift;
/**
 * Slow motion in the middle of a stunt's flight (barrel roll, somersault): between `from` and `to`
 * (shares of the flight) the car's time runs at `speed`. Only while the director films.
 */
export const STUNT_SLOWMO = P.jump.slowMotion;
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
/** A car's box: half length, height, half width (world units); the origin is under its middle. */
export function carBox(o: THREE.Object3D): { half: number; high: number; halfW: number } {
  const size = o.userData.modelSize as THREE.Vector3 | undefined, space = TILE_W / 8;
  return { half: (size?.x ?? space * 0.6) / 2, high: size?.y ?? space * 0.25, halfW: (size?.z ?? space * 0.3) / 2 };
}
/** From a car's origin (under its middle) to its centre of mass, half its height up, for a tilt. */
export function comOffset(o: THREE.Object3D, pitch: number, roll: number): THREE.Vector3 {
  return new THREE.Vector3(0, carBox(o).high / 2, 0).applyEuler(new THREE.Euler(roll, 0, pitch, 'YXZ'));
}
/** Puts the car so that its centre of mass is at `com`, with the rotation it has now. */
export function placeByCom(o: THREE.Object3D, com: THREE.Vector3): void {
  o.position.copy(com).sub(new THREE.Vector3(0, carBox(o).high / 2, 0).applyQuaternion(o.quaternion));
}
/** World height of the lowest corner of the car's box, as the car stands now. */
export function lowestCorner(o: THREE.Object3D): number {
  const { half, high, halfW } = carBox(o);
  let low = Infinity;
  const c = new THREE.Vector3();
  for (const x of [-half, half]) for (const y of [0, high]) for (const z of [-halfW, halfW]) {
    c.set(x, y, z).applyQuaternion(o.quaternion);
    low = Math.min(low, o.position.y + c.y);
  }
  return low;
}
/** Length of a jump of `n` spaces when its car is not on the table (an estimate), in seconds at normal speed. */
export function jumpSeconds(n: number): number { return JUMP.climb + 0.5 + 0.1 * n + JUMP.land; }
/** A ramp jump in progress (drive() plays it): the path's key points and the time spent on it. */
export interface Jump {
  from: THREE.Vector3; lip: THREE.Vector3; touch: THREE.Vector3; to: THREE.Vector3;
  angle: number; flight: number; t: number; landed: boolean;
  /** Its spaces' behaviour (JUMP_BY_SPACES), and the tilt it had when it touched down. */
  style: { follow: number; tail: number }; touchPitch: number;
  /** Its stunt, which side it leans or rolls to (+1 / -1), and its roll when it touched down. */
  stunt: JumpStunt; side: number; touchRoll: number;
  /** A plain jump's own small wobble (radians of roll and of extra pitch). */
  wobble: number; nod: number;
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
    jp.t += dt;
    let pitch = 0, roll = 0;
    if (jp.t < JUMP.climb) {
      // 1. Up the ramp, speeding up, resting on its surface and tilted with it.
      // (Not from a dead stop: as the nose rises the car's centre would sway back.)
      const u = jp.t / JUMP.climb;
      o.position.lerpVectors(jp.from, jp.lip, u * (0.4 + 0.6 * u));
      const list = ramps(now);
      const y = rampSurfaceAt(list, o.position.x, o.position.z);
      o.position.y = Math.max(y ?? jp.from.y, jp.from.y);
      const back = rampSurfaceAt(list, o.position.x - 0.25 * space, o.position.z) ?? jp.from.y;
      pitch = Math.max(0, Math.atan2(o.position.y - back, 0.25 * space));
    } else if (jp.t < JUMP.climb + jp.flight) {
      // 2. The flight. The car's centre of mass flies a parabola from where it is at the lip to
      // where it will be on landing; the body turns about it at a steady rate, as a thrown body does.
      const T = jp.flight, t = jp.t - JUMP.climb, u = t / T;
      const vx = (jp.touch.x - jp.lip.x) / T, vy = vx * Math.tan(jp.angle);
      const grav = 2 * (jp.lip.y + vy * T - jp.touch.y) / (T * T);
      // Plain jumps: between keeping the ramp's tilt (tail first) and following the arc, by length.
      const path = Math.max(-JUMP.maxDive, Math.atan2(vy - grav * t, vx));
      const held = jp.angle + jp.style.tail * Math.sin(Math.min(1, u) * Math.PI / 2);
      pitch = held + (path - held) * jp.style.follow + jp.nod * Math.sin(u * Math.PI);
      roll = jp.wobble * Math.sin(u * Math.PI);
      if (jp.stunt === 'oneWheel') roll = jp.side * JUMP_LEAN * u;
      else if (jp.stunt === 'barrel') roll = jp.side * Math.PI * 2 * u;
      else if (jp.stunt === 'backflip') pitch = jp.angle + (Math.PI * 2 + 0.12 - jp.angle) * u;
      jp.touchPitch = pitch;
      jp.touchRoll = jp.stunt === 'barrel' ? 0 : roll;
      o.rotation.order = 'YXZ';
      o.rotation.set(roll, 0, pitch);
      const c0 = jp.lip.clone().add(comOffset(o, jp.angle, 0)), c1 = jp.touch.clone().add(comOffset(o, 0, 0));
      const vyc = ((c1.y - c0.y) + grav * T * T / 2) / T;
      placeByCom(o, new THREE.Vector3(c0.x + (c1.x - c0.x) * u, c0.y + vyc * t - grav * t * t / 2, c0.z + (c1.z - c0.z) * u));
    } else {
      // 3. Touch down: what is still tilted falls flat (faster and faster, then a small rebound)
      // while the car rolls on to the centre of its space.
      const u = Math.min(1, (jp.t - JUMP.climb - jp.flight) / JUMP.land), e = 1 - (1 - u) * (1 - u);
      if (!jp.landed) {
        jp.landed = true;
        impact(jp.touch, 0xd9b48a, 1.0);
        S.shakeUntil = now + 0.25;
      }
      const fall = (x: number): number => Math.cos(Math.min(1, x) * Math.PI / 2);
      const bounce = (x: number): number => (x > 1 ? Math.sin(Math.min(1, (x - 1) / 0.8) * Math.PI) : 0);
      const tp = Math.atan2(Math.sin(jp.touchPitch), Math.cos(jp.touchPitch)); // a somersault ends where it began
      pitch = tp * fall(u * 3.2) - Math.sign(tp) * Math.min(Math.abs(tp), 0.4) * 0.12 * bounce(u * 3.2);
      roll = jp.touchRoll * fall(u * 2.8) - jp.touchRoll * 0.2 * bounce(u * 2.8);
      o.rotation.order = 'YXZ';
      o.rotation.set(roll, 0, pitch);
      placeByCom(o, jp.touch.clone().lerp(jp.to, e).add(comOffset(o, 0, 0)));
      if (u >= 1) { delete o.userData.jump; o.position.copy(jp.to); pitch = 0; roll = 0; }
    }
    // Never into the ground (or the ramp): the lowest corner of the car's box stays on the floor.
    const under = rampSurfaceAt(ramps(now), o.position.x, o.position.z);
    const floor = Math.max(jp.to.y, under ?? -Infinity);
    o.rotation.order = 'YXZ';
    o.rotation.set(roll, 0, pitch);
    // (On the ramp the car lies along its slope: there it already rests on the surface.)
    if (jp.t >= JUMP.climb) { const low = lowestCorner(o); if (low < floor) o.position.y += floor - low; }
    o.userData.yaw = 0;
    o.userData.pitch = pitch;
    // Wheels spin with the distance covered.
    const rig = o.userData.rig as CarRig | undefined;
    if (rig) rig.update(dt, now, Math.hypot(o.position.x - before.x, o.position.z - before.z), 0, 0, 0, jp.landed || jp.t < JUMP.climb);
    applyGlow(o, now);
    return;
  }
  const tg = o.userData.target as THREE.Vector3 | undefined;
  const before = o.position.clone();
  // A Big Rig trailer on its hitch does not drive itself: the section ahead pulls it (hitchTrains).
  const hitched = !!o.userData.hitch;
  // A route through several spaces (route.ts): along its curve, speeding up at the start and slowing
  // down only at the end. Skipped beats (no playback) leave it, and the car goes to its target.
  const rt = o.userData.route as Route | undefined;
  if (rt && !S.playing) delete o.userData.route;
  if (rt && S.playing) {
    const v = DRIVE.speed * Math.min(1, 0.35 + rt.s * 1.5, 0.35 + (rt.len - rt.s) * 1.5);
    rt.s = Math.min(rt.len, rt.s + v * dt);
    const at = routeAt(rt, rt.s);
    o.position.x = at.pos.x; o.position.z = at.pos.z;
    o.userData.ground = rt.ground[at.seg];
    if (rt.s >= rt.len) delete o.userData.route;
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
    // On a route the curve already steers it: the nose follows the way and a motorcycle leans into it.
    const drift = o.userData.bike && !rt;
    const reach = DRIVE.maxYaw * (drift ? BIKE.drift : 1);
    if (drift) want *= BIKE.drift;
    if (o.userData.restYaw === undefined) want = Math.max(-reach, Math.min(reach, want));
  }
  const rate = speed > 0.4 ? DRIVE.turnRate * (hitched ? TRAILER_TURN : 1) : DRIVE.parkTurnRate;
  const turn = want - yaw;
  const newYaw = yaw + turn * Math.min(1, dt * rate);
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
  applyGlow(o, now);
}
