import { describe, expect, it } from 'vitest';
import { casingAt, ejectVelocity, landing } from '../../../src/app/motion/casing';

// A casing's flight (src/app/motion/casing.ts): out of the gun's right side, a fall, one bounce, rest.
const FLIGHT = { gravity: 9, bounce: 0.35, ground: 0 };
const START = { x: 0, y: 0.5, z: 0 };

describe('spent casings', () => {
  it('leave a gun firing along +x to its right (+z seen from above) and up, a little backward', () => {
    // Arrange: a gun firing along +x (yaw 0).
    // Act
    const v = ejectVelocity(0, 1.3, 1.5, 0.35);
    // Assert
    expect(v.z).toBeCloseTo(1.3);
    expect(v.y).toBeCloseTo(1.5);
    expect(v.x).toBeCloseTo(-0.35);
  });

  it('turn with the gun: a gun firing along -z throws them toward +x', () => {
    // Act
    const v = ejectVelocity(Math.PI / 2, 1, 0, 0);
    // Assert
    expect(v.x).toBeCloseTo(1);
    expect(v.z).toBeCloseTo(0);
  });

  it('fall to the table, bounce lower than they started, and come to rest on it', () => {
    // Arrange
    const v0 = ejectVelocity(0, 1.3, 1.5, 0.35);
    const hit = landing(START.y, v0.y, FLIGHT.gravity, FLIGHT.ground);
    // Act
    const atHit = casingAt(START, v0, FLIGHT, hit);
    const midBounce = casingAt(START, v0, FLIGHT, hit + 0.05);
    const rest = casingAt(START, v0, FLIGHT, 5);
    // Assert
    expect(atHit.y).toBeCloseTo(0, 6);
    expect(midBounce.y).toBeGreaterThan(0);
    expect(midBounce.y).toBeLessThan(START.y);
    expect(rest.y).toBe(0);
    // It stops: later still, the same place.
    expect(casingAt(START, v0, FLIGHT, 9)).toEqual(rest);
  });

  it('never goes under the table', () => {
    // Arrange
    const v0 = ejectVelocity(1, 1.3, 1.5, 0.35, 1);
    // Act, Assert
    for (let t = 0; t < 3; t += 0.01) expect(casingAt(START, v0, FLIGHT, t).y).toBeGreaterThanOrEqual(-1e-9);
  });
});
