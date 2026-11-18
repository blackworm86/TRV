// A die thrown on the table: it flies, bounces lower and lower, may strike a piece standing by
// its way and glance off it, then tumbles on its edges for its last quarter turns and stops flat.
// The throw is planned backwards from where the die must end and the face it must show (the
// rules of placement choose the spot, the game's dice the face), so it is a show and nothing else.
// Pure reckoning with three.js maths: no scene, no DOM.

import * as THREE from 'three';

/** A piece a die can strike: a cylinder standing on the table (a car, a wreck, a rock). */
export interface Bumper { x: number; z: number; r: number }

/**
 * How a die is thrown (data/trv/presentation_base.json, `diceThrow`). Lengths in dice (1 = the
 * die's width). `peak`: height of the first flight; `bounce`: heights of the bounces after it;
 * `rollQuarters`: quarter turns it tumbles on the ground at the end, at most; `spin`: how much
 * faster it turns in the air than rolling would; `wobble`: extra turns off its axis at the start,
 * dying out; `ease`: how much it slows down (1 = steady); `reach`: how far from its landing spot a
 * piece may be struck; `detour`: how much longer the way by that piece may be; `hitHeight`: how
 * high it strikes; `tossTurns`: turns of a die thrown again where it lies.
 */
export interface ThrowKnobs {
  peak: number; bounce: number[]; rollQuarters: number; spin: number; wobble: number; ease: number;
  reach: number; detour: number; hitHeight: number; tossTurns: number;
}

/** A planned throw: `at(u)` puts the die where it is at `u` (0 thrown, 1 at rest); where and when it strikes a piece. */
export interface Throw {
  at(u: number, pos: THREE.Vector3, quat: THREE.Quaternion): void;
  /** Where it strikes a piece, and at which `u`; null when it strikes none. */
  hit: THREE.Vector3 | null;
  hitAt: number | null;
}

const UP = new THREE.Vector3(0, 1, 0);
const flat = (a: THREE.Vector3, b: THREE.Vector3): number => Math.hypot(b.x - a.x, b.z - a.z);

/** Where the die strikes `b` coming from `from` to go on to `to` (it leaves as a ball off a cushion), or null when it cannot. */
function strike(from: THREE.Vector3, to: THREE.Vector3, b: Bumper, w: number, k: ThrowKnobs): THREE.Vector3 | null {
  const reach = b.r + w / 2;
  const dTo = Math.hypot(to.x - b.x, to.z - b.z), dFrom = Math.hypot(from.x - b.x, from.z - b.z);
  if (dTo < reach + w * 0.8 || dTo > k.reach * w || dFrom < reach + w) return null;
  // The cushion's normal halves the angle between the way in and the way out.
  const nx = (from.x - b.x) / dFrom + (to.x - b.x) / dTo, nz = (from.z - b.z) / dFrom + (to.z - b.z) / dTo;
  const n = Math.hypot(nx, nz);
  if (n < 0.7) return null; // the landing spot is behind the piece
  return new THREE.Vector3(b.x + nx / n * reach, 0, b.z + nz / n * reach);
}

/**
 * Plans the throw of a die of width `w` from `from` to rest at `to` showing `face` (its final
 * orientation). `bumpers` are the pieces on the table; `rnd` gives numbers 0..1 (the variety of
 * the throw: nothing of the game depends on it).
 * Example: `const t = planThrow(a, b, q, 0.8, cars, Math.random, K); t.at(0.5, mesh.position, mesh.quaternion)`.
 */
