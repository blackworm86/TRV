// A ramp jump (Carnage at Devil's Run) as a motion command: how it is laid out from the ramp's
// surface, its plan, and one frame of it. The run up the ramp to its lip and the landing roll-out
// last `climb` and `land` seconds at normal speed; the flight is a real parabola under `gravity`
// (road spaces per second squared), so its length follows from the ramp and the distance. The
// take-off angle is the ramp's own slope at the lip, kept between the two limits (radians). The
// car touches down `short` spaces before the landing space's centre, but flies at least
// `minFlight` spaces; in the air its nose never dips more than `maxDive` radians.
// Pure: the ramp's surface comes in as a function (unit-tested in tests/unit/motion/).

import * as THREE from 'three';
import { P } from '../presentation';
import { hash01, pickStunt, type JumpStunt } from '../stunts';
import { comOffset, lowestCorner, placeByCom } from './body';
import type { MotionPlan } from './plan';

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

/** A ramp jump in progress: the path's key points and the time spent on it. */
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

/** Where the jump happens: a road space's length (world units) and the ramps' surface height at a point, or null off them. */
export interface JumpEnv { space: number; surfaceAt: (x: number, z: number) => number | null }

/** What a jump is made from: where the car is, the ramp's space, the landing space, how many spaces, a seed for its stunt. */
export interface JumpSetup { from: THREE.Vector3; rampAt: THREE.Vector3; to: THREE.Vector3; spaces: number; seed: string; stunt?: JumpStunt }

/**
 * Lays out a jump: the car runs up to the ramp's lip, flies on the arc the ramp's slope gives it and
 * lands short of the space, then rolls forward to its centre: never back.
 */
export function makeJump(j: JumpSetup, env: JumpEnv): Jump {
  const { space } = env, { rampAt, to } = j;
  // The lip: the far end of the ramp's surface along the road, and its slope there.
  let lip = new THREE.Vector3(rampAt.x + space * 0.3, rampAt.y + space * 0.3, rampAt.z), slope = JUMP.maxAngle;
  for (let k = 0.5; k >= 0; k -= 0.02) {
    const y = env.surfaceAt(rampAt.x + k * space, rampAt.z);
    if (y === null) continue;
    const back = env.surfaceAt(rampAt.x + (k - 0.12) * space, rampAt.z) ?? y;
    lip = new THREE.Vector3(rampAt.x + k * space, y, rampAt.z);
    slope = Math.atan2(y - back, 0.12 * space);
    break;
  }
  // Touch down a little short of the centre and roll on; a short jump lands on the centre.
  const touchX = Math.max(lip.x + JUMP.minFlight * space, to.x - JUMP.short * space);
  const touch = touchX >= to.x ? to.clone() : to.clone().setX(touchX);
  const angle = Math.max(JUMP.minAngle, Math.min(JUMP.maxAngle, slope));
  // The flight time a body thrown at that angle needs to come down on the touch point.
  const rise = (touch.x - lip.x) * Math.tan(angle) - (touch.y - lip.y);
  const flight = Math.sqrt(2 * Math.max(rise, 0.05 * space) / (JUMP.gravity * space));
  const n = Math.max(1, Math.min(4, j.spaces));
  const stunt = j.stunt ?? pickStunt(n, hash01(j.seed));
  // A somersault needs a steeper launch, so more time in the air.
  const launch = stunt === 'backflip' ? Math.min(angle + JUMP_FLIP_LIFT, 1.1) : angle;
  const lift = (touch.x - lip.x) * Math.tan(launch) - (touch.y - lip.y);
  const air = stunt === 'backflip' ? Math.sqrt(2 * Math.max(lift, 0.05 * space) / (JUMP.gravity * space)) : flight;
  return {
    from: j.from.clone(), lip, touch, to: to.clone(), angle: launch, flight: air, t: 0, landed: false, style: JUMP_BY_SPACES[n], touchPitch: 0,
    stunt, side: hash01(`${j.seed}|side`) < 0.5 ? 1 : -1, touchRoll: 0,
    wobble: (hash01(`${j.seed}|wobble`) * 2 - 1) * JUMP_WOBBLE, nod: (hash01(`${j.seed}|nod`) * 2 - 1) * JUMP_WOBBLE,
  };
}

/** Length of a jump of `n` spaces when its car is not on the table (an estimate), in seconds at normal speed. */
export function jumpEstimate(n: number): number { return JUMP.climb + 0.5 + 0.1 * n + JUMP.land; }

