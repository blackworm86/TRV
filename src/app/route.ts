// How a car drives forward through one or more spaces (asked by the user, 2026-11-19: "as in a
// driving game"). The route is planned as a car would drive it: it sets off along its lane, goes
// through every space on a smooth racing line (near the centre, cutting corners), and arrives along its lane again (the Big
// Rig may stop at a slant). Along it the car keeps a speed a driver would: it speeds up, slows down
// before a tight bend as far as its grip asks, and brakes to stop on the last space. Its nose
// always points along the way. Pure geometry: loop.ts makes the route, drive() in cars.ts follows
// it, the beats of the move wait for the car to get to each space.

import * as THREE from 'three';
import type { Frame, Terrain } from '../game/trv/engine';

/**
 * How the car drives (presentation_base.json, `route`): top speed, acceleration and braking
 * (world units per second, per second squared), the sideways grip that caps the speed in a bend,
 * the speed it starts from and stops at, how long the curve's tangents are (share of a leg), and how
 * much it cuts the corners: each space in between is pulled toward its neighbours' midpoint by `smooth`
 * (0 = through every centre), as a driver takes a racing line instead of zigzagging.
 */
export interface RouteKnobs { top: number; accel: number; brake: number; grip: number; crawl: number; tangent: number; smooth: number }

/** Samples of the curve per space crossed. */
const SAMPLES = 24;

export interface Route {
  /** The curve as a polyline: points, distance covered at each, the nose's heading (yaw, as drive() uses it) and the speed. */
  pts: THREE.Vector3[]; cum: number[]; yaw: number[]; v: number[];
  /** The move beats it plays, and the distance at which the car sets off for each one's space. */
  frames: Frame[]; marks: number[];
  /** The ground of each space it crosses (for what the wheels throw up, trail.ts). */
  ground: Terrain[];
  /** Distance covered so far, and the whole length. */
  s: number; len: number;
}

/** Along the lane: the way every space faces (+x, yaw 0). */
const LANE = new THREE.Vector3(1, 0, 0);

/** A point of the cubic Hermite curve from `a` to `b` with tangents `ta`, `tb`. */
function hermite(a: THREE.Vector3, b: THREE.Vector3, ta: THREE.Vector3, tb: THREE.Vector3, u: number): THREE.Vector3 {
  const u2 = u * u, u3 = u2 * u;
  return a.clone().multiplyScalar(2 * u3 - 3 * u2 + 1)
    .addScaledVector(ta, u3 - 2 * u2 + u)
    .addScaledVector(b, -2 * u3 + 3 * u2)
    .addScaledVector(tb, u3 - u2);
}

/**
 * The route from `from` through `spaces` (one per move beat in `frames`, with its ground).
 * `alignEnd`: the car arrives along its lane (false for the Big Rig, which may stop at a slant).
 */
export function makeRoute(from: THREE.Vector3, spaces: THREE.Vector3[], frames: Frame[], ground: Terrain[],
  k: RouteKnobs, alignEnd = true): Route {
  const P = [from.clone(), ...spaces.map(p => p.clone().setY(from.y))];
  // The racing line: the spaces in between are passed near their centre, not through it (the last one exactly).
  const C = P.map(p => p.clone());
  for (let i = 1; i < P.length - 1; i++) P[i].lerp(C[i - 1].clone().add(C[i + 1]).multiplyScalar(0.5), k.smooth);
  const n = P.length - 1;
  const leg = (i: number): number => P[i + 1].distanceTo(P[i]);
  // Tangents: along the lane at the start (and at the end), elsewhere the way from the space before to the one after.
  const T = P.map((_, i) => {
    if (i === 0) return LANE.clone().multiplyScalar(leg(0) * k.tangent);
    if (i === n) return (alignEnd ? LANE.clone() : P[n].clone().sub(P[n - 1]).setY(0).normalize()).multiplyScalar(leg(n - 1) * k.tangent);
    return P[i + 1].clone().sub(P[i - 1]).setY(0).normalize().multiplyScalar((leg(i - 1) + leg(i)) / 2 * k.tangent);
  });
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) for (let j = i ? 1 : 0; j <= SAMPLES; j++) pts.push(hermite(P[i], P[i + 1], T[i], T[i + 1], j / SAMPLES));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  // The nose's heading at each point (yaw turns toward -z, as in drive()), and the curvature.
  const yaw = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    return Math.atan2(-(b.z - a.z), b.x - a.x);
  });
  yaw[0] = 0;
  if (alignEnd) yaw[yaw.length - 1] = 0;
  const bend = yaw.map((_, i) => {
    if (i === 0 || i === yaw.length - 1) return 0;
    const d = Math.atan2(Math.sin(yaw[i + 1] - yaw[i - 1]), Math.cos(yaw[i + 1] - yaw[i - 1]));
    return Math.abs(d) / Math.max(1e-6, cum[i + 1] - cum[i - 1]);
  });
  // The speed: the grip's limit in each bend, then what speeding up from the start and braking to the end allow.
  const v = bend.map(c => Math.min(k.top, c > 1e-6 ? Math.sqrt(k.grip / c) : k.top));
  v[0] = k.crawl;
  v[v.length - 1] = k.crawl;
  for (let i = 1; i < v.length; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] ** 2 + 2 * k.accel * (cum[i] - cum[i - 1])));
  for (let i = v.length - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * k.brake * (cum[i + 1] - cum[i])));
  const marks = frames.map((_, f) => cum[f * SAMPLES]);
  return { pts, cum, yaw, v, frames, marks, ground, s: 0, len: cum[cum.length - 1] };
}

/** Where the route is at distance `s`: the point, the nose's heading, the speed there, and which of its spaces the car is heading for. */
export function routeAt(r: Route, s: number): { pos: THREE.Vector3; yaw: number; v: number; seg: number } {
  const d = Math.max(0, Math.min(r.len, s));
  let i = 1;
  while (i < r.cum.length - 1 && r.cum[i] < d) i++;
  const a = r.cum[i - 1], b = r.cum[i], u = b > a ? (d - a) / (b - a) : 1;
  const dy = Math.atan2(Math.sin(r.yaw[i] - r.yaw[i - 1]), Math.cos(r.yaw[i] - r.yaw[i - 1]));
  return {
    pos: r.pts[i - 1].clone().lerp(r.pts[i], u),
    yaw: r.yaw[i - 1] + dy * u,
    v: r.v[i - 1] + (r.v[i] - r.v[i - 1]) * u,
    seg: Math.min(r.ground.length - 1, Math.floor((i - 1) / SAMPLES)),
  };
}
