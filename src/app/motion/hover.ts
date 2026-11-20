// A helicopter holding its place in the air (asked by the user, 2026-11-20: "salgano/scendano e rollino
// come un vero elicottero, senza esagerare coi movimenti"). It never stands still: it rises and sinks
// slowly, rolls and pitches a little, and slides the way it tips, a quarter of a swing behind, as a real
// one drifts toward the side it leans to before the pilot brings it back. Pure, unit-tested;
// view/models-config.ts hover() puts a model in this pose.

/** How a helicopter hovers: lengths as a share of its height, angles in radians. */
export interface HoverTuning {
  /** How far it rises and sinks. */
  lift: number;
  /** How far it rolls, pitches and turns its nose. */
  roll: number; pitch: number; yaw: number;
  /** How far it slides sideways (with its roll) and along its length (with its pitch). */
  sway: number; surge: number;
  /** The pace of it all (radians per second of the slowest swing). */
  speed: number;
  /** How fast it takes up or gives up its hover on leaving or touching the ground (per second). */
  ease: number;
}

/** A hovering pose, as offsets from rest: up, to its right (+z) and ahead (+x), and the three turns. */
export interface HoverPose { lift: number; sway: number; surge: number; roll: number; pitch: number; yaw: number }

/**
 * The pose of a helicopter hovering at time `t` (seconds). `phase` puts each one out of step with the
 * others; `amount` in 0..1 fades it (0 on the ground: exactly at rest). Lengths in shares of its height.
 * Roll (+ its top toward +z) leads the slide to +z; pitch (+ nose up) leads the slide backward.
 */
export function hoverPose(t: number, phase: number, amount: number, H: HoverTuning): HoverPose {
  const w = t * H.speed + phase, a = Math.max(0, Math.min(1, amount));
  const wr = w * 1.21 + 2, wp = w * 0.87 + 0.4;
  return {
    lift: (Math.sin(w) * 0.6 + Math.sin(w * 1.73 + 1.1) * 0.4) * H.lift * a,
    roll: Math.sin(wr) * H.roll * a,
    sway: -Math.cos(wr) * H.sway * a,
    pitch: Math.sin(wp) * H.pitch * a,
    surge: Math.cos(wp) * H.surge * a,
    yaw: Math.sin(w * 0.53 + 4) * H.yaw * a,
  };
}