/** Extra seconds a stunt's slow motion adds to its flight (while the director films). */
export function slowMotionExtra(jp: Jump, filmed: boolean): number {
  return filmed && (jp.stunt === 'barrel' || jp.stunt === 'backflip')
    ? jp.flight * (STUNT_SLOWMO.to - STUNT_SLOWMO.from) * (1 / STUNT_SLOWMO.speed - 1) : 0;
}

/** The plan of a jump: up the ramp, the take-off at the lip, the flight, the touch-down, the roll-out. */
export function planJump(jp: Jump, filmed = false): MotionPlan {
  const lip = JUMP.climb, touch = lip + jp.flight + slowMotionExtra(jp, filmed), end = touch + JUMP.land;
  return { kind: 'jump', seconds: end, moments: [{ name: 'lip', at: lip }, { name: 'touch', at: touch }, { name: 'end', at: end }] };
}

/**
 * One frame of a jump, in three phases; the nose always follows the path. Places and turns `o`
 * (pitch and roll in `o.userData`, yaw along the road). `onTouch` runs once, when it touches down.
 * Returns its pitch and roll, and `done` once it has rolled out onto its space.
 */
export function stepJump(o: THREE.Object3D, jp: Jump, dt: number, env: JumpEnv & { onTouch: (at: THREE.Vector3) => void }): { pitch: number; roll: number; done: boolean } {
  const { space } = env;
  jp.t += dt;
  let pitch = 0, roll = 0, done = false;
  if (jp.t < JUMP.climb) {
    // 1. Up the ramp, speeding up, resting on its surface and tilted with it.
    // (Not from a dead stop: as the nose rises the car's centre would sway back.)
    const u = jp.t / JUMP.climb;
    o.position.lerpVectors(jp.from, jp.lip, u * (0.4 + 0.6 * u));
    const y = env.surfaceAt(o.position.x, o.position.z);
    o.position.y = Math.max(y ?? jp.from.y, jp.from.y);
    const back = env.surfaceAt(o.position.x - 0.25 * space, o.position.z) ?? jp.from.y;
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
    const c0 = jp.lip.clone().add(comOffset(o, jp.angle, 0, space)), c1 = jp.touch.clone().add(comOffset(o, 0, 0, space));
    const vyc = ((c1.y - c0.y) + grav * T * T / 2) / T;
    placeByCom(o, new THREE.Vector3(c0.x + (c1.x - c0.x) * u, c0.y + vyc * t - grav * t * t / 2, c0.z + (c1.z - c0.z) * u), space);
  } else {
    // 3. Touch down: what is still tilted falls flat (faster and faster, then a small rebound)
    // while the car rolls on to the centre of its space.
    const u = Math.min(1, (jp.t - JUMP.climb - jp.flight) / JUMP.land), e = 1 - (1 - u) * (1 - u);
    if (!jp.landed) {
      jp.landed = true;
      env.onTouch(jp.touch);
    }
    const fall = (x: number): number => Math.cos(Math.min(1, x) * Math.PI / 2);
    const bounce = (x: number): number => (x > 1 ? Math.sin(Math.min(1, (x - 1) / 0.8) * Math.PI) : 0);
    const tp = Math.atan2(Math.sin(jp.touchPitch), Math.cos(jp.touchPitch)); // a somersault ends where it began
    pitch = tp * fall(u * 3.2) - Math.sign(tp) * Math.min(Math.abs(tp), 0.4) * 0.12 * bounce(u * 3.2);
    roll = jp.touchRoll * fall(u * 2.8) - jp.touchRoll * 0.2 * bounce(u * 2.8);
    o.rotation.order = 'YXZ';
    o.rotation.set(roll, 0, pitch);
    placeByCom(o, jp.touch.clone().lerp(jp.to, e).add(comOffset(o, 0, 0, space)), space);
    if (u >= 1) { done = true; o.position.copy(jp.to); pitch = 0; roll = 0; }
  }
  // Never into the ground (or the ramp): the lowest corner of the car's box stays on the floor.
  const under = env.surfaceAt(o.position.x, o.position.z);
  const floor = Math.max(jp.to.y, under ?? -Infinity);
  o.rotation.order = 'YXZ';
  o.rotation.set(roll, 0, pitch);
  // (On the ramp the car lies along its slope: there it already rests on the surface.)
  if (jp.t >= JUMP.climb) { const low = lowestCorner(o, space); if (low < floor) o.position.y += floor - low; }
  o.userData.yaw = 0;
  o.userData.pitch = pitch;
  return { pitch, roll, done };
}
