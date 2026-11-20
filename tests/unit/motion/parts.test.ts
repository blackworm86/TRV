// The parts of the test car in motion (src/app/motion/rig.ts, aim.ts): suspensions on the ground
// within their travel, the body resting on its wheels, steering toward the coming bend, the turret
// aiming and firing (design/gdd/vehicle-motion.md; docs/piano-integrazione-veicoli.md, phase 3).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Frame, Terrain } from '../../../src/game/trv/engine';
import { P } from '../../../src/app/presentation';
import { makeRoute } from '../../../src/app/route';
import { stepDrive } from '../../../src/app/motion/drive';
import { PartsRig, type Ground } from '../../../src/app/motion/rig';
import { RIG } from '../../../src/view/models-config';
import { clampPointing, elevationTo, makeAim, planAim, pointingAt, rigShooter, stepAim } from '../../../src/app/motion/aim';
import { MotionTrack } from '../../../src/app/motion/plan';
import { buildTestVehicle, type VehicleSheet } from '../../../src/view/test-vehicles';
import { describeVehicle, type TurretPart } from '../../../src/view/vehicle-rig';
import SHEET from '../../../assets/base/modelli/schede/collaudo_auto.json';

const sheet = SHEET as unknown as VehicleSheet;
const DT = 1 / 60;
const SPACE = 1.64, LANE = 1.16;

/** The test car at real scale (1 world unit = 1 m), its parts and a rig on them. */
function testCar(): { car: THREE.Group; rig: PartsRig; d: ReturnType<typeof describeVehicle> } {
  const car = buildTestVehicle(sheet, { crew: false });
  const d = describeVehicle(car);
  return { car, d, rig: new PartsRig(d, 1) };
}

/** Runs the rig still on a ground for `seconds`. */
function sit(rig: PartsRig, car: THREE.Object3D, ground: Ground, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) { car.updateMatrixWorld(true); rig.update(DT, 0, 0, 0, 0, ground); }
}

describe('suspensions on the ground', () => {
  it('keeps every suspension within its travel on rough ground', () => {
    // Arrange: bumps far higher and deeper than the travel, under a car driving over them.
    const { car, rig, d } = testCar();
    const ground: Ground = { heightAt: x => Math.sin(x * 3.1) * 0.5, base: 0 };
    let worst = 0;
    // Act
    for (let i = 0; i < 600; i++) {
      car.position.x += 0.03;
      car.updateMatrixWorld(true);
      rig.update(DT, 0.03, 0, 0, 0, ground);
      rig.travel().forEach((y, k) => {
        const [down, up] = d.wheels.filter(w => w.susp)[k].travel!;
        worst = Math.max(worst, down - y, y - up);
      });
    }
    // Assert
    expect(worst).toBeLessThanOrEqual(1e-9);
  });

  it('drops the front wheels into a dip and tips the nose down', () => {
    // Arrange: the ground 6 cm lower ahead of the middle.
    const { car, rig, d } = testCar();
    const ground: Ground = { heightAt: x => (x > 0 ? -0.06 : 0), base: 0 };
    // Act
    sit(rig, car, ground, 3);
    // Assert
    const y = rig.travel();
    const susp = d.wheels.filter(w => w.susp);
    susp.forEach((w, k) => expect(y[k]).toBeCloseTo(w.axle === 0 ? -0.06 : 0, 3));
    expect(rig.pitch.v).toBeLessThan(-0.01);
    expect(Math.abs(rig.roll.v)).toBeLessThan(1e-3);
  });

  it('rolls the body toward the lower side', () => {
    // Arrange: the right side (+z) 5 cm lower.
    const { car, rig } = testCar();
    // Act
    sit(rig, car, { heightAt: (_x, z) => (z > 0 ? -0.05 : 0), base: 0 }, 3);
    // Assert: left side up is a positive roll about the nose.
    expect(rig.roll.v).toBeGreaterThan(0.01);
  });

  it('comes to a true stop on uneven ground, its suspensions resting away from zero', () => {
    // Arrange: the front wheels in a dip, the rear ones on a bump (a car half on mud, half on sand).
    const { car, rig } = testCar();
    const track = new MotionTrack();
    // Act
    sit(rig, car, { heightAt: x => (x > 0 ? -0.06 : 0.05), base: 0 }, 4);
    // Assert: still, though no spring rests at zero; measured from zero (the old rule) it never would be.
    expect(track.still(rig.springs())).toBe(true);
    expect(rig.springs().some(s => Math.abs(s.v) > 0.01)).toBe(true);
    expect(track.still(rig.springs().map(s => ({ v: s.v, s: s.s })))).toBe(false);
  });

  it('stops a suspension at the end of its travel instead of pushing on', () => {
    // Arrange: ground far below the wheels' reach.
    const { car, rig } = testCar();
    // Act
    sit(rig, car, { heightAt: () => -1, base: 0 }, 2);
    // Assert: hanging at its lowest, not moving.
    expect(rig.springs().slice(2).every(s => s.s === 0)).toBe(true);
  });

  it('settles at once on uneven ground and does not move afterwards ("Salta scena")', () => {
    // Arrange: front wheels in a dip, rear ones on a bump; the car swinging on its springs.
    const { car, rig } = testCar();
    const ground: Ground = { heightAt: x => (x > 0 ? -0.06 : 0.05), base: 0 };
    rig.jolt(2, -1.5);
    for (let i = 0; i < 10; i++) { car.updateMatrixWorld(true); rig.update(DT, 0, 0, 0, 0, ground); }
    // Act
    car.updateMatrixWorld(true);
    rig.settle(ground);
    const after = rig.springs().map(s => s.v);
    sit(rig, car, ground, 1);
    // Assert: already where the ground puts it, and still.
    rig.springs().forEach((s, k) => expect(s.v).toBeCloseTo(after[k], 6));
    expect(after.some(v => Math.abs(v) > 0.01)).toBe(true);
  });

  it('rests the suspensions where the ground is unknown', () => {
    // Arrange
    const { car, rig } = testCar();
    // Act
    sit(rig, car, { heightAt: () => null, base: 0 }, 1);
    // Assert
    expect(rig.travel().every(y => Math.abs(y) < 1e-9)).toBe(true);
  });
});

