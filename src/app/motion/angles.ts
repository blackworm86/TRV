// Small helpers shared by the motion modules (one copy, 2026-11-20).

/** An angle brought into (-π, π]. Example: `wrapAngle(4)` is about -2.28. */
export const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** Smooth start and stop over u in [0, 1] (smoothstep), held at the ends outside it. */
export const smooth01 = (u: number): number => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };
