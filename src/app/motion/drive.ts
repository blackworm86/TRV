// Driving a route (route.ts) as a motion command: its plan (how long it takes, when the car gets to
// each space) and one frame of it. The car goes along the route at the route's speed there, never
// slower than `motion.drive.min_speed`; its front wheels look `look_ahead` spaces ahead to steer.
// Pure: no page, no scene (unit-tested in tests/unit/motion/).

import * as THREE from 'three';
import { P } from '../presentation';
import { routeAt, type Route } from '../route';
import type { Moment, MotionPlan } from './plan';
import { wrapAngle as wrap } from './angles';

const M = P.motion.drive;
/** Time step the plan is worked out with: finer than any frame, so the plan matches the drive. */
const PLAN_DT = 1 / 240;

/** Heading difference wrapped to (-π, π]. */

/** Distance at which the car gets to the space of each move beat of the route. */
export function arrivals(r: Route): number[] {
  return r.frames.map((_, k) => (k + 1 < r.marks.length ? r.marks[k + 1] : r.len));
}

/**
 * The plan of driving route `r` from where it is now: seconds at normal speed and the moment the
 * car gets to each of its spaces. Worked out by driving it in small steps, as `stepDrive` will.
 */
export function planDrive(r: Route): MotionPlan {
  const goals = arrivals(r);
  const moments: Moment[] = [];
  let s = r.s, t = 0, k = goals.findIndex(g => g > s + 1e-9);
  if (k < 0) k = goals.length;
  // A bound on the steps, in case of a degenerate route: the length at the slowest speed.
  const cap = Math.ceil(r.len / (M.minSpeed * PLAN_DT)) + 1;
  for (let i = 0; i < cap && s < r.len; i++) {
    s = Math.min(r.len, s + Math.max(routeAt(r, s).v, M.minSpeed) * PLAN_DT);
    t += PLAN_DT;
    while (k < goals.length && s >= goals[k] - 1e-9) moments.push({ name: 'space', index: k++, at: t });
  }
  moments.push({ name: 'end', at: t });
  return { kind: 'drive', seconds: t, moments };
}

/** Where the car is after one frame on its route. */
export interface DriveSample {
  pos: THREE.Vector3;
  /** Nose heading (yaw toward −z, as cars.ts uses it). */
  yaw: number;
  /** How much the front wheels turn: the heading still to make toward the route a little ahead. */
  steer: number;
  /** Which of the route's spaces the car is heading for (its ground). */
  seg: number;
  /** True when it has got to the end. */
  done: boolean;
}

/** One frame of driving route `r` (`dt` game seconds; `space`: a road space's length, world units). Moves `r.s`. */
export function stepDrive(r: Route, dt: number, space: number): DriveSample {
  r.s = Math.min(r.len, r.s + Math.max(routeAt(r, r.s).v, M.minSpeed) * dt);
  const at = routeAt(r, r.s);
  const ahead = routeAt(r, r.s + space * M.lookAhead).yaw;
  return { pos: at.pos, yaw: at.yaw, steer: wrap(ahead - at.yaw), seg: at.seg, done: r.s >= r.len };
}

/**
 * How far a motorcycle leans into a turn (radians, + = toward the inside of a left turn): the balance
 * of a bike in a bend, atan(v·ω / g_lean), at most `motion.bike.lean_max`. `speed`: world units per
 * second; `yawRate`: radians per second (+ = turning left). As a roll (left side up +) it is −lean.
 */
export function bikeLean(speed: number, yawRate: number): number {
  const B = P.motion.bike;
  const lean = Math.atan((Math.abs(speed) * yawRate) / B.gLean);
  return Math.max(-B.leanMax, Math.min(B.leanMax, lean));
}
