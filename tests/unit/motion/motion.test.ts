// The Vehicle Motion system's core (src/app/motion/): plans and their durations, arrival on the
// space, lane alignment, the ramp jump, and the true stop (design/gdd/vehicle-motion.md, acceptance
// criteria; docs/piano-integrazione-veicoli.md, phase 2).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Frame, Terrain } from '../../../src/game/trv/engine';
import { P } from '../../../src/app/presentation';
import { makeRoute, routeAt, type Route } from '../../../src/app/route';
import { planDrive, stepDrive } from '../../../src/app/motion/drive';
import { makeJump, planJump, stepJump, type JumpEnv } from '../../../src/app/motion/jump';
import { MotionTrack, type MotionPlan } from '../../../src/app/motion/plan';
import { PartsRig } from '../../../src/app/motion/rig';
import { buildTestVehicle, type VehicleSheet } from '../../../src/view/test-vehicles';
import { describeVehicle } from '../../../src/view/vehicle-rig';
import SHEET from '../../../assets/base/modelli/schede/collaudo_auto.json';

/** A road space's length and the distance between lanes, world units (about the game's). */
const SPACE = 1.64, LANE = 1.16;
/** One frame at 60 frames per second. */
const DT = 1 / 60;

/** Spaces as (forward steps, lane) from a start at the origin. */
function routeOf(steps: [number, number][], alignEnd = true): Route {
  const spaces = steps.map(([c, r]) => new THREE.Vector3(c * SPACE, 0, r * LANE));
  const frames = steps.map(() => ({ kind: 'move' }) as unknown as Frame);
  const ground = steps.map(() => 'R' as Terrain);
  return makeRoute(new THREE.Vector3(0, 0, 0), spaces, frames, ground, P.route, alignEnd);
}

/** Drives a route frame by frame to its end: the time it took and the last sample. */
function driveAll(r: Route): { t: number; last: ReturnType<typeof stepDrive> } {
  let t = 0, last = stepDrive(r, 0, SPACE);
  for (let i = 0; i < 6000 && !last.done; i++) { last = stepDrive(r, DT, SPACE); t += DT; }
  return { t, last };
}

describe('driving a route', () => {
  const cases: [string, [number, number][]][] = [
    ['three spaces straight on', [[1, 0], [2, 0], [3, 0]]],
    ['a zigzag across the lanes', [[1, 0], [1.5, 1], [2.5, 1], [3, 0], [3.5, -1]]],
    ['a tight lane change', [[0.5, 1], [1, 2]]],
  ];
  for (const [name, steps] of cases) {
    it(`takes the planned time within 10%: ${name}`, () => {
      // Arrange
      const r = routeOf(steps);
      const plan = planDrive(r);
      // Act
      const { t } = driveAll(r);
      // Assert
      expect(Math.abs(t - plan.seconds) / plan.seconds).toBeLessThan(0.1);
      expect(plan.moments.at(-1)).toEqual({ name: 'end', at: plan.seconds });
      expect(plan.moments.filter(m => m.name === 'space').map(m => m.index)).toEqual(steps.map((_, k) => k));
    });

    it(`arrives on its last space, along its lane: ${name}`, () => {
      // Arrange
      const r = routeOf(steps);
      const [c, l] = steps[steps.length - 1];
      // Act
      const { last } = driveAll(r);
      // Assert
      expect(last.pos.distanceTo(new THREE.Vector3(c * SPACE, 0, l * LANE))).toBeLessThan(0.01);
      expect(last.yaw).toBeCloseTo(0, 6);
      expect(routeAt(r, 0).yaw).toBeCloseTo(0, 6);
    });
  }

  it('lets the Big Rig stop at a slant after a lane change', () => {
    // Arrange / Act
    const { last } = driveAll(routeOf([[1, 0], [1.5, 1]], false));
    // Assert
    expect(Math.abs(last.yaw)).toBeGreaterThan(0.05);
  });

  it('gives the space moments in time order, each one before the end', () => {
    // Arrange / Act
    const plan = planDrive(routeOf([[1, 0], [1.5, 1], [2.5, 1]]));
    // Assert
    const at = plan.moments.map(m => m.at);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(plan.moments.filter(m => m.name === 'space').every(m => m.at <= plan.seconds)).toBe(true);
  });
});

