// The Big Rig as a train (asked by the user, 2026-11-20: "i due moduli attaccati alla motrice ...
// dovrebbero seguirla come un treno"): the tractor's middle leaves a trail on the table, and every
// trailer rides it as a wagon rides its track: its front hitch on the rear hitch of the section
// ahead, its tail drawn to the point of the trail one section's length further back along the way
// driven. So a trailer passes where the tractor passed, through the spaces it went through, and
// comes to rest over the space the section ahead has just left. Lengths are measured along the trail,
// not straight across it: the board's lane changes zigzag at sharp angles, and a straight measure
// jumps from one leg of a zigzag to the other. Before the trail is long enough (the first steps, a game loaded) it goes on
// straight back along the road from its oldest point.
// Pure geometry on the road's plane: x along the road, heading 0 along +x, positive toward -z.

/** A point on the road's plane. */
export interface Flat { x: number; z: number }
/** A section on the table: its middle and its heading. */
export interface Placed extends Flat { yaw: number }

const far = (a: Flat, b: Flat): number => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Adds the tractor's middle to its trail (oldest first) when it has moved at least `step` from the
 * last point, and forgets what is farther than `keep` from it: the trail is as long as the train.
 */
export function extendTrail(trail: Flat[], at: Flat, step: number, keep: number): void {
  const last = trail[trail.length - 1];
  if (last && far(last, at) < step) return;
  trail.push({ x: at.x, z: at.z });
  while (trail.length > 2 && far(trail[1], at) > keep) trail.shift();
}

/**
 * The point of the trail `arc` back from `at` (the tractor's middle now), measured along the way
 * driven. Past the oldest point the trail goes on straight back along the road (toward -x).
 */
export function backOn(trail: Flat[], at: Flat, arc: number): Flat {
  let near = at, left = arc;
  for (let i = trail.length - 1; i >= 0; i--) {
    const leg = far(near, trail[i]);
    if (leg >= left && leg > 1e-12) {
      const t = left / leg;
      return { x: near.x + (trail[i].x - near.x) * t, z: near.z + (trail[i].z - near.z) * t };
    }
    left -= leg;
    near = trail[i];
  }
  return { x: near.x - left, z: near.z };
}

/** The heading from `a` to `b` (0 along +x, positive toward -z); `keep` when they are the same point. */
const toward = (a: Flat, b: Flat, keep: number): number => (far(a, b) > 1e-9 ? Math.atan2(-(b.z - a.z), b.x - a.x) : keep);

/**
 * The heading of a tractor whose middle is at `at`: it looks from the point of its trail `back`
 * behind it along the way driven, so it turns as it goes and does not spin on its middle.
 */
export function headingOn(trail: Flat[], at: Flat, back: number): number {
  return toward(backOn(trail, at, back), at, 0);
}

/**
 * Where `n` trailers lie behind a tractor standing at `front`: each one `2 * half` long between its
 * hitches, its front hitch on the rear hitch of the section ahead, heading from the point of the
 * trail where its rear hitch would be on a straight, but never folded more than `fold` (radians)
 * against the section ahead: a truck does not jackknife to follow a zigzag. `was`: the trailers'
 * headings a moment ago and the most each may have turned since (radians), so a heavy trailer swings
 * round, it does not flick. Returns their middles and headings, the nearest to the tractor first.
 */
export function trainOn(trail: Flat[], front: Placed, half: number, n: number, fold = Math.PI,
  was?: { yaws: number[]; turn: number }): Placed[] {
  const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
  const out: Placed[] = [];
  let hitch: Flat = { x: front.x - half * Math.cos(front.yaw), z: front.z + half * Math.sin(front.yaw) };
  let yaw = front.yaw;
  for (let k = 0; k < n; k++) {
    let want = toward(backOn(trail, front, half + 2 * half * (k + 1)), hitch, yaw);
    const old = was?.yaws[k];
    if (was && old !== undefined) want = old + Math.max(-was.turn, Math.min(was.turn, wrap(want - old)));
    yaw += Math.max(-fold, Math.min(fold, wrap(want - yaw)));
    const c = Math.cos(yaw), s = Math.sin(yaw);
    out.push({ x: hitch.x - half * c, z: hitch.z + half * s, yaw });
    hitch = { x: hitch.x - 2 * half * c, z: hitch.z + 2 * half * s };
  }
  return out;
}
