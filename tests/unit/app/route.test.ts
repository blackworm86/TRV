import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { Frame } from '../../../src/game/trv/engine';
import { makeRoute, routeAt, type RouteKnobs } from '../../../src/app/route';

const frame = (): Frame => ({ kind: 'move', snap: {} as Frame['snap'] });
const K: RouteKnobs = { top: 6.5, accel: 9, brake: 11, grip: 9, crawl: 0.35, tangent: 1.1, smooth: 0 };

describe('route through several spaces', () => {
  it('starts at the car, goes through every space in order and ends on the last one', () => {
    // Arrange: a lane change left, then right (a zigzag).
    const from = new THREE.Vector3(0, 0.1, 0);
    const spaces = [new THREE.Vector3(1, 0, -0.8), new THREE.Vector3(2, 0, 0), new THREE.Vector3(3, 0, -0.8)];
    // Act
    const r = makeRoute(from, spaces, spaces.map(frame), ['R', 'M', 'o'], K);
    // Assert: each beat's mark is where the curve passes its space's previous point.
    expect(routeAt(r, 0).pos.distanceTo(from)).toBeLessThan(1e-6);
    expect(routeAt(r, r.len).pos.distanceTo(spaces[2].clone().setY(0.1))).toBeLessThan(1e-6);
    expect(r.marks[0]).toBe(0);
    expect(routeAt(r, r.marks[1]).pos.distanceTo(spaces[0].clone().setY(0.1))).toBeLessThan(1e-6);
    expect(routeAt(r, r.marks[2]).pos.distanceTo(spaces[1].clone().setY(0.1))).toBeLessThan(1e-6);
    expect(r.marks[1]).toBeLessThan(r.marks[2]);
  });

  it('is a curve, a little longer than the straight legs, and says which ground the car is heading for', () => {
    const from = new THREE.Vector3(0, 0, 0);
    const spaces = [new THREE.Vector3(1, 0, -0.8), new THREE.Vector3(2, 0, 0)];
    const r = makeRoute(from, spaces, spaces.map(frame), ['G', 'D'], K);
    const legs = from.distanceTo(spaces[0]) + spaces[0].distanceTo(spaces[1]);
    expect(r.len).toBeGreaterThanOrEqual(legs);
    expect(r.len).toBeLessThan(legs * 1.3);
    expect(routeAt(r, r.len * 0.25).seg).toBe(0);
    expect(r.ground[routeAt(r, r.len * 0.75).seg]).toBe('D');
  });

  it('sets off and arrives along the lane, steering in between for a lane change', () => {
    const from = new THREE.Vector3(0, 0, 0);
    const spaces = [new THREE.Vector3(1, 0, -0.8)];
    const r = makeRoute(from, spaces, spaces.map(frame), ['R'], K);
    expect(routeAt(r, 0).yaw).toBe(0);
    expect(routeAt(r, r.len).yaw).toBe(0);
    expect(Math.abs(routeAt(r, r.len / 2).yaw)).toBeGreaterThan(0.3);
  });

  it('cuts the corners of a zigzag with smoothing, so the nose turns less, and still ends on the last space', () => {
    const from = new THREE.Vector3(0, 0, 0);
    const spaces = [new THREE.Vector3(0.5, 0, -0.8), new THREE.Vector3(1, 0, 0), new THREE.Vector3(1.5, 0, -0.8), new THREE.Vector3(2, 0, -0.8)];
    const turn = (r: ReturnType<typeof makeRoute>): number => Math.max(...r.yaw.map(Math.abs));
    const sharp = makeRoute(from, spaces, spaces.map(frame), ['R', 'R', 'R', 'R'], K);
    const smooth = makeRoute(from, spaces, spaces.map(frame), ['R', 'R', 'R', 'R'], { ...K, smooth: 0.45 });
    expect(turn(smooth)).toBeLessThan(turn(sharp) * 0.85);
    expect(routeAt(smooth, smooth.len).pos.distanceTo(spaces[3])).toBeLessThan(1e-6);
    expect(routeAt(smooth, smooth.marks[1]).pos.distanceTo(spaces[0])).toBeLessThan(0.4);
  });

  it('lets the Big Rig stop at a slant', () => {
    const from = new THREE.Vector3(0, 0, 0);
    const spaces = [new THREE.Vector3(1, 0, -0.8)];
    const r = makeRoute(from, spaces, spaces.map(frame), ['R'], K, false);
    expect(Math.abs(routeAt(r, r.len).yaw)).toBeGreaterThan(0.3);
  });

  it('speeds up from a crawl, never passes top speed, and brakes to a crawl at the end', () => {
    const from = new THREE.Vector3(0, 0, 0);
    const spaces = [1, 2, 3, 4].map(x => new THREE.Vector3(x, 0, 0));
    const r = makeRoute(from, spaces, spaces.map(frame), ['R', 'R', 'R', 'R'], K);
    expect(r.v[0]).toBe(K.crawl);
    expect(r.v[r.v.length - 1]).toBe(K.crawl);
    expect(Math.max(...r.v)).toBeLessThanOrEqual(K.top);
    expect(routeAt(r, r.len / 2).v).toBeGreaterThan(routeAt(r, 0.05).v);
  });
});