describe('the engine', () => {
  it('shakes the body a little while it runs, and leaves it still when off or when there is none', () => {
    // Arrange
    const { rig, d } = testCar();
    const rest = d.body!.position.y;
    const span = (): number => {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < 60; i++) { rig.update(DT, 0, 0, 0, 0); lo = Math.min(lo, d.body!.position.y); hi = Math.max(hi, d.body!.position.y); }
      return hi - lo;
    };
    // Act
    const none = span();
    rig.engine = { on: true, phase: 0 };
    const running = span();
    rig.engine.on = false;
    const off = span();
    // Assert: a shake well under the body's height (RIG.engine.lift of it each way), none otherwise.
    const height = new THREE.Box3().setFromObject(d.body!).getSize(new THREE.Vector3()).y;
    expect(none).toBe(0);
    expect(running).toBeGreaterThan(0);
    expect(running).toBeLessThan(height * RIG.engine.lift * 2.01);
    expect(off).toBe(0);
    expect(d.body!.position.y).toBe(rest);
  });
});

describe('steering', () => {
  /** The steer of the front wheels as the car sets off on a lane change to `lane` (−1 = left, toward −z). */
  function steerInto(lane: number): number {
    const { car, rig, d } = testCar();
    const r = makeRoute(new THREE.Vector3(), [new THREE.Vector3(SPACE, 0, 0), new THREE.Vector3(SPACE * 1.5, 0, lane * LANE)],
      [{} as Frame, {} as Frame], ['R', 'R'] as Terrain[], P.route, true);
    let most = 0;
    // Through the first leg (straight on), as the bend comes.
    while (r.s < r.marks[1]) {
      const at = stepDrive(r, DT, SPACE);
      car.updateMatrixWorld(true);
      rig.update(DT, 0.02, 0, at.steer, 0);
      if (Math.abs(rig.steer) > Math.abs(most)) most = rig.steer;
    }
    const front = d.wheels.find(w => w.axle === 0 && w.steer)!;
    expect(front.steer!.rotation.y).toBeCloseTo(Math.max(-0.5, Math.min(0.5, rig.steer)), 9);
    return most;
  }

  it('turns the front wheels toward the bend that is coming', () => {
    // Arrange / Act / Assert: left is toward −z (a positive steer), right toward +z.
    expect(steerInto(-1)).toBeGreaterThan(0.02);
    expect(steerInto(1)).toBeLessThan(-0.02);
  });
});

