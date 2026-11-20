// Aiming and firing a gun on a turret, as a motion command (design/gdd/vehicle-motion.md: aim/fire):
// the turret turns and the gun rises toward the target together, each at its speed (the turret's
// own `speed` extra, or `motion.aim.speed`; `motion.aim.elev_speed`), within their limits (the
// model's `arc` and `elev`); then the rounds, `gap` seconds apart, each kicking the barrel back by
// the model's `kick` and letting it come back in `recoil` seconds; after `hold` seconds the gun
// turns back to rest. The plan's moments are `aimed`, each `shot` and `end`.
// Pure: no page, no scene (unit-tested in tests/unit/motion/).

import * as THREE from 'three';
import { P } from '../presentation';
import type { TurretPart } from '../../view/vehicle-rig';
import type { Moment, MotionPlan } from './plan';

const A = P.motion.aim;

/**
 * Which piece of a Big Rig fires at a target. The rules count every shot of the rig from its
 * tractor's space, over the tractor's front arc and the rear section's rear arc; on the table the
 * rear arc is the rear gun's: the rear section fires when the target is nearer to it than to the tractor.
 */
export function rigShooter<T extends { x: number; z: number }>(front: T, rear: T | undefined, to: { x: number; z: number }): T {
  if (!rear) return front;
  const d = (a: T): number => Math.hypot(a.x - to.x, a.z - to.z);
  return d(rear) < d(front) ? rear : front;
}

/** Heading difference wrapped to (-π, π]. */
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
/** Eases 0..1 in and out. */
const ease = (u: number): number => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };

/** A turret's pointing: yaw about its up axis (+ = left), elevation of the gun (+ = up), radians. */
export interface Pointing { yaw: number; elev: number }

/** An aim-and-fire command in progress. */
export interface Aim {
  turret: TurretPart;
  /** Rest pose (where it turns back to), where it aims, and the turn it makes (shortest way within the arc). */
  rest: Pointing; to: Pointing; turn: number;
  rounds: number; kick: number; barrelRest: number;
  /** When it is aimed, when each round leaves, when it starts back, when it ends (seconds from the start). */
  aimed: number; shots: number[]; back: number; end: number;
  t: number; fired: number;
}

/**
 * Where a turret must point to hit world point `target`: the yaw in the turret's own frame and the
 * gun's elevation, before any limit. The turret's frame is its parent's (the body).
 */
export function pointingAt(t: TurretPart, target: THREE.Vector3): Pointing {
  const yawNode = t.turret ?? t.gun;
  const pivot = t.gun ?? yawNode;
  if (!yawNode || !pivot) return { yaw: 0, elev: 0 };
  const local = yawNode.parent!.worldToLocal(target.clone());
  const at = yawNode.position;
  const yaw = Math.atan2(-(local.z - at.z), local.x - at.x);
  const from = pivot.getWorldPosition(new THREE.Vector3());
  const flat = Math.hypot(target.x - from.x, target.z - from.z);
  return { yaw, elev: Math.atan2(target.y - from.y, Math.max(1e-6, flat)) };
}

/** The pointing a turret can reach nearest to `want`, within its arc and its elevation limits. */
export function clampPointing(t: TurretPart, want: Pointing): Pointing {
  const yaw = t.arc ? Math.max(t.arc[0], Math.min(t.arc[1], wrap(want.yaw))) : wrap(want.yaw);
  const elev = t.elev ? Math.max(t.elev[0], Math.min(t.elev[1], want.elev)) : 0;
  return { yaw, elev };
}

/** Lays out an aim-and-fire of `rounds` rounds toward pointing `want` (clamped to the turret's limits). */
export function makeAim(t: TurretPart, want: Pointing, rounds: number): Aim {
  const yawNode = t.turret ?? null;
  const rest: Pointing = { yaw: yawNode ? yawNode.rotation.y : 0, elev: t.gun && t.elev ? t.gun.rotation.z : 0 };
  const to = clampPointing(t, want);
  // A full circle turns the shortest way; a limited arc turns inside it.
  const full = !t.arc || t.arc[1] - t.arc[0] >= Math.PI * 2 - 0.01;
  const turn = yawNode ? (full ? wrap(to.yaw - rest.yaw) : to.yaw - rest.yaw) : 0;
  const speed = (yawNode?.userData.speed as number | undefined) ?? A.speed;
  const swing = Math.max(Math.abs(turn) / speed, Math.abs(to.elev - rest.elev) / A.elevSpeed);
  const aimed = Math.max(0.05, swing);
  const shots = Array.from({ length: Math.max(1, rounds) }, (_, k) => aimed + k * A.gap);
  const back = shots[shots.length - 1] + Math.max(A.recoil, A.hold);
  return {
    turret: t, rest, to, turn, rounds: shots.length, kick: t.kick ?? 0, barrelRest: t.barrel?.position.x ?? 0,
    aimed, shots, back, end: back + Math.max(0.05, swing), t: 0, fired: 0,
  };
}

/** The plan of an aim-and-fire: aimed, each round, end. */
export function planAim(a: Aim): MotionPlan {
  const moments: Moment[] = [{ name: 'aimed', at: a.aimed }, ...a.shots.map((at, index) => ({ name: 'shot' as const, index, at })), { name: 'end', at: a.end }];
  return { kind: 'aim', seconds: a.end, moments };
}

/** The pointing at time `t` of the command. */
export function pointingNow(a: Aim, t: number): Pointing {
  const out = t < a.back ? ease(t / a.aimed) : 1 - ease((t - a.back) / (a.end - a.back));
  return { yaw: a.rest.yaw + a.turn * out, elev: a.rest.elev + (a.to.elev - a.rest.elev) * out };
}

/** How far back the barrel is at time `t` (model units, 0 at rest): each round kicks it and it comes back in `recoil` seconds. */
export function recoilNow(a: Aim, t: number): number {
  let k = 0;
  for (const s of a.shots) if (t >= s && t < s + A.recoil) k = Math.max(k, a.kick * (1 - (t - s) / A.recoil));
  return k;
}

/**
 * One frame of the command: turns the turret, raises the gun, kicks the barrel. Returns the rounds
 * fired in this frame (their indices) and `done` at the end, when the gun is back at rest.
 */
export function stepAim(a: Aim, dt: number): { fired: number[]; done: boolean } {
  a.t = Math.min(a.end, a.t + dt);
  const p = pointingNow(a, a.t);
  if (a.turret.turret) a.turret.turret.rotation.y = p.yaw;
  if (a.turret.gun && a.turret.elev) a.turret.gun.rotation.z = p.elev;
  if (a.turret.barrel) a.turret.barrel.position.x = a.barrelRest - recoilNow(a, a.t);
  const fired: number[] = [];
  while (a.fired < a.shots.length && a.shots[a.fired] <= a.t) fired.push(a.fired++);
  return { fired, done: a.t >= a.end };
}