describe('ramp jump', () => {
  /** A ramp on the space at the origin: rising from 0 to 0.3 spaces over its length. */
  const env: JumpEnv = {
    space: SPACE,
    surfaceAt: (x, z) => (Math.abs(z) < LANE / 2 && x > -SPACE / 2 && x < SPACE / 2 ? (x + SPACE / 2) / SPACE * 0.3 * SPACE : null),
  };
  for (const n of [1, 2, 3, 4]) {
    it(`flies ${n} space(s), lands exactly on its space, in its planned time`, () => {
      // Arrange
      const car = new THREE.Object3D();
      car.userData.modelSize = new THREE.Vector3(SPACE * 0.6, SPACE * 0.25, SPACE * 0.3);
      car.position.set(-SPACE, 0, 0);
      const to = new THREE.Vector3(n * SPACE, 0, 0);
      const jp = makeJump({ from: car.position, rampAt: new THREE.Vector3(0, 0, 0), to, spaces: n, seed: `t${n}`, stunt: 'flat' }, env);
      const plan = planJump(jp);
      let touches = 0, t = 0, done = false;
      // Act
      for (let i = 0; i < 2000 && !done; i++) {
        ({ done } = stepJump(car, jp, DT, { ...env, onTouch: () => touches++ }));
        t += DT;
      }
      // Assert
      expect(done).toBe(true);
      expect(touches).toBe(1);
      expect(car.position.distanceTo(to)).toBeLessThan(0.01);
      expect(Math.abs(t - plan.seconds) / plan.seconds).toBeLessThan(0.1);
      expect(plan.moments.map(m => m.name)).toEqual(['lip', 'touch', 'end']);
    });
  }
});

describe('motion state and the true stop', () => {
  const plan: MotionPlan = { kind: 'drive', seconds: 1, moments: [{ name: 'space', index: 0, at: 0.5 }, { name: 'end', at: 1 }] };

  it('goes from planned to running to done, giving each moment once', () => {
    // Arrange
    const tr = new MotionTrack();
    tr.begin(plan);
    // Act / Assert
    expect(tr.status).toBe('planned');
    expect(tr.advance(0.3, false)).toEqual([]);
    expect(tr.status).toBe('running');
    expect(tr.advance(0.3, false).map(m => m.name)).toEqual(['space']);
    expect(tr.advance(0.5, true).map(m => m.name)).toEqual(['end']);
    expect(tr.status).toBe('done');
    expect(tr.advance(0.5, true)).toEqual([]);
  });

  it('is never still while its command runs, nor while a spring still moves', () => {
    // Arrange
    const tr = new MotionTrack();
    tr.begin(plan);
    // Act / Assert
    tr.advance(0.1, false);
    expect(tr.still([{ v: 0, s: 0 }])).toBe(false);
    tr.advance(1, true);
    expect(tr.still([{ v: 0.05, s: 0 }])).toBe(false);
    expect(tr.still([{ v: 0, s: 0 }])).toBe(true);
  });

  it('stops truly only after the end of the path, once the body has settled', () => {
    // Arrange: the test car on its parts, driving three spaces with its springs.
    const car = buildTestVehicle(SHEET as unknown as VehicleSheet, { crew: false });
    const rig = new PartsRig(describeVehicle(car), 1);
    const r = routeOf([[1, 0], [2, 0], [3, 0]]);
    const tr = new MotionTrack();
    tr.begin(planDrive(r));
    let t = 0, endAt = -1, stillAt = -1, lastV = 0, lastPos = new THREE.Vector3();
    // Act
    for (let i = 0; i < 1200 && stillAt < 0; i++) {
      const at = r.s < r.len ? stepDrive(r, DT, SPACE) : { pos: lastPos, done: true };
      const fwd = at.pos.distanceTo(lastPos), v = fwd / DT;
      rig.update(DT, fwd, (v - lastV) / DT, 0, 0);
      lastV = v; lastPos = at.pos.clone();
      tr.advance(DT, at.done);
      t += DT;
      if (at.done && endAt < 0) endAt = t;
      if (tr.still(rig.springs())) stillAt = t;
    }
    // Assert: it settles, after the path ends (the brake left the body nodding), within two seconds.
    expect(endAt).toBeGreaterThan(0);
    expect(stillAt).toBeGreaterThan(endAt);
    expect(stillAt - endAt).toBeLessThan(2);
  });

  it('rolls each wheel by the distance over its radius', () => {
    // Arrange
    const car = buildTestVehicle(SHEET as unknown as VehicleSheet, { crew: false });
    const d = describeVehicle(car);
    const rig = new PartsRig(d, 1);
    // Act: one metre forward.
    rig.update(DT, 1, 0, 0, 0);
    // Assert
    for (const w of d.wheels) expect(w.roll.rotation.z).toBeCloseTo(-1 / w.radius, 9);
  });
});
