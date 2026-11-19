// The body springs, the wheels and the suspensions of a model built in parts (the naming contract,
// design/art/modelli-strutturati.md §4), driven through its parts descriptor (view/vehicle-rig.ts):
// - the wheels roll with the distance covered (Δθ = ds / r) and the front ones steer;
// - each suspension follows the ground under its wheel, within its travel, on a spring
//   (`motion.spring.susp`): y = clamp(h_ground − y_vehicle, −travel, +travel);
// - the body rests on the wheels: it lifts by their mean, pitches with the front axle against the
//   rear one, rolls with the left side against the right, and on top of that pitches and rolls on
//   its springs (`motion.spring.body`) as the car speeds up, brakes and turns, or a round is fired.
// The same values as the one-piece models' CarRig (`motion.car`), with the nose toward +x.

import * as THREE from 'three';
import { P } from '../presentation';
import { RIG } from '../../view/models-config';
import type { PartsDescriptor, WheelPart } from '../../view/vehicle-rig';
import type { SpringState } from './plan';

/** Slices a frame's springs are stepped in (at most this long each), as CarRig does. */
const SLICE = 1 / 240;
const SUSP = P.motion.spring.susp;

function spring(x: SpringState, target: number, dt: number, k = RIG.stiffness, c = RIG.damping): void {
  x.to = target;
  x.s += (k * (target - x.v) - c * x.s) * dt;
  x.v += x.s * dt;
}

/**
 * The vehicle's ride height, following the ground under its middle (`motion.ride.rate` per second):
 * the whole vehicle sinks into mud and climbs onto sand; its suspensions take the difference under
 * each wheel. Returns the new height from `y` toward the ground height `h` (unchanged when `h` is null).
 */
export function rideHeight(y: number, h: number | null, dt: number): number {
  return h === null ? y : y + (h - y) * (1 - Math.exp(-dt * P.motion.ride.rate));
}

/** The ground under the vehicle: world height at (x, z), or null where none is known; `base`: the world height of the vehicle's origin. */
export interface Ground { heightAt: (x: number, z: number) => number | null; base: number }

/** One wheel's suspension: its node's rest height and its spring (model units). */
interface Susp { w: WheelPart; rest: THREE.Vector3; spring: SpringState }

/** Drives the parts of one vehicle model. `scale`: world units per model unit (metres for the contract's models). */
export class PartsRig {
  readonly pitch: SpringState = { v: 0, s: 0 };
  readonly roll: SpringState = { v: 0, s: 0 };
  /** The front wheels' angle now (radians, + = left). */
  steer = 0;
  private readonly rest: { rot: THREE.Euler; pos: THREE.Vector3 } | null;
  private readonly wheel: THREE.Object3D | null;
  private readonly susp: Susp[];
  /** Distance between the front and rear axles, and between the left and right wheels (model units). */
  private readonly base: number;
  private readonly track: number;

  constructor(private readonly d: PartsDescriptor, private readonly scale: number) {
    this.rest = d.body ? { rot: d.body.rotation.clone(), pos: d.body.position.clone() } : null;
    let w: THREE.Object3D | null = null;
    d.body?.traverse(o => { if (o.name === 'steering_wheel' && !w) w = o; });
    this.wheel = w;
    this.susp = d.wheels.filter(x => x.susp && x.travel).map(x => ({ w: x, rest: x.susp!.position.clone(), spring: { v: 0, s: 0 } }));
    const xs = d.wheels.map(axleX);
    this.base = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
    const zs = this.susp.map(s => s.rest.z);
    this.track = zs.length ? Math.max(...zs) - Math.min(...zs) : 0;
  }

  /** The springs, for the true stop (MotionTrack.still): body and suspensions. */
  springs(): SpringState[] { return [this.pitch, this.roll, ...this.susp.map(s => s.spring)]; }

  /** How far each suspension is from its rest now (model units), front to back, left before right. */
  travel(): number[] { return this.susp.map(s => s.spring.v); }

  /** A round fired toward `yaw` (radians, in the body's frame): the body rocks away from it. */
  kick(yaw: number): void {
    const k = P.motion.aim.bodyKick;
    // Fired forward the nose rises; fired to the left (+yaw) the body rolls to the right.
    this.pitch.s += k * Math.cos(yaw);
    this.roll.s -= k * Math.sin(yaw);
  }

  /** A blow the body takes (a slam, a skid): its springs start moving at these speeds (radians per second). */
  jolt(pitch: number, roll: number): void {
    this.pitch.s += pitch;
    this.roll.s += roll;
  }

