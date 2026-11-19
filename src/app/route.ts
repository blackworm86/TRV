// The way a car drives through several spaces in a row (a waypoint path run with Vai!, a slide on
// desert glass): one smooth curve through the spaces, not straight legs from centre to centre, so
// the car steers into its lane changes and a motorcycle leans into them (asked by the user,
// 2026-11-19). loop.ts makes the route and holds each step's beat until the car gets there;
// drive() in cars.ts moves the car along it.

import * as THREE from 'three';
import type { Frame, Terrain } from '../game/trv/engine';

/** Samples of the curve per space crossed. */
const SAMPLES = 16;

export interface Route {
  /** The curve as a polyline, and the distance covered at each of its points. */
  pts: THREE.Vector3[]; cum: number[];
  /** The move beats it plays, and the distance at which the car sets off for each one's space. */
  frames: Frame[]; marks: number[];
  /** The ground of each space it crosses (for the dust, trail.ts). */
  ground: Terrain[];
  /** Distance covered so far, and the whole length. */
  s: number; len: number;
}

/**
 * The route from `from` through `spaces` (one per move beat in `frames`, with its ground).
 * A centripetal Catmull-Rom curve: it never overshoots or loops between close points.
 */
export function makeRoute(from: THREE.Vector3, spaces: THREE.Vector3[], frames: Frame[], ground: Terrain[]): Route {
  const curve = new THREE.CatmullRomCurve3([from.clone(), ...spaces.map(p => p.clone().setY(from.y))], false, 'centripetal');
  const n = spaces.length, pts: THREE.Vector3[] = [], cum: number[] = [];
  for (let i = 0; i <= n * SAMPLES; i++) {
    const p = curve.getPoint(i / (n * SAMPLES));
    cum.push(i ? cum[i - 1] + p.distanceTo(pts[i - 1]) : 0);
    pts.push(p);
  }
  const marks = frames.map((_, k) => cum[k * SAMPLES]);
  return { pts, cum, frames, marks, ground, s: 0, len: cum[cum.length - 1] };
}

/** Where the route is at distance `s`, and which of its spaces the car is heading for. */
export function routeAt(r: Route, s: number): { pos: THREE.Vector3; seg: number } {
  const d = Math.max(0, Math.min(r.len, s));
  let i = 1;
  while (i < r.cum.length - 1 && r.cum[i] < d) i++;
  const a = r.cum[i - 1], b = r.cum[i];
  const pos = r.pts[i - 1].clone().lerp(r.pts[i], b > a ? (d - a) / (b - a) : 1);
  return { pos, seg: Math.min(r.ground.length - 1, Math.floor((i - 1) / SAMPLES)) };
}
