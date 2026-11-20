// The spent casings a machine gun throws out while it fires (asked by the user, 2026-11-20: instead of
// a recoil, the guns eject casings, the chopper's too). Pure flight, unit-tested; effects.ts draws them.
// A casing leaves the breech sideways and up, falls, bounces once on the table and lies there.

/** A point or a velocity: x and z along the table, y up. */
export interface V3 { x: number; y: number; z: number }

/** How a casing flies: gravity (units/s²), the share of speed kept by its bounce, the table's height. */
export interface CasingFlight { gravity: number; bounce: number; ground: number }

/**
 * The velocity a casing leaves the gun with: `side` units/s to the gun's right of its firing direction
 * `yaw` (a world yaw: 0 along +x, turning toward −z), `up` units/s up, and `back` units/s backward.
 * `jitter` in [-1, 1] spreads one casing from the next.
 */
export function ejectVelocity(yaw: number, side: number, up: number, back: number, jitter = 0): V3 {
  const fx = Math.cos(yaw), fz = -Math.sin(yaw);
  // The right of the firing direction, seen from above with y up.
  const rx = -fz, rz = fx;
  const s = side * (1 + 0.25 * jitter), b = back * (1 - 0.3 * jitter);
  return { x: rx * s - fx * b, y: up * (1 + 0.2 * jitter), z: rz * s - fz * b };
}

/**
 * Where a casing is `t` seconds after leaving `p0` at `v0`: a fall, one bounce on the ground (its speed
 * times `bounce`, upward), then a second fall to rest on the ground. Never under the ground.
 */
export function casingAt(p0: V3, v0: V3, f: CasingFlight, t: number): V3 {
  const hit = landing(p0.y, v0.y, f.gravity, f.ground);
  if (t <= hit) return { x: p0.x + v0.x * t, y: p0.y + v0.y * t - 0.5 * f.gravity * t * t, z: p0.z + v0.z * t };
  // The bounce: what is left of its speed, up again; along the table it slows the same way.
  const at = casingAt(p0, v0, f, hit), vy = (f.gravity * hit - v0.y) * f.bounce;
  const vx = v0.x * f.bounce, vz = v0.z * f.bounce;
  const t2 = Math.min(t - hit, (2 * vy) / f.gravity);
  return { x: at.x + vx * t2, y: Math.max(f.ground, f.ground + vy * t2 - 0.5 * f.gravity * t2 * t2), z: at.z + vz * t2 };
}

/** The time at which a body thrown up at `vy` from `y0` reaches `ground`, falling (0 if it starts under). */
export function landing(y0: number, vy: number, g: number, ground: number): number {
  const h = y0 - ground;
  if (h <= 0) return 0;
  return (vy + Math.sqrt(vy * vy + 2 * g * h)) / g;
}
