import { describe, expect, it } from 'vitest';
import { chainMiddles, layRig, type Flat, type Laid } from '../../../src/view/rigchain';

// A lane is LANE apart across the road; spaces follow each other PITCH apart along it.
const PITCH = 1.5, LANE = 1.4, HALF = PITCH / 2;
const space = (lane: number, col: number): Flat => ({ x: col * PITCH, z: lane * LANE });

/** Where each section's front and rear hitches are. */
const hitches = (l: Laid): { front: Flat; rear: Flat } => {
  const d = { x: Math.cos(l.yaw), z: -Math.sin(l.yaw) };
  return { front: { x: l.x + HALF * d.x, z: l.z + HALF * d.z }, rear: { x: l.x - HALF * d.x, z: l.z - HALF * d.z } };
};
const gap = (a: Flat, b: Flat): number => Math.hypot(a.x - b.x, a.z - b.z);

describe('the Big Rig laid as a hitched chain', () => {
  it('a straight chain lies on the middles of its spaces', () => {
    const laid = layRig([space(0, 2), space(0, 1), space(0, 0)], 0, HALF);
    laid.forEach((l, i) => {
      expect(l.yaw).toBeCloseTo(0, 6);
      expect(gap(l, space(0, 2 - i))).toBeLessThan(1e-6);
    });
  });

  it('every front hitch meets the rear hitch of the section ahead', () => {
    const laid = layRig([space(-1, 3), space(-1, 2), space(0, 2)], 0, HALF);
    expect(gap(hitches(laid[0]).rear, hitches(laid[1]).front)).toBeLessThan(1e-9);
    expect(gap(hitches(laid[1]).rear, hitches(laid[2]).front)).toBeLessThan(1e-9);
  });

  it('after a lane change the trailers bridge the two lanes, both turned the same way (rulebook p6, third picture)', () => {
    // The cab went on straight in the new lane (z = -LANE); the rear trailer is still in the old one.
    const laid = layRig([space(-1, 3), space(-1, 2), space(0, 2)], 0, HALF);
    expect(laid[0].yaw).toBe(0);
    expect(laid[1].yaw).toBeGreaterThan(0.2);
    expect(laid[2].yaw).toBeGreaterThan(0.2);
    // Each section stays nearer its own space than the other lane's.
    expect(laid[1].z).toBeLessThan(-LANE / 2 + 0.3);
    expect(laid[2].z).toBeGreaterThan(-LANE / 2);
  });

  it('the front cab stands on the middle of its space, straight or oblique', () => {
    const oblique = layRig([space(-1, 2), space(0, 2), space(0, 1)], 1.0, HALF);
    expect(oblique[0]).toEqual({ ...space(-1, 2), yaw: 1.0 });
    const straight = layRig([space(-1, 3), space(-1, 2), space(0, 2)], 0, HALF);
    expect(straight[0]).toEqual({ ...space(-1, 3), yaw: 0 });
  });

  it('chainMiddles puts sections one pitch apart when straight', () => {
    const c = chainMiddles([0, 0, 0], HALF);
    expect(c.map(p => p.x)).toEqual([0, -PITCH, -2 * PITCH]);
  });

  it('a single section on the road stands on its space at its heading', () => {
    const [l] = layRig([space(0, 0)], 0.5, HALF);
    expect(l).toEqual({ x: 0, z: 0, yaw: 0.5 });
  });
});
