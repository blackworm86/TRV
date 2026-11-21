// The wheels of the vehicles the game mounts from their sheets (assets/*/modelli/schede/): every wheel on a
// suspension of its own, moved only by the ground under it, and the front axle of every car and of the Big
// Rig's tractor steering (asked by the user, 2026-11-21).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PartsRig, type Ground } from '../../../src/app/motion/rig';
import { buildTestVehicle, type VehicleSheet } from '../../../src/view/test-vehicles';
import { describeVehicle } from '../../../src/view/vehicle-rig';
import CAR_S from '../../../assets/base/modelli/schede/car_s.json';
import CAR_M from '../../../assets/base/modelli/schede/car_m.json';
import CAR_L from '../../../assets/base/modelli/schede/car_l.json';
import RIG_FRONT from '../../../assets/big_rig/modelli/schede/big_rig_front.json';
import RIG_MID from '../../../assets/big_rig/modelli/schede/big_rig_mid.json';
import RIG_REAR from '../../../assets/big_rig/modelli/schede/big_rig_rear.json';

const DT = 1 / 60, BUMP = 0.04;
const SHEETS = { car_s: CAR_S, car_m: CAR_M, car_l: CAR_L, big_rig_front: RIG_FRONT, big_rig_mid: RIG_MID, big_rig_rear: RIG_REAR } as unknown as Record<string, VehicleSheet>;
/** The sheets whose front axle steers: the cars and the tractor; the trailers follow their hitch. */
const STEERING = ['car_s', 'car_m', 'car_l', 'big_rig_front'];

function mounted(sheet: VehicleSheet): { car: THREE.Group; rig: PartsRig; d: ReturnType<typeof describeVehicle> } {
  const car = buildTestVehicle(sheet, { crew: false });
  car.updateMatrixWorld(true);
  const d = describeVehicle(car);
  return { car, d, rig: new PartsRig(d, 1) };
}

describe.each(Object.entries(SHEETS))('the wheels of %s', (id, sheet) => {
  it('gives every wheel a suspension of its own with room to move both ways', () => {
    const { d } = mounted(sheet);
    expect(d.wheels.length).toBeGreaterThanOrEqual(4);
    expect(new Set(d.wheels.map(w => w.susp)).size).toBe(d.wheels.length);
    for (const w of d.wheels) {
      expect(w.susp).not.toBeNull();
      expect(w.travel![0]).toBeLessThan(0);
      expect(w.travel![1]).toBeGreaterThan(0);
    }
  });

  it('lifts only the wheel that stands on a bump', () => {
    for (let k = 0; k < mounted(sheet).d.wheels.length; k++) {
      // Arrange: a bump under one wheel alone.
      const { car, rig, d } = mounted(sheet);
      const at = d.wheels[k].susp!.getWorldPosition(new THREE.Vector3());
      const ground: Ground = { heightAt: (x, z) => (Math.hypot(x - at.x, z - at.z) < 0.2 ? BUMP : 0), base: 0 };
      // Act
      for (let t = 0; t < 3; t += DT) { car.updateMatrixWorld(true); rig.update(DT, 0, 0, 0, 0, ground); }
      // Assert
      rig.travel().forEach((y, j) => expect(y, `${id}: ruota ${j} con il dosso sotto la ${k}`).toBeCloseTo(j === k ? BUMP : 0, 3));
    }
  });

  it(STEERING.includes(id) ? 'steers its two front wheels, each on its own pivot, and no other' : 'steers no wheel: a trailer follows its hitch', () => {
    const { d } = mounted(sheet);
    const steering = d.wheels.filter(w => w.steer && w.steer !== w.roll);
    if (!STEERING.includes(id)) { expect(steering).toEqual([]); return; }
    expect(steering.map(w => w.axle)).toEqual([0, 0]);
    expect(new Set(steering.map(w => w.steer)).size).toBe(2);
  });
});