  /**
   * One frame. `forward`: distance driven (world units, negative backwards); `accel`: forward
   * acceleration; `turn`: heading still to make (radians, + = left); `turnRate`: radians per second;
   * `ground`: the ground under the wheels (without it the suspensions rest).
   */
  update(dt: number, forward: number, accel: number, turn: number, turnRate: number, ground?: Ground): void {
    accel = Math.max(-RIG.maxAccel, Math.min(RIG.maxAccel, accel));
    turnRate = Math.max(-RIG.maxTurnRate, Math.min(RIG.maxTurnRate, turnRate));
    const speed = Math.min(RIG.maxSpeed, Math.abs(forward) / Math.max(dt, 1e-3));
    const steerTo = Math.max(-RIG.maxSteer, Math.min(RIG.maxSteer, turn * RIG.steerGain));
    this.steer += (steerTo - this.steer) * Math.min(1, dt * 8);
    for (const w of this.d.wheels) {
      // Nose toward +x: rolling forward turns the wheel's top toward +x, a negative turn about z.
      if (w.radius > 0) w.roll.rotation.z -= forward / (w.radius * this.scale);
      if (w.steer && w.steer !== w.roll) {
        const max = (w.steer.userData.max as number | undefined) ?? RIG.maxSteer;
        w.steer.rotation.y = Math.max(-max, Math.min(max, this.steer));
      }
    }
    if (this.wheel) this.wheel.rotation.x = -this.steer * 2.5;
    // A motorcycle steers with its whole fork (the front wheel on it).
    if (this.d.fork) {
      const max = (this.d.fork.userData.max as number | undefined) ?? RIG.maxSteer;
      this.d.fork.rotation.y = Math.max(-max, Math.min(max, this.steer));
    }
    const { want, tiltP, tiltR } = this.onGround(ground);
    // The nose lifts when speeding up and dives when braking; the body leans out of a turn.
    const step = Math.min(dt, 0.1), slices = Math.max(1, Math.ceil(step / SLICE));
    for (let i = 0; i < slices; i++) {
      spring(this.pitch, lim(accel * RIG.pitchPerAccel + tiltP), step / slices);
      spring(this.roll, lim(turnRate * speed * RIG.rollPerTurn + tiltR), step / slices);
      this.susp.forEach((s, k) => spring(s.spring, want[k], step / slices, SUSP.k, SUSP.c));
    }
    for (const s of this.susp) {
      const [down, up] = s.w.travel!;
      // At the end of its travel it stops there (a bump stop), it does not keep pushing.
      if (s.spring.v < down || s.spring.v > up) { s.spring.v = Math.max(down, Math.min(up, s.spring.v)); s.spring.s = 0; }
    }
    this.place();
  }

  /**
   * Where the springs rest on `ground`: each suspension on the ground under its wheel, within its
   * travel; the body pitched by the front axle against the rear one and rolled by the left side
   * against the right (within RIG.maxTip). Without a ground everything rests at zero.
   */
  private onGround(ground?: Ground): { want: number[]; tiltP: number; tiltR: number } {
    const want = this.susp.map(s => {
      if (!ground) return 0;
      const at = s.w.susp!.parent!.localToWorld(s.rest.clone());
      const h = ground.heightAt(at.x, at.z);
      if (h === null) return 0;
      const [down, up] = s.w.travel!;
      return Math.max(down, Math.min(up, (h - ground.base) / this.scale));
    });
    let tiltP = 0, tiltR = 0;
    if (this.susp.length) {
      const mean = (f: (s: Susp) => boolean): number => {
        const v = this.susp.map((s, i) => [s, want[i]] as const).filter(([s]) => f(s)).map(([, y]) => y);
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
      };
      const front = Math.min(...this.susp.map(s => s.w.axle)), rear = Math.max(...this.susp.map(s => s.w.axle));
      if (this.base > 0 && rear > front) tiltP = Math.atan2(mean(s => s.w.axle === front) - mean(s => s.w.axle === rear), this.base);
      if (this.track > 0) tiltR = Math.atan2(mean(s => s.w.side === 'L') - mean(s => s.w.side === 'R'), this.track);
    }
    return { want, tiltP: lim(tiltP), tiltR: lim(tiltR) };
  }

  /** Puts the nodes where the springs are now: the suspensions, the body tilted and lifted by their mean. */
  private place(): void {
    for (const s of this.susp) s.w.susp!.position.y = s.rest.y + s.spring.v;
    if (!this.d.body || !this.rest) return;
    this.d.body.rotation.set(this.rest.rot.x + this.roll.v, this.rest.rot.y, this.rest.rot.z + this.pitch.v);
    // Lifted by where the suspensions are now (their springs), not where they are going.
    const lift = this.susp.length ? this.susp.reduce((a, s) => a + s.spring.v, 0) / this.susp.length : 0;
    this.d.body.position.y = this.rest.pos.y + lift;
  }

  /**
   * "Salta scena": the springs at rest at once, the steering straight. On `ground` (the vehicle's
   * matrices up to date) they rest where the ground puts them, so nothing moves afterwards.
   */
  settle(ground?: Ground): void {
    const { want, tiltP, tiltR } = this.onGround(ground);
    const rest = (x: SpringState, v: number): void => { x.v = v; x.s = 0; x.to = v; };
    rest(this.pitch, tiltP);
    rest(this.roll, tiltR);
    this.susp.forEach((s, k) => rest(s.spring, want[k]));
    if (this.d.fork) this.d.fork.rotation.y = 0;
    for (const w of this.d.wheels) if (w.steer && w.steer !== w.roll) w.steer.rotation.y = 0;
    this.steer = 0;
    this.place();
  }
}

const lim = (x: number): number => Math.max(-RIG.maxTip, Math.min(RIG.maxTip, x));

/** A wheel's position along the vehicle (model units): its axle node's x. */
function axleX(w: WheelPart): number {
  let n: THREE.Object3D | null = w.roll;
  while (n && !/^axle_\d+$/.test(n.name)) n = n.parent;
  return n ? n.position.x : 0;
}
