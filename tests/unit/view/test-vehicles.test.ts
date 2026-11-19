// The test car of the integration plan (src/view/test-vehicles.ts, its sheet in
// assets/base/modelli/schede/collaudo_auto.json): the naming contract, real scale, wheels on the
// ground, nose toward +x, left side toward -z (design/art/modelli-strutturati.md §3, §4, §10.2).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTestVehicle, toTable, type VehicleSheet } from '../../../src/view/test-vehicles';
import { describeVehicle, missingParts, type Capability } from '../../../src/view/vehicle-rig';
import SHEET from '../../../assets/base/modelli/schede/collaudo_auto.json';

const sheet = SHEET as unknown as VehicleSheet;

/** World box of a node's meshes. */
const boxOf = (o: THREE.Object3D): THREE.Box3 => new THREE.Box3().setFromObject(o);

describe('test car', () => {
  it('has every part its sheet declares, read by the parts descriptor', () => {
    // Arrange
    const car = buildTestVehicle(sheet);
    // Act
    const d = describeVehicle(car);
    // Assert
    expect(d.source).toBe('named');
    expect(missingParts(d, sheet.capabilities as Capability[])).toEqual([]);
    expect([...d.capabilities].sort()).toEqual([...sheet.capabilities].sort());
    expect(d.wheels).toHaveLength(4);
    expect(d.turrets[0].muzzle?.userData.weapon).toBe('mg');
    // The steering wheel and the gun each carry their own pair of grips.
    expect(d.grips.map(g => `${g.parent?.name}/${g.name}`).sort()).toEqual(['gun/grip_L', 'gun/grip_R', 'steering_wheel/grip_L', 'steering_wheel/grip_R']);
  });

  it('stands on its wheels at y = 0, nose toward +x, as long as the sheet says', () => {
    // Arrange
    const car = buildTestVehicle(sheet, { crew: false });
    // Act
    const all = boxOf(car);
    const d = describeVehicle(car);
    const tyres = d.wheels.map(w => boxOf(w.roll));
    // Assert
    for (const b of tyres) expect(b.min.y).toBeCloseTo(0, 6);
    expect(all.min.y).toBeGreaterThanOrEqual(-1e-6);
    expect(Math.abs(all.max.x - all.min.x - sheet.length_m) / sheet.length_m).toBeLessThan(0.05);
    const front = d.wheels.filter(w => w.axle === 0);
    expect(front.every(w => w.roll.getWorldPosition(new THREE.Vector3()).x > 0)).toBe(true);
  });

  it('puts the left wheels toward -z and steers only the front axle', () => {
    // Arrange / Act
    const d = describeVehicle(buildTestVehicle(sheet));
    // Assert
    for (const w of d.wheels) {
      const z = w.roll.getWorldPosition(new THREE.Vector3()).z;
      expect(Math.sign(z)).toBe(w.side === 'L' ? -1 : 1);
      expect(!!w.steer).toBe(w.axle === 0);
    }
  });

  it('rolls each wheel about its own centre', () => {
    // Arrange: a wheel's tyre box before and after a quarter turn.
    const car = buildTestVehicle(sheet, { crew: false });
    const w = describeVehicle(car).wheels[0];
    const before = boxOf(w.roll).getCenter(new THREE.Vector3());
    // Act
    w.roll.rotation.z = Math.PI / 2;
    car.updateMatrixWorld(true);
    const after = boxOf(w.roll).getCenter(new THREE.Vector3());
    // Assert
    expect(after.distanceTo(before)).toBeLessThan(0.01);
  });

  it('seats a dummy on each seat, and leaves them out on request', () => {
    // Arrange / Act
    const withCrew = buildTestVehicle(sheet);
    const bare = buildTestVehicle(sheet, { crew: false });
    // Assert
    for (const role of ['driver', 'gunner']) expect(withCrew.getObjectByName(`dummy_${role}`)).toBeDefined();
    expect(bare.getObjectByName('dummy_driver')).toBeUndefined();
  });

  it('scales to its length on the table', () => {
    // Arrange
    const car = buildTestVehicle(sheet, { crew: false });
    // Act
    toTable(car, sheet, 0.05);
    // Assert
    expect(car.scale.x).toBeCloseTo(sheet.show_mm * 0.05 / sheet.length_m, 9);
  });
});
