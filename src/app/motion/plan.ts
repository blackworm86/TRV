// The Vehicle Motion system (#36, design/gdd/vehicle-motion.md): a motion command gives a plan
// (how long, its salient moments, where it ends), and each vehicle keeps the state of the one it
// is running (planned, running, done) and whether it is truly still: path over and springs at rest.
// Pure: no page, no scene (unit-tested in tests/unit/motion/).

import { P } from '../presentation';

/**
 * What a vehicle is doing: driving a route, jumping off a ramp, aiming and firing its gun, being
 * pushed, hitting, skidding (Stunned), tipping over (out of action), crashing (destroyed), falling
 * into a pit, or nothing.
 */
export type MotionKind = 'drive' | 'jump' | 'aim' | 'push' | 'hit' | 'skid' | 'spin' | 'slew' | 'quake' | 'hop' | 'flip' | 'crash' | 'fall' | 'idle';
/** Where a command stands. */
export type MotionStatus = 'planned' | 'running' | 'done';

/** A salient moment of a motion, in seconds from its start (the Director ties effects to these). */
export interface Moment {
  /**
   * `space`: the vehicle gets to space `index` of its route; `lip`, `touch`: a jump's take-off and
   * landing; `aimed`: the gun points at its target; `shot`: round `index` leaves the muzzle;
   * `impact`: the blow lands (a hit, a crash); `end`.
   */
  name: 'space' | 'lip' | 'touch' | 'aimed' | 'shot' | 'impact' | 'end';
  at: number;
  index?: number;
}

/** What a command will do, worked out before it starts. */
export interface MotionPlan {
  kind: MotionKind;
  /** Seconds at normal speed. */
  seconds: number;
  /** In time order; the last one is always `end`, at `seconds`. */
  moments: Moment[];
}

/** A spring of the body or of a part, as the rigs keep them: value, speed, and where it is heading (0 when not said). */
export interface SpringState { v: number; s: number; to?: number }

/**
 * True when a spring is at rest within the data's thresholds (`motion.settle_eps`): at the place it
 * is heading for (a suspension on uneven ground rests away from 0), and no longer moving.
 */
export function springStill(x: SpringState, eps = P.motion.settleEps): boolean {
  return Math.abs(x.v - (x.to ?? 0)) < eps.x && Math.abs(x.s) < eps.v;
}

/**
 * The motion state of one vehicle: the command it runs, its plan and how far it has got.
 * The Director starts commands; the vehicle's own code advances them every frame.
 */
export class MotionTrack {
  plan: MotionPlan | null = null;
  status: MotionStatus = 'done';
  /** Seconds since the command started (game time, after the speed scale). */
  t = 0;
  private next = 0;

  /** A new command: its plan, not started yet. One running on the same vehicle ends first (GDD, edge cases). */
  begin(plan: MotionPlan): void {
    this.plan = plan;
    this.status = 'planned';
    this.t = 0;
    this.next = 0;
  }

  /**
   * One frame of the command: `dt` game seconds; `over` when the vehicle's own path is finished.
   * Returns the moments passed in this frame, in order (the `end` moment when it finishes).
   */
  advance(dt: number, over: boolean): Moment[] {
    if (!this.plan || this.status === 'done') return [];
    this.status = 'running';
    this.t += dt;
    const out: Moment[] = [];
    const ms = this.plan.moments;
    while (this.next < ms.length && ms[this.next].name !== 'end' && ms[this.next].at <= this.t) out.push(ms[this.next++]);
    if (over) {
      while (this.next < ms.length) out.push(ms[this.next++]);
      this.status = 'done';
    }
    return out;
  }

  /** Ends the command at once ("salta scena", or a new command on the same vehicle). */
  finish(): void { this.status = 'done'; this.next = this.plan?.moments.length ?? 0; }

  /** The true stop: the command is over and every spring given is at rest. */
  still(springs: Iterable<SpringState> = []): boolean {
    if (this.status !== 'done') return false;
    for (const s of springs) if (!springStill(s)) return false;
    return true;
  }
}

