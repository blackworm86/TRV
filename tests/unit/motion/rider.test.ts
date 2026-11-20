import { describe, expect, it } from 'vitest';
import { riderDemo, riderJoints, riderPose, twoBoneIK, type P3, type RiderHolds, type RiderState } from '../../../src/app/motion/rider';
import { P } from '../../../src/app/presentation';

// The motorcycle's rider (src/app/motion/rider.ts): a pose that follows the bike, limbs that reach.
const R = P.motion.rider;
const dist = (a: P3, b: P3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
/** The test motorcycle's grips and footrests seen from its seat (assets/base/modelli/schede/collaudo_moto.json). */
const HOLDS: RiderHolds = { gripL: { x: 0.92, y: 0.04, z: -0.32 }, gripR: { x: 0.92, y: 0.04, z: 0.32 }, footL: { x: 0.18, y: -0.6, z: -0.24 }, footR: { x: 0.18, y: -0.6, z: 0.24 } };
const STILL: RiderState = { lean: 0, slip: 0, pitch: 0, air: 0, land: 0, fire: null };

describe('two-bone reach', () => {
  it('ends on a target within reach, with bones of their own length, bending toward the pole', () => {
    // Arrange
    const root = { x: 0, y: 0, z: 0 }, target = { x: 0.5, y: 0, z: 0 }, pole = { x: 0, y: 1, z: 0 };
    // Act
    const { mid, end } = twoBoneIK(root, target, 0.4, 0.4, pole);
    // Assert
    expect(dist(end, target)).toBeLessThan(1e-6);
    expect(dist(root, mid)).toBeCloseTo(0.4, 6);
    expect(dist(mid, end)).toBeCloseTo(0.4, 6);
    expect(mid.y).toBeGreaterThan(0);
  });

  it('stretches straight toward a target out of reach, never longer than its bones', () => {
    // Act
    const { mid, end } = twoBoneIK({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, 0.4, 0.4, { x: 0, y: 1, z: 0 });
    // Assert
    expect(end.x).toBeCloseTo(0.8, 4);
    expect(Math.abs(mid.y)).toBeLessThan(0.01);
  });
});

describe('the rider', () => {
  it('keeps its hands on the grips and its feet on the footrests when riding straight', () => {
    // Act
    const j = riderJoints(riderPose(STILL, R), HOLDS, R);
    // Assert
    expect(dist(j.handL, HOLDS.gripL)).toBeLessThan(1e-4);
    expect(dist(j.handR, HOLDS.gripR)).toBeLessThan(1e-4);
    expect(dist(j.footL, HOLDS.footL)).toBeLessThan(1e-4);
    expect(dist(j.footR, HOLDS.footR)).toBeLessThan(1e-4);
    // Bent over the tank, head up: the chest ahead of the hips.
    expect(j.chest.x).toBeGreaterThan(j.hips.x);
  });

  it('leans into a turn more than the bike, its head back toward level', () => {
    // Arrange: the bike leans right by 0.4.
    const s = { ...STILL, lean: 0.4 };
    // Act
    const p = riderPose(s, R);
    // Assert
    expect(p.roll).toBeGreaterThan(0);
    expect(p.headRoll).toBeLessThan(0);
    expect(Math.abs(p.headRoll)).toBeLessThan(s.lean + p.roll);
    expect(riderJoints(p, HOLDS, R).chest.z).toBeGreaterThan(0);
  });

  it('turns its chest toward the path in a drift, its head further', () => {
    // Arrange: the nose swung left of the path, so the path lies to the rider's right (a turn toward -y).
    // Act
    const p = riderPose({ ...STILL, slip: 0.5 }, R);
    // Assert
    expect(p.twist).toBeLessThan(0);
    expect(p.headTurn).toBeLessThan(0);
    expect(riderJoints(p, HOLDS, R).fwd.z).toBeGreaterThan(0);
  });

  it('leans forward in a wheelie and stands on the pegs in a jump, lower on the landing', () => {
    // Act
    const still = riderPose(STILL, R), wheelie = riderPose({ ...STILL, pitch: 0.5 }, R);
    const air = riderPose({ ...STILL, air: 1 }, R), land = riderPose({ ...STILL, land: 1 }, R);
    // Assert
    expect(wheelie.bend).toBeGreaterThan(still.bend);
    expect(wheelie.hipsFwd).toBeGreaterThan(0);
    expect(air.hipsUp).toBeGreaterThan(0);
    expect(land.hipsUp).toBeLessThan(0);
  });

  it('crouches behind the mounted gun, both hands on the grips', () => {
    // Act
    const p = riderPose({ ...STILL, fire: { weapon: 'mount' } }, R);
    const j = riderJoints(p, HOLDS, R);
    // Assert
    expect(p.bend).toBeGreaterThan(riderPose(STILL, R).bend);
    expect(dist(j.handL, HOLDS.gripL)).toBeLessThan(1e-4);
  });

  it('raises its LEFT hand toward the target with the uzi, the right one still on its grip', () => {
    // Arrange: a target to the left, ahead.
    const target = { x: 3, y: 0.3, z: -3 };
    // Act
    const p = riderPose({ ...STILL, fire: { weapon: 'uzi', target } }, R);
    const j = riderJoints(p, HOLDS, R, target);
    // Assert
    expect(p.uzi).toBe(true);
    expect(dist(j.handL, HOLDS.gripL)).toBeGreaterThan(0.1);
    const toTarget = { x: target.x - j.shoulderL.x, y: target.y - j.shoulderL.y, z: target.z - j.shoulderL.z };
    const toHand = { x: j.handL.x - j.shoulderL.x, y: j.handL.y - j.shoulderL.y, z: j.handL.z - j.shoulderL.z };
    const cos = (toTarget.x * toHand.x + toTarget.y * toHand.y + toTarget.z * toHand.z) / (Math.hypot(toTarget.x, toTarget.y, toTarget.z) * Math.hypot(toHand.x, toHand.y, toHand.z));
    expect(cos).toBeGreaterThan(0.99);
    expect(dist(j.handR, HOLDS.gripR)).toBeLessThan(1e-4);
  });

  it('shows every move in its bench loop: lean both ways, drift, wheelie, jump, both guns', () => {
    // Arrange
    const target = { x: 3, y: 0, z: -3 };
    const labels = new Set<string>();
    // Act
    for (let t = 0; t < 16; t += 0.1) labels.add(riderDemo(t, target).label);
    // Assert
    for (const l of ['piega a sinistra', 'piega a destra', 'derapata', 'impennata', 'salto', 'atterraggio', 'mitragliatrice', 'uzi']) expect(labels).toContain(l);
  });
});
