import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { Frame } from '../../../src/game/trv/engine';
import { makeRoute, routeAt } from '../../../src/app/route';

const frame = (): Frame => ({ kind: 'move', snap: {} as Frame['snap'] });

describe('route through several spaces', () => {
  it('starts at the car, goes through every space in order and ends on the last one', () => {
    // Arrange: a lane change left, then right (a zigzag).
    const from = new THREE.Vector3(0, 0.1, 0);
    const spaces = [new THREE.Vector3(1, 0, -0.8), new THREE.Vector3(2, 0, 0), new THREE.Vector3(3, 0, -0.8)];
    // Act
    const r = makeRoute(from, spaces, spaces.map(frame), ['R', 'M', 'o']);
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
    const r = makeRoute(from, spaces, spaces.map(frame), ['G', 'D']);
    const legs = from.distanceTo(spaces[0]) + spaces[0].distanceTo(spaces[1]);
    expect(r.len).toBeGreaterThanOrEqual(legs);
    expect(r.len).toBeLessThan(legs * 1.2);
    expect(routeAt(r, r.len * 0.25).seg).toBe(0);
    expect(r.ground[routeAt(r, r.len * 0.75).seg]).toBe('D');
  });
});