describe('aiming and firing', () => {
  it('turns to its target, fires each round on time, kicks the barrel and turns back', () => {
    // Arrange: a target behind and to the left of the car, on the ground.
    const { car, d, rig } = testCar();
    car.updateMatrixWorld(true);
    const t = d.turrets[0];
    const want = pointingAt(t, new THREE.Vector3(-8, 0, -6));
    const a = makeAim(t, want, 3);
    const plan = planAim(a);
    const track = new MotionTrack();
    track.begin(plan);
    const fired: number[] = [], seen: string[] = [];
    let time = 0, done = false, kickMax = 0, aimedYaw = NaN;
    // Act
    while (!done && time < 20) {
      let shots: number[];
      ({ fired: shots, done } = stepAim(a, DT));
      time += DT;
      for (const k of shots) { fired.push(k); rig.kick(t.turret!.rotation.y); }
      for (const m of track.advance(DT, done)) { seen.push(m.name); if (m.name === 'aimed') aimedYaw = t.turret!.rotation.y; }
      kickMax = Math.max(kickMax, a.barrelRest - t.barrel!.position.x);
      rig.update(DT, 0, 0, 0, 0);
    }
    // Assert
    expect(Math.abs(time - plan.seconds)).toBeLessThan(DT * 1.5);
    expect(fired).toEqual([0, 1, 2]);
    expect(seen).toEqual(['aimed', 'shot', 'shot', 'shot', 'end']);
    expect(aimedYaw).toBeCloseTo(want.yaw, 1);
    expect(Math.abs(want.yaw)).toBeGreaterThan(Math.PI / 2);
    expect(kickMax).toBeGreaterThan(0);
    expect(kickMax).toBeLessThanOrEqual(t.kick! + 1e-9);
    expect(t.turret!.rotation.y).toBeCloseTo(0, 6);
    expect(t.barrel!.position.x).toBeCloseTo(a.barrelRest, 9);
    // The command is over; the body comes to rest on its springs.
    for (let i = 0; i < 300 && !track.still(rig.springs()); i++) rig.update(DT, 0, 0, 0, 0);
    expect(track.still(rig.springs())).toBe(true);
  });

  it('rocks the body away from a round fired forward', () => {
    // Arrange
    const { rig } = testCar();
    // Act
    rig.kick(0);
    for (let i = 0; i < 5; i++) rig.update(DT, 0, 0, 0, 0);
    // Assert: fired forward, the nose rises.
    expect(rig.pitch.v).toBeGreaterThan(0);
  });

  it('keeps the aim within the turret\'s arc and the gun\'s elevation', () => {
    // Arrange: a turret that turns only 90° each way and rises at most 0.3 rad.
    const t: TurretPart = { turret: new THREE.Object3D(), gun: new THREE.Object3D(), barrel: null, muzzle: null, arc: [-Math.PI / 2, Math.PI / 2], elev: [-0.1, 0.3], kick: null };
    // Act
    const p = clampPointing(t, { yaw: 3, elev: 1 });
    // Assert
    expect(p).toEqual({ yaw: Math.PI / 2, elev: 0.3 });
  });
});

describe('Big Rig: which section fires', () => {
  // A rig three spaces long along x: the tractor ahead, the rear section two spaces behind.
  const SPACE = 1.5;
  const front = { x: 2 * SPACE, z: 0 }, rear = { x: 0, z: 0 };

  it('a target in the rear arc, behind the rear section, is fired at by the rear section', () => {
    // Arrange, Act
    const who = rigShooter(front, rear, { x: -SPACE, z: SPACE * 0.9 });
    // Assert
    expect(who).toBe(rear);
  });

  it('a target in the front arc, ahead of the tractor, is fired at by the tractor', () => {
    // Arrange, Act
    const who = rigShooter(front, rear, { x: 3 * SPACE, z: -SPACE * 0.9 });
    // Assert
    expect(who).toBe(front);
  });

  it('a rig that lost its rear section fires from the tractor, whatever the target', () => {
    // Arrange, Act
    const who = rigShooter(front, undefined, { x: -SPACE, z: 0 });
    // Assert
    expect(who).toBe(front);
  });
  it('a gun is raised by the slope to its target, less what its barrel is above its pin', () => {
    // Arrange: a target 4 away; a barrel 0.3 above the pin.
    const FLAT = 4, OFFSET = 0.3;
    // Act
    const level = elevationTo(OFFSET, FLAT, OFFSET), down = elevationTo(-1, FLAT, OFFSET), plain = elevationTo(1, FLAT);
    // Assert: a target at the barrel's own height needs no rise; one below it, a barrel pointing down.
    expect(level).toBeCloseTo(0, 2);
    expect(down).toBeLessThan(0);
    expect(plain).toBeCloseTo(Math.atan2(1, FLAT), 9);
    // The barrel's line, OFFSET above the pin and tilted by `down`, passes through the target.
    const miss = -1 * Math.cos(down) - FLAT * Math.sin(down) - OFFSET;
    expect(miss).toBeCloseTo(0, 6);
  });
});