export function planThrow(from: THREE.Vector3, to: THREE.Vector3, face: THREE.Quaternion, w: number, bumpers: Bumper[], rnd: () => number, k: ThrowKnobs): Throw {
  const quarter = Math.PI / 2 / w; // radians of rolling per unit of way
  const wobbleAxis = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
  const q = new THREE.Quaternion(), q2 = new THREE.Quaternion();

  // Thrown again where it lies: straight up, turning, and down on the same spot.
  if (flat(from, to) < w * 0.6) {
    return {
      hit: null, hitAt: null,
      at(u, pos, quat) {
        const t = Math.min(1, Math.max(0, u)), e = 1 - (1 - t) * (1 - t);
        pos.copy(from).lerp(to, e);
        pos.y += 4 * k.peak * w * 0.6 * t * (1 - t);
        quat.setFromAxisAngle(wobbleAxis, -k.tossTurns * Math.PI * 2 * (1 - e)).multiply(face);
      },
    };
  }

  // The piece to strike: the one that lengthens the way least.
  let hit: THREE.Vector3 | null = null, least = k.detour * w;
  for (const b of bumpers) {
    const c = strike(from, to, b, w, k);
    if (!c) continue;
    const more = flat(from, c) + flat(c, to) - flat(from, to);
    if (more < least) { least = more; hit = c; }
  }
  const l1 = hit ? flat(from, hit) : 0, l2 = hit ? flat(hit, to) : flat(from, to), len = l1 + l2;
  const turnAt = hit ?? from;
  const d1 = hit ? new THREE.Vector3(hit.x - from.x, 0, hit.z - from.z).normalize() : null;
  const d2 = new THREE.Vector3(to.x - turnAt.x, 0, to.z - turnAt.z).normalize();
  // Rolling forward turns the die about the axis across its way.
  const a1 = d1 ? UP.clone().cross(d1) : null, a2 = UP.clone().cross(d2);

  // The last stretch is tumbled on the ground, a whole number of quarter turns, so it stops flat.
  const quarters = Math.max(0, Math.min(k.rollQuarters, Math.floor(l2 * 0.5 / w)));
  const ground = quarters * w, air = len - ground;
  // The hops: the flight (to the piece it strikes, if any), then lower and lower bounces.
  const yHit = to.y + k.hitHeight * w;
  const hops: { s0: number; s1: number; y0: number; y1: number; h: number }[] = [];
  if (hit) {
    hops.push({ s0: 0, s1: l1, y0: from.y, y1: yHit, h: k.peak * w * 0.7 });
    const rest = air - l1, cut = l1 + rest * 0.62;
    hops.push({ s0: l1, s1: cut, y0: yHit, y1: to.y, h: (k.bounce[0] ?? 0.4) * w });
    hops.push({ s0: cut, s1: air, y0: to.y, y1: to.y, h: (k.bounce[1] ?? 0.15) * w });
  } else {
    const c1 = air * 0.56, c2 = air * 0.84;
    hops.push({ s0: 0, s1: c1, y0: from.y, y1: to.y, h: k.peak * w });
    hops.push({ s0: c1, s1: c2, y0: to.y, y1: to.y, h: (k.bounce[0] ?? 0.4) * w });
    hops.push({ s0: c2, s1: air, y0: to.y, y1: to.y, h: (k.bounce[1] ?? 0.15) * w });
  }
  const turn2 = ground * quarter + (air - l1) * quarter * k.spin; // all the turning of the last stretch
  const sOf = (u: number): number => len * (1 - Math.pow(1 - Math.min(1, Math.max(0, u)), k.ease));

  return {
    hit: hit ? hit.clone().setY(yHit) : null,
    hitAt: hit ? 1 - Math.pow(1 - l1 / len, 1 / k.ease) : null,
    at(u, pos, quat) {
      const s = sOf(u);
      // Along the way.
      if (hit && s < l1) pos.copy(from).lerp(hit, s / l1); else pos.copy(turnAt).lerp(to, l2 > 0 ? (s - l1) / l2 : 1);
      // Height: in a hop, or tumbling on an edge.
      const rolled = Math.max(0, Math.min(ground, len - s)); // ground still to roll
      if (s < air) {
        const hop = hops.find(h => s < h.s1) ?? hops[hops.length - 1];
        const v = hop.s1 > hop.s0 ? (s - hop.s0) / (hop.s1 - hop.s0) : 1;
        pos.y = hop.y0 + (hop.y1 - hop.y0) * v + 4 * hop.h * v * (1 - v);
      } else {
        const a = (rolled * quarter) % (Math.PI / 2);
        pos.y = to.y + w / 2 * (Math.cos(a) + Math.sin(a) - 1);
      }
      // Turning: undone backwards from the face it must show.
      const airLeft2 = Math.max(0, air - Math.max(s, l1));
      quat.setFromAxisAngle(a2, -(hit && s < l1 ? turn2 : rolled * quarter + airLeft2 * quarter * k.spin)).multiply(face);
      if (a1 && s < l1) quat.premultiply(q.setFromAxisAngle(a1, -(l1 - s) * quarter * k.spin));
      const left = air > 0 ? Math.max(0, air - s) / air : 0;
      if (left > 0) quat.premultiply(q2.setFromAxisAngle(wobbleAxis, k.wobble * Math.PI * 2 * left * left));
    },
  };
}
