// How the Big Rig lies on the table (BRaFF p4, the movement example on p6; asked by the project owner,
// 2026-11-18): the three sections are hitched end to end like a train. The front cab stands at the
// heading of its last step (oblique after a lane change); each trailer turns as the hitch needs, so
// after a lane change the trailers bridge the two lanes as in the rulebook's pictures. The front cab
// always stands on the middle of its space, straight or oblique (asked by the project owner,
// 2026-11-18); the trailers turn so they lie nearest the middles of their own spaces. Pure geometry: table
// units on the road's plane, x along the road, heading 0 along +x and positive toward -z (three.js).

/** A point on the road's plane. */
export interface Flat { x: number; z: number }
/** A section laid on the table: its middle and its heading. */
export interface Laid extends Flat { yaw: number }

/**
 * The search over each trailer's heading: how far it may turn, and the steps of the coarse and fine
 * passes; `bend` is what folding a hitch costs, against a section straying from its space (per
 * radian squared, in half sections squared): a truck does not fold at right angles to reach a space.
 */
export const RIG_CHAIN = { maxYaw: 1.3, coarse: 0.04, fine: 0.004, bend: 2.5 };

const dir = (yaw: number): Flat => ({ x: Math.cos(yaw), z: -Math.sin(yaw) });

/**
 * The middles of a hitched chain laid from the front's middle at (0, 0): each section's front hitch is
 * `half` ahead of its middle and its rear hitch `half` behind, and every front hitch meets the rear
 * hitch of the section ahead.
 */
export function chainMiddles(yaws: number[], half: number): Flat[] {
  const out: Flat[] = [{ x: 0, z: 0 }];
  for (let i = 1; i < yaws.length; i++) {
    const a = dir(yaws[i - 1]), b = dir(yaws[i]), p = out[i - 1];
    out.push({ x: p.x - half * (a.x + b.x), z: p.z - half * (a.z + b.z) });
  }
  return out;
}

/** How far the trailers lie from their spaces, the front cab on the middle of its own: the sum of squared distances. */
function spread(spaces: Flat[], yaws: number[], half: number): { cost: number; dx: number; dz: number } {
  const c = chainMiddles(yaws, half);
  const dx = spaces[0].x, dz = spaces[0].z;
  let cost = 0;
  for (let i = 1; i < spaces.length; i++) cost += (spaces[i].x - c[i].x - dx) ** 2 + (spaces[i].z - c[i].z - dz) ** 2;
  return { cost, dx, dz };
}

/**
 * Lays the Big Rig: `spaces` are the middles of the spaces its sections stand on, front first (one to
 * three of them), `frontYaw` the front cab's heading, `half` half the length of a section between its
 * hitches. Returns each section's middle and heading, hitches meeting.
 */
export function layRig(spaces: Flat[], frontYaw: number, half: number): Laid[] {
  const n = spaces.length;
  const at = (yaws: number[]): Laid[] => {
    const { dx, dz } = spread(spaces, yaws, half);
    return chainMiddles(yaws, half).map((m, i) => ({ x: m.x + dx, z: m.z + dz, yaw: yaws[i] }));
  };
  if (n < 2) return at([frontYaw]);
  // Straight unless the hitch needs a turn: a tiny cost on turning keeps a straight chain straight.
  const score = (yaws: number[]): number => spread(spaces, yaws, half).cost + 1e-4 * yaws.slice(1).reduce((t, y) => t + y * y, 0)
    + RIG_CHAIN.bend * half * half * yaws.slice(1).reduce((t, y, i) => t + (y - yaws[i]) ** 2, 0);
  const search = (around: number[], reach: number, step: number): number[] => {
    let best = around, bestScore = score(around);
    const values = (c: number): number[] => {
      const out: number[] = [];
      for (let y = Math.max(-RIG_CHAIN.maxYaw, c - reach); y <= Math.min(RIG_CHAIN.maxYaw, c + reach) + 1e-9; y += step) out.push(y);
      return out;
    };
    const first = values(around[1]);
    const second = n > 2 ? values(around[2]) : [0];
    for (const a of first) for (const b of second) {
      const yaws = n > 2 ? [frontYaw, a, b] : [frontYaw, a];
      const s = score(yaws);
      if (s < bestScore - 1e-12) { best = yaws; bestScore = s; }
    }
    return best;
  };
  const start = n > 2 ? [frontYaw, 0, 0] : [frontYaw, 0];
  const coarse = search(start, RIG_CHAIN.maxYaw, RIG_CHAIN.coarse);
  return at(search(coarse, RIG_CHAIN.coarse, RIG_CHAIN.fine));
}
