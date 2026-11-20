// The motions of a whole vehicle that are not driving or jumping (design/gdd/vehicle-motion.md §2):
// pushed off its space (slam, bump), hitting another, skidding (Stunned), tipping onto its side
// (out of action), falling into a pit. Each is a pose of the vehicle's root over time, with a plan;
// the springs and parts on top are the rig's (rig.ts). Values in `motion.moves`.
// Pure: no page, no scene (unit-tested in tests/unit/motion/).

import * as THREE from 'three';
import { P } from '../presentation';
import type { Moment, MotionKind, MotionPlan } from './plan';
import { smooth01 as ease } from './angles';

const M = P.motion.moves;

/** Where the vehicle's root stands: position, heading (yaw toward −z), pitch (nose up +), roll (left side up +). */
export interface RootPose { pos: THREE.Vector3; yaw: number; pitch: number; roll: number }

/** A root motion: its plan, its pose at any time, and a jolt its body takes at a moment (radians per second on its springs). */
export interface Move {
  kind: MotionKind;
  plan: MotionPlan;
  at: (t: number) => RootPose;
  /** At this moment (seconds) the body's springs take this push: pitch, roll. */
  jolt: { at: number; pitch: number; roll: number } | null;
  t: number;
}

const easeOut = (u: number): number => { const x = Math.max(0, Math.min(1, u)); return 1 - (1 - x) * (1 - x); };
const plan = (kind: MotionKind, seconds: number, extra: Moment[] = []): MotionPlan => ({ kind, seconds, moments: [...extra, { name: 'end', at: seconds }] });

/**
 * Pushed from `from` to `to` (a slam, a bump), keeping its heading: it slides away fast and slows,
 * hopping a little; its body rocks away from the blow. `space`: a road space, world units.
 */
export function pushMove(from: THREE.Vector3, to: THREE.Vector3, yaw: number, space: number): Move {
  const d = to.clone().sub(from);
  const slide = Math.max(0.15, d.length() / (M.pushSpeed * space));
  const seconds = slide + M.pushSettle;
  // The blow in the body's frame: forward (+x) dips the nose, to the left (−z) lifts the right side.
  const fwd = d.x * Math.cos(yaw) - d.z * Math.sin(yaw), left = -(d.x * Math.sin(yaw) + d.z * Math.cos(yaw));
  const n = Math.max(1e-6, Math.hypot(fwd, left));
  return {
    kind: 'push', plan: plan('push', seconds, [{ name: 'impact', at: 0 }]), t: 0,
    jolt: { at: 0, pitch: -M.pushKick * fwd / n, roll: -M.pushKick * left / n },
    at: t => {
      const u = t / slide;
      const pos = from.clone().lerp(to, easeOut(u));
      pos.y += Math.sin(Math.min(1, u) * Math.PI) * M.pushHop * space;
      return { pos, yaw, pitch: 0, roll: 0 };
    },
  };
}

/**
 * Hits toward `target` (the one it slams): it lunges `hit_lunge` spaces that way and comes back,
 * the blow landing a third of the way through; its nose dips with it.
 */
export function hitMove(from: THREE.Vector3, target: THREE.Vector3, yaw: number, space: number): Move {
  const dir = target.clone().sub(from).setY(0);
  dir.multiplyScalar(dir.lengthSq() > 1e-12 ? M.hitLunge * space / dir.length() : 0);
  const seconds = M.hitSeconds, impact = seconds / 3;
  return {
    kind: 'hit', plan: plan('hit', seconds, [{ name: 'impact', at: impact }]), t: 0,
    jolt: { at: impact, pitch: -M.hitKick, roll: 0 },
    at: t => {
      const k = t < impact ? ease(t / impact) : 1 - ease((t - impact) / (seconds - impact));
      return { pos: from.clone().addScaledVector(dir, k), yaw, pitch: 0, roll: 0 };
    },
  };
}

/** Skids (Stunned): swings `skid_angle` out of line to `side` (+1 left, −1 right) and back, sliding a little that way. */
export function skidMove(at: THREE.Vector3, yaw: number, side: number, space: number): Move {
  const seconds = M.skidSeconds;
  return {
    kind: 'skid', plan: plan('skid', seconds), t: 0, jolt: { at: 0, pitch: 0, roll: -side * 0.6 },
    at: t => {
      const s = Math.sin(Math.min(1, t / seconds) * Math.PI);
      const pos = at.clone();
      // Sideways is toward −z for the left of a car heading along yaw.
      pos.x += -Math.sin(yaw) * side * M.skidSlide * space * s;
      pos.z += -Math.cos(yaw) * side * M.skidSlide * space * s;
      return { pos, yaw: yaw + side * M.skidAngle * s, pitch: 0, roll: 0 };
    },
  };
}

/**
 * Tips onto its side (out of action, as the game shows it): rolls a quarter turn to `side`
 * (+1 onto its right side, −1 onto its left), hopping as it goes, and stays there resting on half
 * its width `halfW`; `high` is its height (world units).
 */
export function flipMove(at: THREE.Vector3, yaw: number, side: number, halfW: number, high: number): Move {
  const seconds = M.flipSeconds;
  return {
    kind: 'flip', plan: plan('flip', seconds), t: 0, jolt: null,
    at: t => {
      const f = ease(t / seconds);
      const pos = at.clone();
      pos.y += f * halfW + Math.sin(f * Math.PI) * high * M.flipHop;
      return { pos, yaw, pitch: 0, roll: side * f * Math.PI / 2 };
    },
  };
}

/** Falls into a pit at `pit`: rolls onto the hole in the first third, then drops `fall_depth` spaces, nose down. */
export function fallMove(from: THREE.Vector3, pit: THREE.Vector3, yaw: number, space: number): Move {
  const seconds = M.fallSeconds, roll = seconds / 3;
  return {
    kind: 'fall', plan: plan('fall', seconds, [{ name: 'impact', at: seconds }]), t: 0, jolt: null,
    at: t => {
      if (t < roll) return { pos: from.clone().lerp(pit, ease(t / roll)), yaw, pitch: 0, roll: 0 };
      const u = (t - roll) / (seconds - roll);
      const pos = pit.clone();
      pos.y -= u * u * M.fallDepth * space;
      return { pos, yaw, pitch: -M.fallTip * ease(u), roll: 0 };
    },
  };
}

/** The heading between `a` and `b` the short way round, at `u` (0 to 1). */
const turnTo = (a: number, b: number, u: number): number => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * u;
/** Where a road vehicle comes to rest: along the road (yaw 0). */
const REST_YAW = 0;

/**
 * Loses its grip on an oil slick: it slides from `from` to `to` turning `spin_turns` whole turns,
 * its path swinging out to `side` (+1 left, −1 right), and comes to rest along the road.
 */
export function spinMove(from: THREE.Vector3, to: THREE.Vector3, yaw: number, side: number, space: number): Move {
  const seconds = M.spinSeconds, d = to.clone().sub(from);
  const out = new THREE.Vector3(-d.z, 0, d.x).normalize().multiplyScalar(side * M.spinSwing * space);
  return {
    kind: 'spin', plan: plan('spin', seconds), t: 0, jolt: { at: 0, pitch: 0, roll: side * 0.8 },
    at: t => {
      const u = easeOut(t / seconds);
      const pos = from.clone().lerp(to, u).addScaledVector(out, Math.sin(u * Math.PI));
      // Whole turns and back along the road: the spin slows as the tyres bite again.
      const spin = side * M.spinTurns * Math.PI * 2 * u;
      return { pos, yaw: turnTo(yaw, REST_YAW, u) + spin, pitch: 0, roll: 0 };
    },
  };
}

/** Slides to its space with its nose swung out of line and back (a skid, Bald Tires, Loose Wiring, Dazed). */
export function slewMove(from: THREE.Vector3, to: THREE.Vector3, yaw: number, side: number): Move {
  const seconds = M.slewSeconds;
  return {
    kind: 'slew', plan: plan('slew', seconds), t: 0, jolt: { at: 0, pitch: 0, roll: side * 0.5 },
    at: t => {
      const u = t / seconds;
      return { pos: from.clone().lerp(to, ease(u)), yaw: turnTo(yaw, REST_YAW, ease(u)) + side * M.slewAngle * Math.sin(Math.min(1, u) * Math.PI), pitch: 0, roll: 0 };
    },
  };
}

/** Shaken to its space by a quake: a few hops, rocking as it goes. */
export function quakeMove(from: THREE.Vector3, to: THREE.Vector3, yaw: number, space: number, seed: number): Move {
  const seconds = M.quakeSeconds;
  return {
    kind: 'quake', plan: plan('quake', seconds), t: 0, jolt: null,
    at: t => {
      const u = Math.min(1, t / seconds), fade = 1 - u;
      const pos = from.clone().lerp(to, ease(u));
      pos.y += Math.abs(Math.sin(u * Math.PI * M.quakeHops)) * M.quakeHop * space * fade;
      const rock = M.quakeShake * fade;
      return { pos, yaw: turnTo(yaw, REST_YAW, ease(u)) + Math.sin(t * 31 + seed) * rock, pitch: Math.sin(t * 23 + seed * 2) * rock, roll: Math.sin(t * 27 + seed * 3) * rock };
    },
  };
}

/** Flung to its space on a high arc (Blastoff), nose up as it rises and down as it falls. */
export function hopMove(from: THREE.Vector3, to: THREE.Vector3, yaw: number, space: number): Move {
  const seconds = M.hopSeconds;
  return {
    kind: 'hop', plan: plan('hop', seconds, [{ name: 'impact', at: seconds }]), t: 0, jolt: { at: seconds, pitch: -0.9, roll: 0 },
    at: t => {
      const u = Math.min(1, t / seconds);
      const pos = from.clone().lerp(to, u);
      pos.y += 4 * u * (1 - u) * M.hopHigh * space;
      return { pos, yaw: turnTo(yaw, REST_YAW, u), pitch: (0.5 - u) * 0.6, roll: 0 };
    },
  };
}

/** One frame of a root motion: places and turns `o`. Returns the jolt due in this frame, if any, and `done`. */
export function stepMove(o: THREE.Object3D, mv: Move, dt: number): { jolt: { pitch: number; roll: number } | null; done: boolean } {
  const before = mv.t;
  mv.t = Math.min(mv.plan.seconds, mv.t + dt);
  const p = mv.at(mv.t);
  o.position.copy(p.pos);
  o.rotation.order = 'YXZ';
  o.rotation.set(p.roll, p.yaw, p.pitch);
  const j = mv.jolt && mv.jolt.at >= before && (mv.jolt.at < mv.t || (before === 0 && mv.jolt.at === 0)) ? mv.jolt : null;
  return { jolt: j ? { pitch: j.pitch, roll: j.roll } : null, done: mv.t >= mv.plan.seconds };
}
